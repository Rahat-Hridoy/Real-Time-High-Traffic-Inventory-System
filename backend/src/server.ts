import express from 'express';
import cors from 'cors';
import reservationRouter from './routes/reservation';

const app = express();

app.use(cors());
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
