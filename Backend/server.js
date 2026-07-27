import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import errorHandler from './middleware/errorHandler.js';

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
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/contest', contestRoutes);
app.use('/', userRoutes);

// Legacy route compatibility
import { createContest } from './controllers/contestController.js';
import authMiddleware from './middleware/authMiddleware.js';
app.post('/create-contest', authMiddleware, createContest);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
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