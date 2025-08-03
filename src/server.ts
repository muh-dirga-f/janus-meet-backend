import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { setupSocketServer } from './sockets';
import authRoutes from './routes/auth';
import roomRoutes from './routes/room';

dotenv.config();
export const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

const prisma = new PrismaClient();

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('Database connection error:', e);
    res.status(500).json({ status: 'db error' });
  }
});

const server = http.createServer(app);
const io = new IOServer(server, { path: '/ws' });

setupSocketServer(io);

io.on('connection', (socket) => {
  console.log('client connected:', socket.id);
});

if (require.main === module) {
  const PORT = process.env.PORT ?? 3000;
  server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

export { server };
