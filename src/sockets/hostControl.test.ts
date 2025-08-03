import { createServer } from 'http';
import { Server } from 'socket.io';
import Client from 'socket.io-client';
import { setupSocketServer } from './index';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const hostUser = {
    id: 'host-id',
    name: 'Host User',
    email: 'host@example.com',
};

const guestUser = {
    id: 'guest-id',
    name: 'Guest User',
    email: 'guest@example.com',
};

const hostToken = jwt.sign(hostUser, process.env.JWT_SECRET!, { expiresIn: '1h' });
const guestToken = jwt.sign(guestUser, process.env.JWT_SECRET!, { expiresIn: '1h' });

let httpServer: any;
let ioServer: Server;
let port: number;

beforeAll(async () => {
    httpServer = createServer();
    ioServer = new Server(httpServer, { path: '/ws' });
    setupSocketServer(ioServer);

    await new Promise<void>((resolve) => {
        const listener = httpServer.listen(() => {
            port = (listener.address() as any).port;
            resolve();
        });
    });

    await prisma.message.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.createMany({
        data: [hostUser, guestUser].map((u) => ({ ...u, password: 'dummy' })),
    });

    await prisma.room.create({
        data: {
            id: 'room-host-test',
            title: 'Host Test Room',
            hostId: hostUser.id,
        },
    });
});

afterAll(async () => {
    ioServer.close();
    httpServer.close();
    await prisma.$disconnect();
});

test('Only host can emit forced-mute', (done) => {
    const roomId = 'room-host-test';

    const guestClient = Client(`http://localhost:${port}`, {
        path: '/ws',
        auth: { token: guestToken },
    });

    guestClient.once('connect', () => {
        guestClient.emit('join-room', { roomId });

        guestClient.once('error', (err: any) => {
            try {
                expect(err).toHaveProperty('message', 'Only host can mute others');
            } catch (e) {
                done.fail(e instanceof Error ? e.message : String(e));
            } finally {
                guestClient.disconnect();
                done();
            }
        });

        // Guest tries to send forbidden action
        guestClient.emit('forced-mute');
    });
});

test('Host can emit room-ended → guest receives it', (done) => {
    const roomId = 'room-host-test';

    const guestClient = Client(`http://localhost:${port}`, {
        path: '/ws',
        auth: { token: guestToken },
    });

    guestClient.once('connect', () => {
        guestClient.emit('join-room', { roomId });

        guestClient.once('room-ended', () => {
            try {
                expect(true).toBe(true); // passed if triggered
            } catch (e) {
                done.fail(e instanceof Error ? e.message : String(e));
            } finally {
                guestClient.disconnect();
                hostClient.disconnect();
                done();
            }
        });

        const hostClient = Client(`http://localhost:${port}`, {
            path: '/ws',
            auth: { token: hostToken },
        });

        hostClient.once('connect', () => {
            hostClient.emit('join-room', { roomId });

            setTimeout(() => {
                hostClient.emit('room-ended');
            }, 100); // give time to guest to subscribe
        });
    });
});
