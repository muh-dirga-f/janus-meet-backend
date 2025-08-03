import axios from 'axios';

const JANUS_ADMIN_URL = process.env.JANUS_ADMIN_URL;
if (!JANUS_ADMIN_URL) throw new Error('JANUS_ADMIN_URL must be set');

export async function createJanusRoom(): Promise<void> {
    await axios.post(`${JANUS_ADMIN_URL}/admin`, {
        request: 'create',
        room: Math.floor(Math.random() * 1000000), // random roomId
        publishers: 20,
        video_codec: 'vp9',
        videocodec: 'h264',
        simulcast: true,
    });
}
