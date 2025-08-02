import request from 'supertest';
import { app } from '../server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Auth Endpoints', () => {
  const api = request.agent(app);
  let refreshCookie: string;
  let accessToken: string;
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password123!',
  };

  beforeAll(async () => {
    await prisma.message.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('POST /api/auth/register → should register and set refresh cookie', async () => {
    const res = await api.post('/api/auth/register').send(testUser).expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toMatchObject({
      name: testUser.name,
      email: testUser.email,
    });
    expect(res.body).toHaveProperty('accessToken');
    accessToken = res.body.accessToken;

    const cookies = res.get('set-cookie') as unknown as string[];
    expect(cookies).toBeDefined();

    const raw = cookies.find((c) => c.startsWith('refreshToken='));
    expect(raw).toBeDefined();

    // Simpan hanya bagian "refreshToken=..." (tanpa HttpOnly, Path, dll)
    refreshCookie = raw!.split(';')[0];
    expect(refreshCookie).toMatch(/^refreshToken=/);
  });

  it('POST /api/auth/register → should 409 for duplicate email', async () => {
    await api.post('/api/auth/register').send(testUser).expect(409);
  });

  it('POST /api/auth/login → should login existing user and overwrite refresh cookie', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body).toHaveProperty('accessToken');
    accessToken = res.body.accessToken;

    const cookies = res.get('set-cookie') as unknown as string[];
    expect(cookies).toBeDefined();

    const raw = cookies.find((c) => c.startsWith('refreshToken='));
    expect(raw).toBeDefined();

    refreshCookie = raw!.split(';')[0];
    expect(refreshCookie).toMatch(/^refreshToken=/);
  });

  it('POST /api/auth/login → should 401 with wrong password', async () => {
    await api
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpass' })
      .expect(401);
  });

  it('POST /api/auth/refresh → should issue new accessToken using refresh cookie', async () => {
    const res = await api.post('/api/auth/refresh').set('Cookie', refreshCookie).expect(200);

    expect(res.body).toHaveProperty('accessToken');
    const newAccessToken = res.body.accessToken;
    expect(newAccessToken).toMatch(/^ey/); // simple JWT format check
    expect(typeof newAccessToken).toBe('string');

    // Optional: decode token and validate content
    const decoded = jwt.decode(newAccessToken) as any;
    expect(decoded.email).toBe(testUser.email);
    expect(decoded.name).toBe(testUser.name);

    accessToken = newAccessToken;
  });

  it('POST /api/auth/refresh → should 401 without cookie', async () => {
    await request(app).post('/api/auth/refresh').expect(401);
  });

  it('POST /api/auth/refresh → should 403 for expired token', async () => {
    // Buat refresh token kadaluarsa (1 detik)
    const payload = {
      id: 'dummy-id',
      name: 'Expired User',
      email: 'expired@example.com',
    };

    const expiredToken = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: '1s', // expire cepat
    });

    // Tunggu 2 detik agar token benar-benar expired
    await new Promise((r) => setTimeout(r, 2000));

    // Kirim token expired sebagai cookie
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${expiredToken}`)
      .expect(403);

    expect(res.body).toHaveProperty('message', 'Invalid refresh token');
  });

  it('GET /api/auth/me → should return user info with valid Bearer token', async () => {
    const res = await api
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user).toHaveProperty('id');
  });

  it('GET /api/auth/me → should 401 without token', async () => {
    await api.get('/api/auth/me').expect(401);
  });
});
