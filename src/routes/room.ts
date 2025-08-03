// src/routes/room.ts
import { Router } from 'express';
import {
    getAllRooms,
    createRoom,
    getRoomById,
    deleteRoom,
} from '../controllers/roomController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', getAllRooms);
router.post('/', createRoom);
router.get('/:id', getRoomById);
router.delete('/:id', deleteRoom);

export default router;
