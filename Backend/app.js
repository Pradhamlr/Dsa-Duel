import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import errorHandler from './middleware/errorHandler.js';
import { prisma } from './utils/database.js';
import { logger } from './utils/logger.js';

import authRoutes from './routes/auth.js';
import contestRoutes from './routes/contest.js';
import userRoutes from './routes/user.js';

// Legacy route compatibility
import { createContest } from './controllers/contestController.js';
import authMiddleware from './middleware/authMiddleware.js';
import validateDto from './middleware/validateDto.js';
import { createContestDto } from './dtos/contestDtos.js';
import { createContestRateLimit } from './middleware/rateLimitMiddleware.js';

// Builds the configured Express app with no side effects (no .listen(), no background
// jobs, no process signal handlers) so it can be imported directly by tests (supertest)
// as well as by server.js's real entrypoint. See server.js for why this split exists
// and why it uses a dynamic import to bring this file in.
const app = express();

// CORS configuration
const allowedOrigins = [
  'https://dsa-duel.vercel.app',
  'http://localhost:5173',
  ...(process.env.EXTRA_ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)
]

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.'
    return callback(new Error(msg), false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
}

// Trust Render's reverse proxy so req.ip is the real client IP, not the proxy's
app.set('trust proxy', 1);

// One structured line per request (method, path, status, duration). userId gets added
// for authenticated routes via req.log.setBindings() in authMiddleware.js itself, not
// a customProps function here -- pino-http calls customProps at two different points
// in the request lifecycle (early binding, then again at response-finish) and
// concatenates pino's pre-serialized binding fragments rather than merging them,
// which produced a literal duplicate "userId" key in the output JSON when tried
// (confirmed with a standalone repro, not assumed). setBindings() mutates the same
// child logger once, at the one point auth actually succeeds, sidestepping that
// entirely. /health is excluded so Render's own periodic health-check polling doesn't
// drown out real request signal.
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/health' }
}));

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

// Render's own health checks (and any future uptime monitoring) hit this -- also
// confirms the DB connection itself is alive, not just that the process is up.
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'error', error: 'Database unreachable' });
  }
});

// Routes
app.use('/auth', authRoutes);
app.use('/contest', contestRoutes);
app.use('/', userRoutes);

app.post('/create-contest', authMiddleware, createContestRateLimit, validateDto(createContestDto), createContest);

// Global error handler
app.use(errorHandler);

export default app;
