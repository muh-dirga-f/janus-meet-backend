import { createServer } from 'http';
import { Server } from 'socket.io';
import Client from 'socket.io-client';
import { setupSocketServer } from './index';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const userPayload = {
    id: 'test-user-id',
    name: 'WS Tester',
    email: 'ws@example.com',
};

const jwtToken = jwt.sign(userPayload, process.env.JWT_SECRET!, {
    expiresIn: '1h',
});

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

    await prisma.user.upsert({
        where: { email: userPayload.email },
        update: {},
        create: {
            id: userPayload.id,
            name: userPayload.name,
            email: userPayload.email,
            password: 'dummy',
        },
    });

    await prisma.room.createMany({
        data: [
            {
                id: 'room-test-1',
                title: 'Test Room 1',
                hostId: userPayload.id,
            },
            {
                id: 'room-test-2',
                title: 'Test Room 2',
                hostId: userPayload.id,
            },
        ],
    });
});

afterAll(async () => {
    ioServer.close();
    httpServer.close();
    await prisma.$disconnect();
});

test('WebSocket relay: chat & peer-joined', (done) => {
    const roomId = 'room-test-1';

    const clientB = Client(`http://localhost:${port}`, {
        path: '/ws',
        auth: { token: jwtToken },
    });

    clientB.once('connect', () => {
        clientB.emit('join-room', { roomId });

        clientB.once('peer-joined', (data: any) => {
            try {
                expect(data).toHaveProperty('id');
                expect(data).toHaveProperty('name', userPayload.name);
            } catch (err) {
                done.fail((err instanceof Error ? err.message : String(err)));
            } finally {
                clientA.disconnect();
                clientB.disconnect();
                done();
            }
        });

        const clientA = Client(`http://localhost:${port}`, {
            path: '/ws',
            auth: { token: jwtToken },
        });

        clientA.once('connect', () => {
            clientA.emit('join-room', { roomId });
        });
    });
});

test('WebSocket: chat-send triggers chat-new broadcast', (done) => {
    const roomId = 'room-test-2';
    const messageText = 'Halo dari A';

    const clientA = Client(`http://localhost:${port}`, {
        path: '/ws',
        auth: { token: jwtToken },
    });

    const clientB = Client(`http://localhost:${port}`, {
        path: '/ws',
        auth: { token: jwtToken },
    });

    let bothConnected = 0;

    const checkReady = () => {
        bothConnected += 1;
        if (bothConnected === 2) {
            clientA.emit('join-room', { roomId });
            clientB.emit('join-room', { roomId });

            clientB.once('chat-new', (msg: any) => {
                try {
                    expect(msg).toHaveProperty('text', messageText);
                    expect(msg.user.email).toBe(userPayload.email);
                } catch (err) {
                    done.fail(err instanceof Error ? err.message : String(err));
                } finally {
                    clientA.disconnect();
                    clientB.disconnect();
                    done();
                }
            });

            clientA.emit('chat-send', { text: messageText });
        }
    };

    clientA.once('connect', checkReady);
    clientB.once('connect', checkReady);
});
