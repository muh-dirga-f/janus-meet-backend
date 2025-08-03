import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function isHost(userId: string, roomId: string): Promise<boolean> {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    return !!room && room.hostId === userId;
}
