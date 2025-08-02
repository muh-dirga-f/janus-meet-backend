import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const { JWT_SECRET } = process.env;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set');

const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7h';

function signAccessToken(user: { id: string; name: string; email: string }): string {
  return jwt.sign(user, JWT_SECRET as string, { expiresIn: ACCESS_EXPIRES_IN });
}

function signRefreshToken(user: { id: string; name: string; email: string }): string {
  return jwt.sign(user, JWT_SECRET as string, { expiresIn: REFRESH_EXPIRES_IN });
}

export const register = async (req: Request, res: Response): Promise<Response> => {
  const { name, email, password } = req.body as {
    name: string;
    email: string;
    password: string;
  };

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, password required' });
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
    });

    const payload = { id: user.id, name: user.name, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return res
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        maxAge: 7 * 60 * 60 * 1000,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      })
      .json({ user: payload, accessToken });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    return res.status(400).json({ message: 'email, password required' });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });

  const payload = { id: user.id, name: user.name, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 7 * 60 * 60 * 1000,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    })
    .json({ user: payload, accessToken });
};

export const refresh = async (req: Request, res: Response): Promise<Response> => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({ message: 'No refresh token' });
    }

    const { exp, ...payload } = jwt.verify(token, JWT_SECRET as string) as {
      id: string;
      name: string;
      email: string;
      exp?: number;
    };

    void exp; // to avoid unused variable warning

    const accessToken = signAccessToken(payload);

    return res.json({ accessToken });
  } catch (err: any) {
    console.error('JWT refresh error:', err.message);
    return res.status(403).json({ message: 'Invalid refresh token' });
  }
};

export const me = async (req: Request, res: Response): Promise<Response> => {
  const user = (req as any).user;
  return res.json({ user });
};
