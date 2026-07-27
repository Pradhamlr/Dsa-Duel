export const REFRESH_COOKIE_NAME = 'duel_refresh_token';

export const getCookieValue = (req, name) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .reduce((match, cookie) => {
      if (match) return match;
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex === -1) return null;
      const key = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);
      return key === name ? decodeURIComponent(value) : null;
    }, null);
};

// Cookie-only by design: the refresh token must never be readable by JS, so there is
// deliberately no req.body/req.validatedBody fallback here.
export const getRefreshTokenFromRequest = (req) => getCookieValue(req, REFRESH_COOKIE_NAME);
