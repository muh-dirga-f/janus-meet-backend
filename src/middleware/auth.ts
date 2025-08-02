import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set');

export interface AuthRequest extends Request {
  user?: { id: string; name: string; email: string };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void | Response {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });

  jwt.verify(token, JWT_SECRET as string, (err, payload) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = payload as any;
    next();
  });
}
