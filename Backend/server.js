import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import errorHandler from './middleware/errorHandler.js';
import { prisma } from './utils/database.js';
import { closeAllConnections } from './services/contestEvents.js';

// Load environment variables first
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import contestRoutes from './routes/contest.js';
import userRoutes from './routes/user.js';

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

// Legacy route compatibility
import { createContest } from './controllers/contestController.js';
import authMiddleware from './middleware/authMiddleware.js';
import validateDto from './middleware/validateDto.js';
import { createContestDto } from './dtos/contestDtos.js';
app.post('/create-contest', authMiddleware, validateDto(createContestDto), createContest);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log('Backend listening on', PORT)

    // Only start AI retry job if DATABASE_URL is available
    if (process.env.DATABASE_URL) {
        import('./jobs/retryJobs.js').then(({ retryPendingAITags }) => {
            setInterval(() => {
                retryPendingAITags().catch(err =>
                    console.error("AI retry job failed:", err)
                );
            }, 60 * 1000);
        });

        // Sweep sessions that have been expired for 30+ days so the table doesn't
        // grow unbounded from stale/abandoned devices.
        Promise.all([
            import('./utils/database.js'),
            import('./services/sessionService.js')
        ]).then(([{ withPrisma }, { deleteExpiredSessions }]) => {
            setInterval(() => {
                withPrisma((prisma) => deleteExpiredSessions(prisma)).catch(err =>
                    console.error("Expired session cleanup failed:", err)
                );
            }, 6 * 60 * 60 * 1000);
        });

        // Keep the problem catalog in sync with LeetCode. Runs once immediately (so a
        // fresh/empty DB self-populates with no manual seed script needed) and then
        // every 6 hours to pick up newly-added LeetCode problems. This is the only
        // thing that talks to LeetCode live -- ensureProblemsAvailable (in the
        // contest-creation request path) is a pure DB read and never blocks on it.
        import('./utils/problemIngestion.js').then(({ syncNewProblems }) => {
            syncNewProblems().catch(err =>
                console.error("Initial problem sync failed:", err.message)
            );
            setInterval(() => {
                syncNewProblems().catch(err =>
                    console.error("Problem sync failed:", err.message)
                );
            }, 6 * 60 * 60 * 1000);
        });
    } else {
        console.log('DATABASE_URL not found - AI retry job disabled');
    }
});

// A Render redeploy sends SIGTERM, not a hard kill -- without this, every open SSE
// connection (which never closes on its own) just gets severed with no warning, and
// Prisma's connection to Postgres is left to whatever cleanup the OS does on process
// exit rather than a clean disconnect. server.close() alone would hang forever waiting
// for the SSE streams to end naturally, so those are explicitly closed first.
async function gracefulShutdown(signal) {
    console.log(`${signal} received, shutting down gracefully...`)
    closeAllConnections()
    server.close(async () => {
        console.log('HTTP server closed')
        await prisma.$disconnect()
        process.exit(0)
    })
    // Safety net in case something (a stuck request, a slow disconnect) keeps the
    // server.close() callback from ever firing -- don't hang a redeploy indefinitely.
    setTimeout(() => {
        console.error('Forced shutdown after timeout')
        process.exit(1)
    }, 10000).unref()
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Without these, an error thrown outside Express's own request-handling try/catch (a
// bad async callback, a stray promise rejection in one of the setInterval jobs above)
// previously had undefined behavior -- Node either crashes with a raw stack trace and
// no cleanup, or an unhandledRejection is silently swallowed and the process limps on
// in a state nothing accounted for. Both cases now log clearly and go through the same
// graceful-shutdown path, so the process manager (Render) restarts it cleanly instead.
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
    gracefulShutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason)
    gracefulShutdown('unhandledRejection')
})