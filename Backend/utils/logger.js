import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '..', 'logs', 'app.log');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Render (and any future host) captures stdout directly -- writing to a file there
// would just vanish into the container's ephemeral filesystem, never actually read by
// anyone. Local dev is the opposite problem: a terminal full of raw JSON lines nobody
// wants to watch scroll by. Routed to a gitignored file there instead (logs/ and *.log
// are already in .gitignore). Test runs skip the file too -- the logger's already
// silenced below, no reason to also open a file handle every test run.
let destination;
if (!isProduction && !isTest) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  destination = pino.destination(LOG_FILE);
}

// One shared logger for the whole process, same posture as database.js's Prisma client
// and redisClient.js's Redis connection. JSON output always -- this is meant to be
// machine-greppable, not a human-formatted console. `pino-pretty` is a dev-only nicety
// deliberately not wired in: another dependency for a cosmetic difference that doesn't
// matter once this isn't printing to the terminal anymore anyway.
// Silent during tests -- vitest's own pass/fail output is the signal that matters
// there, and pino-http logging every single test request as JSON would drown it out.
export const logger = pino(
  { level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info') },
  destination
);
