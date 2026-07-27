# Problem Classification & Ingestion — Decision Log

Interview-prep reference for the problem-classification pipeline: how LeetCode problems
get pulled in, tagged by topic, and kept in supply for contest creation. Same format as
[AUTH_ARCHITECTURE.md](AUTH_ARCHITECTURE.md): what/why/tradeoff/files per section, with a
"say this" line for interview recall.

Build sequence:
1. Replace the legacy scrape with LeetCode's real GraphQL API (real tags, not guesses)
2. Rebuild the classification cascade around those real tags + an LLM fallback for the residual
3. One-time full-catalog seed
4. Decouple ingestion from the contest-creation request path (background sync job)

---

## The problem before any of this

Three files did all the work: `utils/leetcode.js` (fetch), `utils/problemIngestion.js`
(classify + store), `services/aiTagger.js` (an AI fallback).

- **The fetch** hit LeetCode's legacy, unofficial REST endpoint
  (`/api/problems/all/`), which returns only `{title, slug, difficulty}` — no
  description, no topic tags. And it ran live, synchronously, inside the
  `POST /create-contest` request.
- **The classification** was two blind tiers: regex keyword-matching on the title alone,
  then — if that failed — a Hugging Face BERT zero-shot call, also given the title alone
  (`description` and `constraints` were hardcoded to `''` at the call site). Neither tier
  ever saw the actual problem statement.
- **The retry job** re-asked the identical BERT call, on the identical starved input, up
  to two more times before giving up. Retrying an unchanged question isn't retrying a
  failure — it's just asking again and hoping.
- A DB column named `leetcodeTags` was actually populated with the *regex output*, not
  anything from LeetCode — misleading if you ever have to explain `tagSource` out loud.

None of this was a "bug" exactly — it worked, in the sense that it always returned
*something*. But title-only classification was fighting with one hand tied, and the
retry loop couldn't fix that no matter how many times it ran.

**Say this:** "The original pipeline never actually looked at the problem — both the
rule-based tier and the AI tier classified from a bare title, because the fetch itself
never pulled a description. No amount of retrying that call was ever going to help,
because retrying doesn't add information."

---

## 1. Replacing the Fetch: LeetCode's Real GraphQL API

**What:** `utils/leetcode.js` now calls LeetCode's GraphQL endpoint
(`problemsetQuestionList` for the catalog, `question(titleSlug)` for a single
description) instead of the legacy REST endpoint.

**Why:** The GraphQL query returns **real, LeetCode-assigned topic tags** per problem —
"Array", "Hash Table", "Sliding Window", "Two Pointers", etc. — the same taxonomy
LeetCode's own site uses. This is ground truth, not a guess, and it's free.

**What I verified before trusting it (not just assumed):**
- Confirmed the query shape against the live endpoint — field names, response structure.
- The server **hard-clamps `limit` to 100** regardless of what's requested (tested by
  asking for `limit: 5000` — still got 100 back), so pagination across ~41 pages is
  mandatory, not optional.
- Surveyed the **entire real catalog** (2,458 free Easy/Medium problems) and found 67
  unique topic tags in actual use — used as the ground truth for the mapping table in
  §2, not guessed from memory of LeetCode's taxonomy.

**Tradeoff — still an unofficial, scraped API:** LeetCode has no public API contract for
this. It can change shape or rate-limit without notice — the same risk class the old
REST endpoint carried, just with much better data.

**Pagination concurrency — a decision that changed mid-project:** Initially batched at
concurrency 5 (cut a cold fetch from ~30s to ~9.7s), because at the time this fetch still
ran inside a live user request and speed mattered. Once §4 decoupled it into a background
job, I re-tested and found **concurrent requests get throttled far more aggressively
than sequential ones** — a live test showed 2 of 5 concurrent requests timing out while
a lone sequential request succeeded in under a second. Reverted to fully sequential
(`PAGE_CONCURRENCY = 1`) with a small per-page retry (3 attempts, backoff) — ~37s for a
full cold fetch, zero failures. **The lesson: an optimization justified by one constraint
(request-path latency) became actively wrong once that constraint was removed (background
job) — reliability matters more than speed when nobody's watching the clock.**

**Caching:** in-memory, 1-hour TTL. Matters less now that the only caller is the §4 sync
job (which runs every 6 hours anyway, always past the TTL) — kept as a harmless safety
net for any future caller, not because it's load-bearing anymore.

**Files:** `utils/leetcode.js` — `fetchLeetCodePool()`, `fetchQuestionContent(slug)`.

**Say this:** "I validated this against the live endpoint before trusting it — confirmed
the response shape, found the server clamps page size regardless of what you ask for, and
surveyed the real catalog to ground the tag-mapping table in actual data instead of
memory. I also caught myself mid-project: I'd optimized pagination for concurrency to
protect a request path that a later change (the background job) made irrelevant, and
concurrent requests turned out to be *less* reliable against this endpoint anyway —
worth catching, since an optimization can quietly become the wrong tradeoff once its
original justification disappears."

---

## 2. Rebuilding the Classification Cascade

**What:** Two tiers, replacing the old regex + BERT pair:

1. **Primary — real LeetCode tags → app buckets.** `utils/leetcodeTagMap.js` maps
   LeetCode's topic-tag slugs onto this app's 15-topic taxonomy (Array, String, Hashing,
   Stack, Queue, LinkedList, Tree, Graph, DP, BinarySearch, TwoPointers, Matrix, Math,
   Database, Other). Deterministic, free, no API call.
2. **Fallback — Groq LLM, only for the residual.** `services/aiTagger.js` calls
   `openai/gpt-oss-120b` on Groq, given the *real* problem description (fetched on
   demand) plus LeetCode's original raw tags as a hint, forced into the same closed
   label set via JSON mode.

**Validated, not assumed, before shipping:**
- Ran the mapping against the real 2,458-problem catalog: **95.3% resolved on the
  primary tier alone** (2,343 problems), matching what I predicted from the tag survey
  before writing a line of ingestion code.
- Inspected what falls to the residual: shell-scripting problems, pure
  bit-manipulation, pure backtracking/design — genuinely outside this app's 15-bucket
  taxonomy, not classification failures. No amount of better ML makes a shell script
  into "Array".
- **Deliberately tested the LLM tier against adversarial cases**, not just plausible
  ones: fed it a shell-script problem (initially mislabeled `Hashing`) and a
  heap/ordered-set design problem (initially hallucinated `Tree` — twice, even after the
  first prompt fix explicitly named this exact failure mode). Fixed by (a) passing
  LeetCode's raw tags as context instead of hiding them, and (b) adding an explicit
  "don't infer Tree just because a structure is tree-backed internally" rule. Reverified
  clean after.

**Why "Other" is now a *resolved* state, not a *pending* one:** this is the key
correctness fix in `ingestProblem`. A successful LLM call — even one that confidently
returns `["Other"]` — is stored as `aiStatus: 'completed'`. Only a **thrown error**
(network/timeout/rate-limit/malformed JSON) is `'pending'`. The old code conflated "the
model looked and said no" with "we don't know yet" — conflating those meant retrying a
confident, correct "no" forever for no reason. `jobs/retryJobs.js` was rewritten to match:
it now only ever retries genuine call failures, never re-asks a resolved question.

**Why the middle tier ("rules on real description text") from the original plan got
cut:** originally planned as a cheap tier between tag-mapping and the LLM, to save LLM
calls. Once the tag-mapping validation showed only ~115 problems (4.7%) ever reach the
residual, that tier would save a negligible number of LLM calls while adding a whole
extra code path to maintain. Cut for being complexity without payoff — confirmed by the
data, not assumed upfront.

**Tradeoff — SHA-256-style ground truth vs. genuine ambiguity:** the LLM tier isn't
perfect (accepted `Math` for pure bit-manipulation problems as a defensible-if-debatable
read, rather than chasing every edge case into an ever-longer prompt). Prompt-tuning
against individual test cases has diminishing, then negative, returns — fixed the two
*clearly wrong* cases (shell→Hashing, design→Tree hallucination), then stopped rather
than overfit the prompt to a handful of examples.

**Files:** `utils/leetcodeTagMap.js` (new), `services/aiTagger.js` (rewritten, Groq
replaces Hugging Face/BERT entirely), `utils/problemIngestion.js` (`ingestProblem`
rewritten around the two-tier cascade), `jobs/retryJobs.js` (rewritten retry semantics).

**Say this:** "The classification cascade is real LeetCode tags first — deterministic,
free, validated against the actual catalog at 95% coverage — with an LLM fallback only
for the genuine residual, and I stress-tested that fallback against cases specifically
chosen because they're easy to get wrong, not just cases it was likely to get right. I
also fixed a state-modeling bug: the old code treated 'the AI confidently said this
doesn't fit any bucket' the same as 'we don't know yet' — those are different things, and
conflating them meant retrying a correct answer forever."

---

## 3. Full-Catalog Seed

**What:** `scripts/seedProblems.js` — a one-time, resumable script that ingests the
entire free Easy/Medium catalog (2,458 problems) up front, instead of letting the pool
grow sparsely through organic contest-creation traffic.

**Why now, not later:** before this ran, the DB had **zero** problem rows — the first
real user to create a contest would have triggered the very first ingestion, live,
inside their request. Seeding manually first meant validating the whole rebuilt pipeline
at full scale, watched, before handing it to an unattended background job (§4).

**Result:**
```
Total in pool:        2458
Newly ingested:       2458
  -> via LeetCode tags (no LLM call): 2343  (95.3%, exactly as predicted)
  -> via Groq LLM fallback tier:      87
  -> queued for retry (LLM errored):  28
  -> resolved to "Other":             63
Hard failures:        0
```

**Diagnosing the 28, not just shrugging at them:** all 28 shared one property —
completely empty `leetcodeTags`. Re-running the same slugs individually afterward
succeeded instantly with no error, ruling out a content/query bug. The real cause: these
are LeetCode's **"30 Days of JavaScript"** and Pandas/data-processing tracks (`Event
Emitter`, `Promise Time Limit`, `Compact Object`, `Reshape Data: Melt`, ...) — both ship
with zero topic tags from LeetCode, and both cluster as long runs of consecutive problem
IDs. Hitting that cluster during the sequential seed meant a long run of *consecutive*
LLM calls with none of the normal pacing gaps (the other 95% of problems skip the LLM
entirely), which grazed Groq's rate limit. Not a data-quality problem — a scheduling one,
and one the existing `pending` → retry-job path already exists to self-heal.

**Files:** `scripts/seedProblems.js` (new).

**Say this:** "Before assuming '28 failures, must be flaky,' I checked what they had in
common — all empty tags — and traced it to a specific LeetCode content track that
clusters together and lacks tags, which explains the rate-limit graze during sequential
processing. That's a scheduling artifact the retry job already handles, not a
classification defect."

---

## 4. Decoupling Ingestion From Contest Creation

**What:** `ensureProblemsAvailable` (called inside `POST /create-contest`) is now a
**pure DB read** — it counts matching problems and returns `true`, or throws if there
genuinely aren't enough. It never calls LeetCode live. A new background job,
`syncNewProblems()`, is the only thing that talks to LeetCode — it diffs the live
catalog against what's in the DB and ingests just the difference.

**Why:** Previously, any user whose contest needed problems the DB didn't have yet would
block their own request on a live LeetCode scrape (many seconds) plus synchronous
classification of up to 20 problems. Unpredictable latency landing on a random user is
exactly the failure mode a background job exists to prevent.

**Why throwing (not silently ingesting) is correct now:** once the catalog is fully
synced, "not enough problems for this exact filter combination" means there genuinely
aren't enough — a live scrape wouldn't find anything the sync job hasn't already seen.
Falling through to on-demand ingestion here would just reintroduce the latency problem
this phase exists to remove.

**Bootstrap behavior:** `syncNewProblems()` runs once immediately at server startup (so
a fresh/empty DB — a wiped table, a new environment — self-populates with no manual
seed script needed) and then every 6 hours afterward to catch newly-added LeetCode
problems. It runs in the background after `app.listen()`, so it never delays the server
becoming ready to accept requests — a freshly-deployed empty DB just returns "not enough
problems" for a brief window on its very first startup, a one-time cost, not a recurring
one.

**Files:** `utils/problemIngestion.js` (`ensureProblemsAvailable` rewritten,
`syncNewProblems` added), `server.js` (startup + 6-hour interval), `utils/leetcode.js`
(the concurrency reversal from §1, discovered while testing this).

**Say this:** "The request path that creates a contest never talks to LeetCode anymore —
it's a count query against the DB. A separate background job, running at startup and
every six hours, is solely responsible for keeping that DB stocked. That split is what
actually fixes the latency problem — not making the live fetch faster, but removing it
from the request path entirely."

---

## Known Limitations (roadmap, in priority order)

```
1. Groq's free tier (30 req/min, 1K/day) is comfortably sufficient at current volume
   (~115-120 LLM calls per full catalog, ~5% of any incremental new-problem batch) but
   worth monitoring if the catalog or contest volume grows significantly.
2. No support for Hard-difficulty problems -- unchanged from the original app scope,
   not a regression, just worth naming as a boundary.
3. The in-memory pool cache (utils/leetcode.js) is per-process -- fine for a single
   server instance, would need to move to a shared cache (Redis) if this ever runs
   horizontally scaled, same caveat as the in-memory rate limiter documented in
   AUTH_ARCHITECTURE.md.
4. No automated tests for this pipeline yet -- verified via targeted smoke tests against
   the live DB and live LeetCode API throughout development, cleaned up after each, but
   nothing regression-proofing it long-term.
```

## Quick Reference: Full Current Ingestion Flow

```
Server startup / every 6 hours
  -> syncNewProblems()
       fetch live LeetCode catalog (sequential, real topic tags)
       diff against what's already in the DB
       ingestProblem() each new one:
         map real tags -> app buckets (~95% resolve here, no API call)
         unresolved -> fetch real description -> Groq LLM call (closed label set)
         LLM call throws -> aiStatus 'pending' (retried later, genuine failures only)
         LLM call succeeds (even with "Other") -> aiStatus 'completed'

Every 60 seconds
  -> retryPendingAITags()
       retries only problems whose LLM call previously threw
       3 attempts, then aiStatus 'failed'

POST /create-contest
  -> ensureProblemsAvailable(filters, count)
       pure DB count query
       enough? -> proceed
       not enough? -> throw (the background job already looked; there isn't more)
```
