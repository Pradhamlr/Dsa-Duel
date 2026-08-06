// Pure date-bucketing/streak logic, independent of Prisma -- takes a list of solve
// timestamps, returns the day-level activity a streak/heatmap view needs. Kept
// separate from userController.js so it's testable without a DB, same convention as
// contestProblemSelection.js's pure helpers.
//
// Day boundaries are UTC calendar days, not per-user local time -- this is a
// personal/friends-scale app with no stored timezone per user, and UTC is the one
// definition every caller (server, tests, a user in any timezone) agrees on without
// guessing. A solve made right at a local midnight can land on the "wrong" UTC day;
// accepted as a known, minor imprecision rather than adding timezone infrastructure
// for a nice-to-have analytics view.
const DAY_MS = 24 * 60 * 60 * 1000;

export function toDayString(date) {
  return date.toISOString().slice(0, 10);
}

// One entry per distinct (day, count of solves that landed on it) -- built from
// SolvedProblem.lastInteractionAt on 'solved' rows. Note this is each problem's LAST
// touch, not necessarily its first solve -- a problem re-touched later (e.g. solved
// again in a different contest) shifts its day forward. Accepted approximation: the
// schema has no separate first-solved timestamp, and revisiting an already-solved
// problem is rare enough in practice not to warrant one just for this view.
export function bucketByDay(timestamps) {
  const counts = new Map();
  for (const ts of timestamps) {
    const day = toDayString(new Date(ts));
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return counts;
}

// Current streak: consecutive days with activity, walking back from today -- but
// still "alive" if today has no activity yet and yesterday does (a streak in
// progress shouldn't read as broken before the day is even over).
// Longest streak: the longest run of consecutive days anywhere in the history.
export function computeStreaks(dayCounts, now = new Date()) {
  const activeDays = new Set(Array.from(dayCounts.keys()).filter((d) => dayCounts.get(d) > 0));
  if (activeDays.size === 0) return { current: 0, longest: 0 };

  const sorted = Array.from(activeDays).sort();
  let longest = 0;
  let run = 0;
  let prevTime = null;
  for (const day of sorted) {
    const dayTime = new Date(day + 'T00:00:00Z').getTime();
    run = prevTime !== null && dayTime - prevTime === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
    prevTime = dayTime;
  }

  const todayStr = toDayString(now);
  const yesterdayStr = toDayString(new Date(now.getTime() - DAY_MS));
  let anchor = null;
  if (activeDays.has(todayStr)) anchor = todayStr;
  else if (activeDays.has(yesterdayStr)) anchor = yesterdayStr;

  let current = 0;
  if (anchor) {
    let cursor = new Date(anchor + 'T00:00:00Z').getTime();
    while (activeDays.has(toDayString(new Date(cursor)))) {
      current += 1;
      cursor -= DAY_MS;
    }
  }

  return { current, longest };
}

// Fixed-length daily series ending today, oldest first -- the shape a calendar-style
// heatmap grid needs (every cell present, including zero-activity days), not just the
// days that had activity.
export function buildDailyHistory(dayCounts, days, now = new Date()) {
  const todayTime = new Date(toDayString(now) + 'T00:00:00Z').getTime();
  const history = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = toDayString(new Date(todayTime - i * DAY_MS));
    history.push({ date, count: dayCounts.get(date) || 0 });
  }
  return history;
}
