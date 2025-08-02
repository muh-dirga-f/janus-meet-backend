import { Router } from 'express';
import cookieParser from 'cookie-parser';
import { register, login, refresh, me } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// pastikan cookieParser di-mount sebelum refresh
router.use(cookieParser());

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', authenticateToken, me);

export default router;
