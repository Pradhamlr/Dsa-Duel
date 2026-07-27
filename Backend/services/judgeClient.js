import axios from 'axios';

// Language IDs are per-Judge0-instance and can shift between versions/builds, so this
// looks them up from the live instance and caches the result rather than hardcoding a
// guessed ID (verified during setup that this instance's IDs weren't assumed, and a
// future Judge0 upgrade shouldn't silently break this by changing IDs under us).
let languageIdCache = null;

const getConfig = () => {
  const url = process.env.JUDGE0_URL;
  const token = process.env.JUDGE0_AUTH_TOKEN;
  if (!url || !token) {
    throw new Error('Judge0 is not configured (JUDGE0_URL / JUDGE0_AUTH_TOKEN missing)');
  }
  return { url, token };
};

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  'X-Auth-Token': token
});

async function loadLanguageIds() {
  const { url, token } = getConfig();
  const response = await axios.get(`${url}/languages`, { headers: authHeaders(token), timeout: 15000 });

  const languages = response.data || [];
  const find = (prefix) => {
    const match = languages.find((l) => l.name.toLowerCase().startsWith(prefix));
    if (!match) throw new Error(`No Judge0 language found matching "${prefix}"`);
    return match.id;
  };

  return {
    java: find('java'),
    cpp: find('c++')
  };
}

export async function getLanguageId(language) {
  if (!languageIdCache) {
    languageIdCache = await loadLanguageIds();
  }
  const id = languageIdCache[language];
  if (!id) throw new Error(`Unsupported language for judge: ${language}`);
  return id;
}

// Synchronous submission (wait=true) -- same pattern verified manually during Judge0
// setup. Fine at this scale (a handful of test cases per Run/Submit click); Judge0's
// batch endpoint would be the next step if this needs to scale up.
export async function submitToJudge0({ sourceCode, languageId }) {
  const { url, token } = getConfig();

  const response = await axios.post(
    `${url}/submissions?base64_encoded=false&wait=true`,
    { source_code: sourceCode, language_id: languageId },
    { headers: authHeaders(token), timeout: 20000 }
  );

  return response.data;
}
