import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertSafeTestDatabase, assertSafeTestRedis } from './dbSafety.js';

describe('assertSafeTestDatabase', () => {
  const original = process.env.DATABASE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it('throws when DATABASE_URL is unset', () => {
    delete process.env.DATABASE_URL;
    expect(() => assertSafeTestDatabase()).toThrow(/does not look like a local/);
  });

  it('throws for a real, non-local connection string', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:secret@db.abcxyz.supabase.co:5432/postgres';
    expect(() => assertSafeTestDatabase()).toThrow(/does not look like a local/);
  });

  it('does not throw for a localhost connection string', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/dsaduel_test';
    expect(() => assertSafeTestDatabase()).not.toThrow();
  });

  it('does not throw for a 127.0.0.1 connection string', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/dsaduel_test';
    expect(() => assertSafeTestDatabase()).not.toThrow();
  });

  it('is not fooled by "localhost" appearing as a substring of a real hostname', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:secret@localhost.evil.example.com:5432/postgres';
    expect(() => assertSafeTestDatabase()).toThrow(/does not look like a local/);
  });
});

// Same risk, same fix as assertSafeTestDatabase, just for REDIS_URL -- found while
// adding new auth tests, the integration suites' own redis.flushdb() had no equivalent
// guard at all despite REDIS_URL resolving to the real production Upstash instance by
// default (see dbSafety.js's own comment for what that would actually cost: every
// rate-limit counter AND every revoked-session denylist entry, silently un-revoking
// stolen sessions until natural token expiry).
describe('assertSafeTestRedis', () => {
  const original = process.env.REDIS_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  });

  it('throws when REDIS_URL is unset', () => {
    delete process.env.REDIS_URL;
    expect(() => assertSafeTestRedis()).toThrow(/does not look like a local/);
  });

  it('throws for a real, non-local connection string', () => {
    process.env.REDIS_URL = 'rediss://default:secret@some-instance.upstash.io:6379';
    expect(() => assertSafeTestRedis()).toThrow(/does not look like a local/);
  });

  it('does not throw for a localhost connection string', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    expect(() => assertSafeTestRedis()).not.toThrow();
  });

  it('does not throw for a 127.0.0.1 connection string', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6380';
    expect(() => assertSafeTestRedis()).not.toThrow();
  });

  it('is not fooled by "localhost" appearing as a substring of a real hostname', () => {
    process.env.REDIS_URL = 'rediss://default:secret@localhost.evil.example.com:6379';
    expect(() => assertSafeTestRedis()).toThrow(/does not look like a local/);
  });
});
