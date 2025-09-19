import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

const router = Router();

// Rate limiting for auth endpoints - both IP and email-based
const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes (reduced for development)
  max: 20, // increased limit for development testing
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IPv6-safe IP generator combined with normalized email
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : 'no-email';
    const ip = typeof ipKeyGenerator === 'function' ? ipKeyGenerator(req) : (req.ip || 'unknown-ip');
    return `${ip}:${email}`;
  },
});

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate password strength
const isValidPassword = (password: string): boolean => {
  return Boolean(password && password.length >= 8);
};

// POST /signup - create user, hash password
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Validate password strength
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existingUser.length > 0) {
      // Return generic success message to prevent account enumeration
      return res.status(200).json({ message: 'If the email address is valid, you will receive further instructions.' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await db.insert(users).values({
      email: normalizedEmail,
      passwordHash,
    }).returning({ id: users.id, email: users.email, createdAt: users.createdAt });

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const token = jwt.sign({ userId: newUser[0].id, role: 'user' }, jwtSecret, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        createdAt: newUser[0].createdAt,
      },
      token,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /login - return JWT
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user[0].passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const token = jwt.sign({ userId: user[0].id, role: user[0].role }, jwtSecret, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      user: {
        id: user[0].id,
        email: user[0].email,
        createdAt: user[0].createdAt,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;