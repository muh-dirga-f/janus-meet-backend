import { Server as IOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { isHost } from '../utils/room';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET as string;

interface AuthPayload {
    id: string;
    name: string;
    email: string;
}

interface ClientData {
    roomId?: string;
    user: AuthPayload;
}

const clientMap = new Map<string, ClientData>(); // socket.id → info

export function setupSocketServer(io: IOServer) {
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('No token'));

        try {
            const user = jwt.verify(token, JWT_SECRET) as AuthPayload;
            (socket as any).user = user;
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const user = (socket as any).user as AuthPayload;

        socket.on('join-room', async ({ roomId }) => {
            if (!roomId) return;
            clientMap.set(socket.id, { roomId, user });
            socket.join(roomId);

            socket.to(roomId).emit('peer-joined', {
                id: socket.id,
                name: user.name,
            });
        });

        socket.on('leave-room', () => {
            const info = clientMap.get(socket.id);
            if (info?.roomId) {
                socket.leave(info.roomId);
                socket.to(info.roomId).emit('peer-left', { id: socket.id });
                clientMap.delete(socket.id);
            }
        });

        socket.on('janus-signal', ({ to, data }) => {
            io.to(to).emit('janus-signal', {
                from: socket.id,
                data,
            });
        });

        socket.on('chat-send', async ({ text }) => {
            const info = clientMap.get(socket.id);
            if (!info?.roomId || !text) return;

            const message = await prisma.message.create({
                data: {
                    text,
                    roomId: info.roomId,
                    userId: info.user.id,
                },
                include: {
                    user: true,
                },
            });

            io.to(info.roomId).emit('chat-new', message);
        });

        socket.on('disconnect', () => {
            const info = clientMap.get(socket.id);
            if (info?.roomId) {
                socket.to(info.roomId).emit('peer-left', { id: socket.id });
                clientMap.delete(socket.id);
            }
        });

        socket.on('forced-mute', async () => {
            const info = clientMap.get(socket.id);
            if (!info?.roomId) return;

            const isRoomHost = await isHost(info.user.id, info.roomId);
            if (!isRoomHost) {
                socket.emit('error', { message: 'Only host can mute others' });
                return;
            }

            io.to(info.roomId).emit('forced-mute');
        });

        socket.on('room-ended', async () => {
            const info = clientMap.get(socket.id);
            if (!info?.roomId) return;

            const isRoomHost = await isHost(info.user.id, info.roomId);
            if (!isRoomHost) {
                socket.emit('error', { message: 'Only host can end room' });
                return;
            }

            io.to(info.roomId).emit('room-ended');

            // Optional: remove all sockets from room
            const clients = await io.in(info.roomId).fetchSockets();
            for (const s of clients) {
                s.leave(info.roomId);
                clientMap.delete(s.id);
            }
        });
    });
}
