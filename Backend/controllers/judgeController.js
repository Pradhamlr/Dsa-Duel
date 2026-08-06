import { withPrisma } from '../utils/database.js';
import { getLanguageId, submitToJudge0 } from '../services/judgeClient.js';
import { generateJavaProgram, checkSignatureSupported } from '../utils/javaDriverGenerator.js';
import { generateCppProgram } from '../utils/cppDriverGenerator.js';
import { parseJudgeOutput, parseStressTestOutput } from '../utils/judgeOutputParser.js';
import { generateBoundaryTestCases } from '../utils/boundaryTestGenerator.js';
import { markResultSolved, upsertPartialResult, recordProblemInteraction, buildContestResponse } from './contestController.js';
import { broadcastContestUpdate } from '../services/contestEvents.js';

// Output parsing is identical for every language (same wire format), so both drivers
// share parseJudgeOutput rather than each carrying their own copy.
const DRIVERS = {
  java: { generateProgram: generateJavaProgram, parseOutput: parseJudgeOutput },
  cpp: { generateProgram: generateCppProgram, parseOutput: parseJudgeOutput }
};

// Shared by run/submit/stress-test -- all three need the same contest+problem lookup
// and the same "is this problem's shape actually supported" gate before touching Judge0
// at all. Factored out once a third call site needed the identical chain, not
// preemptively.
const loadJudgeContext = async (prisma, { contestId, problemIndex }) => {
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  if (!contest) return { error: 'not found', status: 404 };
  if (!contest.startTime) return { error: 'contest not started', status: 400 };

  const problemSnapshot = contest.problems[problemIndex];
  if (!problemSnapshot) return { error: 'invalid problem index', status: 400 };

  const problem = await prisma.problem.findUnique({ where: { leetcodeId: problemSnapshot.slug } });
  if (!problem || !problem.judgeSupported) {
    return { error: 'This problem does not support the in-app judge', status: 400, code: 'JUDGE_NOT_SUPPORTED' };
  }

  const sigCheck = checkSignatureSupported(problem.functionSignature);
  if (!sigCheck.supported) {
    return {
      error: `This problem's types (${sigCheck.unsupportedTypes.join(', ')}) aren't supported by the judge yet`,
      status: 400,
      code: 'UNSUPPORTED_TYPES'
    };
  }

  return { contest, problem, problemSnapshot };
};

const runOrSubmit = async (req, res, { isSubmit }) => {
  const id = req.params.id;
  const { problemIndex, language, code } = req.validatedBody;
  const userId = req.user.userId;

  // Schema validity (language is "java" or "cpp") and "the driver is actually built yet"
  // are two different checks -- cpp passes the DTO but has no driver implementation.
  const driver = DRIVERS[language];
  if (!driver) {
    return res.status(400).json({ error: `Language "${language}" isn't supported by the judge yet`, code: 'LANGUAGE_NOT_SUPPORTED' });
  }

  const result = await withPrisma(async (prisma) => {
    const ctx = await loadJudgeContext(prisma, { contestId: id, problemIndex });
    if (ctx.error) return ctx;
    const { contest, problem, problemSnapshot } = ctx;

    const testCases = problem.testCases;
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return { error: 'No test cases available for this problem', status: 400 };
    }

    const program = driver.generateProgram({ userCode: code, functionSignature: problem.functionSignature, testCases });
    const languageId = await getLanguageId(language);
    // C++ language IDs are auto-detected from whichever compiler happens to be first
    // in this Judge0 instance's own language list (see judgeClient.js) -- that can be
    // an old default (e.g. Clang 7), whose default standard predates C++17 and doesn't
    // know optional/nullopt at all (the tree/list driver support needs both). Forcing
    // -std=c++17 explicitly here works with either GCC or Clang, regardless of which
    // one ends up matched, so this doesn't need to track a specific instance's IDs.
    const compilerOptions = language === 'cpp' ? '-std=c++17' : undefined;
    const judgeResult = await submitToJudge0({ sourceCode: program, languageId, compilerOptions });

    // A compile error or a non-"Accepted" Judge0-level status means the per-test-case
    // logic never ran at all -- report that directly rather than trying to parse
    // nonexistent stdout as if it were test results.
    if (judgeResult.compile_output) {
      return { verdict: 'compile_error', compileOutput: judgeResult.compile_output };
    }
    if (judgeResult.status?.id !== 3) {
      return { verdict: judgeResult.status?.description || 'error', message: judgeResult.stderr || judgeResult.message || null };
    }

    const testResults = driver.parseOutput(judgeResult.stdout, testCases);
    const allPassed = testResults.length > 0 && testResults.every((t) => t.passed);
    const verdict = allPassed ? 'accepted' : 'wrong_answer';

    if (isSubmit) {
      await prisma.submission.create({
        data: {
          contestId: id,
          userId,
          problemIndex,
          language,
          code,
          verdict,
          testResults
        }
      });

      if (allPassed) {
        await markResultSolved(prisma, { contestId: id, userId, problemIndex, verifiedVia: 'judge', slug: problemSnapshot.slug });
        return { verdict, testResults, contest: await buildContestResponse(prisma, contest) };
      }

      // A real Submit that didn't pass still counts as engaging with this problem --
      // Run doesn't reach here at all (isSubmit only), matching the existing
      // Submission-only-on-Submit precedent. It also now earns partial credit toward
      // standings (best-ever, never downgrades a better score already on file), so the
      // updated contest state needs to go out too, not just on a full pass.
      const testCasesPassed = testResults.filter((t) => t.passed).length;
      await upsertPartialResult(prisma, { contestId: id, userId, problemIndex, testCasesPassed, testCasesTotal: testResults.length });
      await recordProblemInteraction(prisma, { userId, slug: problemSnapshot.slug, status: 'attempted' });
      return { verdict, testResults, contest: await buildContestResponse(prisma, contest) };
    }

    return { verdict, testResults };
  });

  if (result.error) return res.status(result.status).json({ error: result.error, code: result.code });
  if (result.contest) broadcastContestUpdate(id, result.contest);
  res.json(result);
};

export const runCode = async (req, res) => {
  try {
    await runOrSubmit(req, res, { isSubmit: false });
  } catch (err) {
    req.log.error({ err }, 'Judge run failed');
    res.status(500).json({ error: 'failed to run code' });
  }
};

export const submitCode = async (req, res) => {
  try {
    await runOrSubmit(req, res, { isSubmit: true });
  } catch (err) {
    req.log.error({ err }, 'Judge submit failed');
    res.status(500).json({ error: 'failed to submit code' });
  }
};

// Runs the submitted code against auto-generated edge cases (empty, single-element,
// negative, and large inputs) derived from the problem's own type signature -- a
// crash/timeout confidence check, deliberately separate from Run/Submit. There's no
// reference solution for synthetic inputs, so this never touches Submission, Result,
// or SolvedProblem -- it can't score, mark solved, or affect standings, only report
// whether the code held up.
export const stressTest = async (req, res) => {
  try {
    const id = req.params.id;
    const { problemIndex, language, code } = req.validatedBody;

    const driver = DRIVERS[language];
    if (!driver) {
      return res.status(400).json({ error: `Language "${language}" isn't supported by the judge yet`, code: 'LANGUAGE_NOT_SUPPORTED' });
    }

    const result = await withPrisma(async (prisma) => {
      const ctx = await loadJudgeContext(prisma, { contestId: id, problemIndex });
      if (ctx.error) return ctx;
      const { problem } = ctx;

      const stressCases = generateBoundaryTestCases(problem.functionSignature);
      if (stressCases.length === 0) {
        return { error: 'No boundary test cases could be generated for this problem', status: 400 };
      }

      const program = driver.generateProgram({ userCode: code, functionSignature: problem.functionSignature, testCases: stressCases });
      const languageId = await getLanguageId(language);
      const compilerOptions = language === 'cpp' ? '-std=c++17' : undefined;
      const judgeResult = await submitToJudge0({ sourceCode: program, languageId, compilerOptions });

      if (judgeResult.compile_output) {
        return { verdict: 'compile_error', compileOutput: judgeResult.compile_output };
      }
      if (judgeResult.status?.id !== 3) {
        return { verdict: judgeResult.status?.description || 'error', message: judgeResult.stderr || judgeResult.message || null };
      }

      return { results: parseStressTestOutput(judgeResult.stdout, stressCases) };
    });

    if (result.error) return res.status(result.status).json({ error: result.error, code: result.code });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, 'Judge stress test failed');
    res.status(500).json({ error: 'failed to run stress test' });
  }
};
