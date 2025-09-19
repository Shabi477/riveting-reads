import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AdminRequest extends Request {
  adminId?: number;
  userRole?: string;
}

export const requireAdmin = (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET;
    
    if (!JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ message: 'Internal server error' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role?: string };
    
    // Check if user has admin role
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.adminId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};