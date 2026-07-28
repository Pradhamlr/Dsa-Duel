import { withPrisma } from '../utils/database.js';
import { getLanguageId, submitToJudge0 } from '../services/judgeClient.js';
import { generateJavaProgram, parseJavaOutput, checkSignatureSupported } from '../utils/javaDriverGenerator.js';
import { markResultSolved, buildContestResponse } from './contestController.js';
import { broadcastContestUpdate } from '../services/contestEvents.js';

// Java only for now -- C++'s driver generator is a follow-up, not yet built.
const DRIVERS = {
  java: { generateProgram: generateJavaProgram, parseOutput: parseJavaOutput }
};

const runOrSubmit = async (req, res, { isSubmit }) => {
  const id = req.params.id;
  const { problemIndex, language, code } = req.body || {};
  const userId = req.user.userId;

  const driver = DRIVERS[language];
  if (!driver) {
    return res.status(400).json({ error: `Language "${language}" isn't supported by the judge yet`, code: 'LANGUAGE_NOT_SUPPORTED' });
  }
  if (typeof code !== 'string' || code.trim().length === 0) {
    return res.status(400).json({ error: 'code is required' });
  }

  const result = await withPrisma(async (prisma) => {
    const contest = await prisma.contest.findUnique({ where: { id } });
    if (!contest) return { error: 'not found', status: 404 };
    if (!contest.startTime) return { error: 'contest not started', status: 400 };

    const problemSnapshot = contest.problems[Number(problemIndex)];
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

    const testCases = problem.testCases;
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return { error: 'No test cases available for this problem', status: 400 };
    }

    const program = driver.generateProgram({ userCode: code, functionSignature: problem.functionSignature, testCases });
    const languageId = await getLanguageId(language);
    const judgeResult = await submitToJudge0({ sourceCode: program, languageId });

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
          problemIndex: Number(problemIndex),
          language,
          code,
          verdict,
          testResults
        }
      });

      if (allPassed) {
        await markResultSolved(prisma, { contestId: id, userId, problemIndex: Number(problemIndex), verifiedVia: 'judge' });
        return { verdict, testResults, contest: await buildContestResponse(prisma, contest) };
      }
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
    console.error(err);
    res.status(500).json({ error: 'failed to run code' });
  }
};

export const submitCode = async (req, res) => {
  try {
    await runOrSubmit(req, res, { isSubmit: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to submit code' });
  }
};
