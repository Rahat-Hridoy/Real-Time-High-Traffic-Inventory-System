import express from 'express';
import cors from 'cors';
import reservationRouter from './routes/reservation';

const app = express();

// Allow requests from local dev and the deployed Vercel frontend.
// Set FRONTEND_URL env variable on Railway to your Vercel deployment URL.
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server calls (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Simple logging middleware to track request handling
app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.path} - Parameters:`, req.body);
  next();
});

app.use('/api', reservationRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
});

export default app;
