import dotenv from 'dotenv';

// Must happen before anything that reads process.env at module-top-level scope
// (utils/database.js's PrismaClient, utils/redisClient.js's ioredis instance, etc.).
// A plain top-of-file `import app from './app.js'` would NOT be safe here even placed
// after this call -- ES module imports are hoisted and fully evaluated before any of
// this file's own top-level statements run, dotenv.config() included, regardless of
// their textual order. A dynamic import() is a real expression evaluated in place, so
// it's the only way to guarantee dotenv.config() has already run first. (Verified this
// ordering hazard is real, not theoretical, with a standalone repro before relying on
// this fix.) In production this doesn't matter -- Render injects real env vars directly
// into process.env, dotenv.config() is a no-op there -- but local dev via Backend/.env
// depends on it.
dotenv.config();

const { default: app } = await import('./app.js');
const { prisma } = await import('./utils/database.js');
const { closeAllConnections } = await import('./services/contestEvents.js');
const { logger } = await import('./utils/logger.js');

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log('Backend listening on', PORT)

    // Only start background jobs if DATABASE_URL is available -- and never in the e2e
    // Playwright run, which boots this exact process against a fresh, empty throwaway
    // Postgres purely to serve a handful of seeded fake problems. Without this, every
    // e2e CI run (and any local Playwright run) would trigger syncNewProblems() finding
    // the whole real LeetCode catalog "missing" and re-fetch all ~2,458 problems from
    // LeetCode's live API on every single push/PR -- real, unnecessary third-party API
    // traffic the test doesn't need, discovered only after it had already been
    // happening silently on passing CI runs.
    if (process.env.DATABASE_URL && !process.env.DISABLE_BACKGROUND_JOBS) {
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
        console.log(process.env.DISABLE_BACKGROUND_JOBS
            ? 'DISABLE_BACKGROUND_JOBS set - background jobs disabled'
            : 'DATABASE_URL not found - background jobs disabled');
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
    logger.fatal({ err }, 'Uncaught Exception')
    gracefulShutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled Rejection')
    gracefulShutdown('unhandledRejection')
})
