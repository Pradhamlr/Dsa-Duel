import { describe, it, expect, vi } from 'vitest';
import { selectContestProblems, buildExclusionTiers, selectWithTieredFallback } from './contestProblemSelection.js';

const problem = (id, overrides = {}) => ({
  id,
  title: `Problem ${id}`,
  leetcodeId: `slug-${id}`,
  difficulty: 'Easy',
  leetcodeUrl: `https://leetcode.com/problems/slug-${id}/`,
  finalTags: ['Array'],
  judgeSupported: true,
  codeSnippets: {},
  ...overrides
});

describe('selectContestProblems', () => {
  it('returns null instead of throwing when there are not enough matches', async () => {
    const prisma = { problem: { findMany: vi.fn().mockResolvedValue([problem(1), problem(2)]) } };
    const result = await selectContestProblems(prisma, { difficulty: 'Easy', selectedTopics: [], pool: null, problemCount: 5 });
    expect(result).toBeNull();
  });

  it('returns exactly problemCount problems, mapped to contest format', async () => {
    const prisma = { problem: { findMany: vi.fn().mockResolvedValue([problem(1), problem(2), problem(3)]) } };
    const result = await selectContestProblems(prisma, { difficulty: 'Easy', selectedTopics: [], pool: null, problemCount: 2 });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({ title: expect.any(String), slug: expect.any(String) }));
  });

  it('never leaks testCases into the client-facing shape', async () => {
    const prisma = { problem: { findMany: vi.fn().mockResolvedValue([problem(1, { testCases: [{ input: {}, output: 1 }] })]) } };
    const [result] = await selectContestProblems(prisma, { difficulty: 'Easy', selectedTopics: [], pool: null, problemCount: 1 });
    expect(result.testCases).toBeUndefined();
  });

  it('omits codeSnippets for problems the judge doesn\'t support', async () => {
    const prisma = { problem: { findMany: vi.fn().mockResolvedValue([problem(1, { judgeSupported: false, codeSnippets: { java: '...' } })]) } };
    const [result] = await selectContestProblems(prisma, { difficulty: 'Easy', selectedTopics: [], pool: null, problemCount: 1 });
    expect(result.codeSnippets).toBeUndefined();
  });

  it('does not filter by difficulty when Mixed is requested', async () => {
    const findMany = vi.fn().mockResolvedValue([problem(1)]);
    const prisma = { problem: { findMany } };
    await selectContestProblems(prisma, { difficulty: 'Mixed', selectedTopics: [], pool: null, problemCount: 1 });
    expect(findMany.mock.calls[0][0].where.difficulty).toBeUndefined();
  });

  it('passes topic/pool/exclusion filters through to the where clause', async () => {
    const findMany = vi.fn().mockResolvedValue([problem(1)]);
    const prisma = { problem: { findMany } };
    await selectContestProblems(prisma, {
      difficulty: 'Easy',
      selectedTopics: ['Array', 'Hash Table'],
      pool: 'neetcode150',
      problemCount: 1,
      excludeProblemIds: ['x', 'y']
    });
    const where = findMany.mock.calls[0][0].where;
    expect(where.difficulty).toBe('Easy');
    expect(where.finalTags).toEqual({ hasSome: ['Array', 'Hash Table'] });
    expect(where.pools).toEqual({ has: 'neetcode150' });
    expect(where.id).toEqual({ notIn: ['x', 'y'] });
  });
});

describe('buildExclusionTiers', () => {
  it('returns four empty tiers when nobody is in the roster', async () => {
    const prisma = { solvedProblem: { findMany: vi.fn() } };
    const tiers = await buildExclusionTiers(prisma, []);
    expect(tiers).toEqual([[], [], [], []]);
    expect(prisma.solvedProblem.findMany).not.toHaveBeenCalled();
  });

  it('builds recent-any, recent-solved, ever-solved tiers, and an empty final tier', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ problemId: 'a' }, { problemId: 'b' }]) // recent any
      .mockResolvedValueOnce([{ problemId: 'a' }]) // recent solved
      .mockResolvedValueOnce([{ problemId: 'a' }, { problemId: 'c' }]); // ever solved
    const prisma = { solvedProblem: { findMany } };
    const tiers = await buildExclusionTiers(prisma, ['user-1']);
    expect(tiers).toEqual([['a', 'b'], ['a'], ['a', 'c'], []]);
  });

  it('dedupes problem ids within a tier', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ problemId: 'a' }, { problemId: 'a' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const prisma = { solvedProblem: { findMany } };
    const tiers = await buildExclusionTiers(prisma, ['user-1']);
    expect(tiers[0]).toEqual(['a']);
  });
});

describe('selectWithTieredFallback', () => {
  it('uses the strictest tier when it already has enough problems', async () => {
    const prisma = {
      solvedProblem: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ problemId: 'solved-1' }])
          .mockResolvedValueOnce([{ problemId: 'solved-1' }])
          .mockResolvedValueOnce([{ problemId: 'solved-1' }])
      },
      problem: {
        // Excludes solved-1, still has 3 candidates left -- strictest tier suffices.
        findMany: vi.fn().mockResolvedValue([problem(2), problem(3), problem(4)])
      }
    };
    const result = await selectWithTieredFallback(prisma, {
      difficulty: 'Easy', selectedTopics: [], pool: null, problemCount: 3, rosterUserIds: ['u1']
    });
    expect(result).toHaveLength(3);
    expect(prisma.problem.findMany).toHaveBeenCalledTimes(1);
  });

  it('falls through to a looser tier when the strict one doesn\'t have enough', async () => {
    const prisma = {
      solvedProblem: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ problemId: 'p1' }, { problemId: 'p2' }, { problemId: 'p3' }]) // recent any: excludes everything
          .mockResolvedValueOnce([]) // recent solved: excludes nothing
          .mockResolvedValueOnce([]) // ever solved: excludes nothing
      },
      problem: {
        findMany: vi.fn()
          .mockResolvedValueOnce([]) // tier 0 (exclude p1,p2,p3): nothing left
          .mockResolvedValueOnce([problem(1), problem(2), problem(3)]) // tier 1 (no exclusion): enough
      }
    };
    const result = await selectWithTieredFallback(prisma, {
      difficulty: 'Easy', selectedTopics: [], pool: null, problemCount: 3, rosterUserIds: ['u1']
    });
    expect(result).toHaveLength(3);
    expect(prisma.problem.findMany).toHaveBeenCalledTimes(2);
  });

  it('returns null when even the loosest tier has too few matching problems', async () => {
    const prisma = {
      solvedProblem: { findMany: vi.fn().mockResolvedValue([]) },
      problem: { findMany: vi.fn().mockResolvedValue([problem(1)]) }
    };
    const result = await selectWithTieredFallback(prisma, {
      difficulty: 'Easy', selectedTopics: [], pool: null, problemCount: 5, rosterUserIds: ['u1']
    });
    expect(result).toBeNull();
  });
});
