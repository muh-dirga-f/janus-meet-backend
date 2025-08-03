jest.mock('../utils/janus', () => ({
    createJanusRoom: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { app } from '../server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const api = request.agent(app);

let accessToken: string;
let roomId: string;

const testUser = {
    name: 'Room Tester',
    email: 'room@test.com',
    password: 'RoomTest123!',
};

beforeAll(async () => {
    await prisma.message.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();

    const res = await api.post('/api/auth/register').send(testUser).expect(200);
    accessToken = res.body.accessToken;
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('Room Endpoints', () => {
    it('POST /api/rooms → create new room', async () => {
        const res = await api
            .post('/api/rooms')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ title: 'Test Room' })
            .expect(200);

        expect(res.body).toHaveProperty('id');
        expect(res.body.title).toBe('Test Room');
        roomId = res.body.id;
    });

    it('GET /api/rooms → should return list with the new room', async () => {
        const res = await api
            .get('/api/rooms')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body.find((r: any) => r.id === roomId)).toBeDefined();
    });

    it('GET /api/rooms/:id → should return room detail', async () => {
        const res = await api
            .get(`/api/rooms/${roomId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body).toHaveProperty('id', roomId);
        expect(res.body).toHaveProperty('participants');
        expect(Array.isArray(res.body.participants)).toBe(true);
    });

    it('DELETE /api/rooms/:id → should delete if host', async () => {
        await api
            .delete(`/api/rooms/${roomId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(204);
    });

    it('DELETE /api/rooms/:id → should 404 after deletion', async () => {
        await api
            .delete(`/api/rooms/${roomId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(404);
    });
});
