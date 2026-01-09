import express from 'express';
import cors from 'cors';
import errorHandler from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import contestRoutes from './routes/contest.js';
import userRoutes from './routes/user.js';

const app = express();

// CORS configuration
const allowedOrigins = [
  'https://dsa-duel.vercel.app',
  'http://localhost:5173'
]

const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS check, origin:', origin)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    try {
      if (typeof origin === 'string' && origin.endsWith('.vercel.app')) return callback(null, true)
    } catch (e) { /* ignore */ }
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.'
    return callback(new Error(msg), false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
}

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
app.listen(PORT, () => console.log('Backend listening on', PORT));