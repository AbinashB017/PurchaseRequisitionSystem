import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';

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
import requisitionRoutes from './routes/requisitions';
app.use('/api/requisitions', requisitionRoutes);
import lifecycleRoutes from './routes/lifecycle';
app.use('/api/requisitions', lifecycleRoutes);
import approverRoutes from './routes/approvers';
app.use('/api/requisitions', approverRoutes);
// Queue routes are nested under /api so we mount them at the top level
app.use('/api', approverRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
