import { describe, it, expect, vi, beforeEach } from 'vitest';

// Explicit factory, same convention this codebase already uses for sendEmail.js/
// leetcode.js -- not axios's own automock, which is unreliable for a module this shaped
// (interceptors, defaults, etc.).
vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}));

const JAVA_CPP_LANGUAGES = [
  { id: 26, name: 'C++ (Clang 7.0.1)' },
  { id: 91, name: 'Java (JDK 17.0.6)' },
  { id: 54, name: 'C++ (GCC 9.2.0)' }
];

// languageIdCache is module-level, unexported, mutable state -- vi.resetModules() +
// a fresh dynamic import per test is the standard way to get a clean instance each
// time without that cache bleeding between tests (a plain top-level import would keep
// whatever got cached in an earlier test, making later tests describe stale behavior).
let axios;
let getLanguageId;
let submitToJudge0;

beforeEach(async () => {
  vi.resetModules();
  process.env.JUDGE0_URL = 'http://fake-judge0.test';
  process.env.JUDGE0_AUTH_TOKEN = 'fake-token';
  axios = (await import('axios')).default;
  axios.get.mockReset();
  axios.post.mockReset();
  ({ getLanguageId, submitToJudge0 } = await import('./judgeClient.js'));
});

describe('getLanguageId', () => {
  it('calls GET /languages with the auth token header', async () => {
    axios.get.mockResolvedValue({ data: JAVA_CPP_LANGUAGES });
    await getLanguageId('java');
    expect(axios.get).toHaveBeenCalledWith(
      'http://fake-judge0.test/languages',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Auth-Token': 'fake-token' }) })
    );
  });

  it('picks the first language whose name matches the prefix, case-insensitively', async () => {
    axios.get.mockResolvedValue({ data: JAVA_CPP_LANGUAGES });
    const id = await getLanguageId('cpp');
    // Two "C++" entries exist (Clang first, GCC second) -- must resolve to whichever
    // is first in the live instance's own list, same real auto-detection behavior
    // that caused the actual C++17 bug this test guards against regressing.
    expect(id).toBe(26);
  });

  it('caches the result -- a second call does not hit the network again', async () => {
    axios.get.mockResolvedValue({ data: JAVA_CPP_LANGUAGES });
    await getLanguageId('java');
    await getLanguageId('cpp');
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when no language matches the prefix', async () => {
    axios.get.mockResolvedValue({ data: [{ id: 1, name: 'Python (3.8.1)' }] });
    await expect(getLanguageId('java')).rejects.toThrow(/No Judge0 language found matching "java"/);
  });

  it('throws when JUDGE0_URL/JUDGE0_AUTH_TOKEN are not configured', async () => {
    delete process.env.JUDGE0_URL;
    await expect(getLanguageId('java')).rejects.toThrow(/Judge0 is not configured/);
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('submitToJudge0', () => {
  it('POSTs to /submissions with base64_encoded=false and wait=true, with auth header', async () => {
    axios.post.mockResolvedValue({ data: { status: { id: 3 }, stdout: 'ok' } });
    await submitToJudge0({ sourceCode: 'int main(){}', languageId: 54 });
    expect(axios.post).toHaveBeenCalledWith(
      'http://fake-judge0.test/submissions?base64_encoded=false&wait=true',
      expect.objectContaining({ source_code: 'int main(){}', language_id: 54 }),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Auth-Token': 'fake-token' }) })
    );
  });

  it('omits compiler_options from the body when not passed', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await submitToJudge0({ sourceCode: 'code', languageId: 1 });
    const [, body] = axios.post.mock.calls[0];
    expect(body).not.toHaveProperty('compiler_options');
  });

  // The real bug this locks in: the C++17 fix only works if compiler_options actually
  // makes it into the request body when the caller passes it.
  it('includes compiler_options in the body when passed', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await submitToJudge0({ sourceCode: 'code', languageId: 54, compilerOptions: '-std=c++17' });
    const [, body] = axios.post.mock.calls[0];
    expect(body.compiler_options).toBe('-std=c++17');
  });

  it('returns the response data as-is, unmodified', async () => {
    const fakeResult = { status: { id: 3 }, stdout: 'output\n', compile_output: null };
    axios.post.mockResolvedValue({ data: fakeResult });
    const result = await submitToJudge0({ sourceCode: 'code', languageId: 1 });
    expect(result).toEqual(fakeResult);
  });
});
