import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import requisitionRoutes from './routes/requisitions';
import lifecycleRoutes from './routes/lifecycle';
import approverRoutes from './routes/approvers';
import queueRoutes from './routes/queues';
import exportRoutes from './routes/exports';
import dashboardRoutes from './routes/dashboard';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/requisitions', requisitionRoutes);   // CRUD + search/paginate
app.use('/api/requisitions', lifecycleRoutes);     // submit, approve, reject, order, receive, etc.
app.use('/api/requisitions', approverRoutes);      // /:id/approvers assignments
app.use('/api/queues', queueRoutes);               // /api/queues/submitted, /api/queues/assigned-to-me
app.use('/api', exportRoutes);                     // /api/bulk-approve, /api/export/ordered.csv
app.use('/api', dashboardRoutes);                  // /api/dashboard, /api/alerts, /api/alerts/count

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
