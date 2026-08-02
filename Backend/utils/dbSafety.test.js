import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertSafeTestDatabase } from './dbSafety.js';

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
