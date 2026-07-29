import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.js'],
    // The integration tests share one real Postgres+Redis (not per-file isolated), and
    // each file's beforeEach truncates the whole DB -- running files in parallel (the
    // default) lets one file's reset wipe rows a concurrently-running test in another
    // file is mid-way through using. Unit tests don't need this, but there are few
    // enough tests overall that running everything sequentially costs little.
    fileParallelism: false
  }
});
