import { Room } from '../models/Room';

export const startRoomCleanupJob = () => {
    // Run every 1 minute
    setInterval(async () => {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            // Delete rooms that are idle AND last active > 5 mins ago
            const result = await Room.deleteMany({
                status: 'idle',
                lastActivityAt: { $lt: fiveMinutesAgo }
            });

            if (result.deletedCount > 0) {
                console.log(`[Cron] Cleaned up ${result.deletedCount} idle anonymous rooms.`);
            }
        } catch (error) {
            console.error('[Cron] Error during room cleanup:', error);
        }
    }, 60 * 1000);

    console.log('[Cron] Anonymous room cleanup job started.');
};
