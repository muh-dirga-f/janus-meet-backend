import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createJanusRoom } from '../utils/janus';

const prisma = new PrismaClient();

export const getAllRooms = async (_req: Request, res: Response) => {
    const rooms = await prisma.room.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(rooms);
};

export const getRoomById = async (req: Request, res: Response) => {
    const room = await prisma.room.findUnique({
        where: { id: req.params.id },
        include: {
            host: true,
            messages: {
                include: { user: true },
                orderBy: { ts: 'desc' },
                take: 50,
            },
        },
    });

    if (!room) return res.status(404).json({ message: 'Room not found' });

    // conform to contract
    res.json({
        id: room.id,
        title: room.title,
        createdAt: room.createdAt,
        hostId: room.hostId,
        participants: [room.host], // sementara hanya host
        messages: room.messages,
    });
};

export const createRoom = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { title } = req.body;

    await createJanusRoom();

    const room = await prisma.room.create({
        data: {
            title: title || null,
            hostId: user.id,
        },
    });

    res.json({
        id: room.id,
        title: room.title,
        createdAt: room.createdAt,
    });
};

export const deleteRoom = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });

    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.hostId !== user.id) return res.status(403).json({ message: 'Forbidden' });

    await prisma.room.delete({ where: { id: room.id } });
    res.sendStatus(204);
};
