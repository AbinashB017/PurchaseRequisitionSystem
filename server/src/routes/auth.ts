import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN_SECONDS = 24 * 60 * 60; // 24 hours
const BCRYPT_ROUNDS = 12;

/**
 * POST /api/auth/register
 * Creates a new user account. For this internal tool, accepts role and approval_limit directly.
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, approval_limit } = req.body;

    // Validation
    if (!email || !password || !name || !role) {
      res.status(400).json({ error: 'Email, password, name, and role are required' });
      return;
    }

    if (!['requester', 'approver'].includes(role)) {
      res.status(400).json({ error: 'Role must be "requester" or "approver"' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Check for existing user
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    // Validate approval_limit for approvers
    if (role === 'approver' && (approval_limit === undefined || approval_limit === null)) {
      res.status(400).json({ error: 'Approvers must have an approval_limit' });
      return;
    }

    if (role === 'requester' && approval_limit !== undefined && approval_limit !== null) {
      res.status(400).json({ error: 'Requesters cannot have an approval_limit' });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        name,
        role,
        approval_limit: role === 'approver' ? approval_limit : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        approval_limit: true,
        created_at: true,
      },
    });

    // Generate JWT and set cookie
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    res.status(201).json({
      user: {
        ...user,
        approval_limit: user.approval_limit?.toString() ?? null,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user and sets an httpOnly JWT cookie.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate JWT and set cookie
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        approval_limit: user.approval_limit?.toString() ?? null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Clears the JWT cookie.
 */
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
router.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.json({ user: req.user });
});

/**
 * GET /api/auth/approvers
 * Authenticated users only. Returns all users with role=approver,
 * used to populate the approver-assignment dropdown on the detail page.
 */
router.get('/approvers', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const approvers = await prisma.user.findMany({
      where: { role: 'approver' },
      select: { id: true, name: true, email: true, approval_limit: true },
      orderBy: { name: 'asc' },
    });
    res.json(approvers);
  } catch (err) {
    console.error('List approvers error:', err);
    res.status(500).json({ error: 'Failed to list approvers' });
  }
});

export default router;
