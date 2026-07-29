// Runs once per test file, before that file's own module graph is evaluated -- this is
// a Vitest runner-level step, not a same-file ES import, so it's not subject to the
// import-hoisting hazard server.js's dynamic-import fix works around (see server.js).
// DATABASE_URL/REDIS_URL are expected to already be in process.env by the time vitest
// itself is invoked (CI sets them at the job level; local runs pass them the same way
// prisma migrate deploy was verified locally in Phase 1/2).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-real-use';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
