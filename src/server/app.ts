import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { MeetApiError, type MeetClient } from './meet-client.js';

const JoinRequest = z.object({
  displayName: z.string().trim().min(1).max(80),
  /** Join an existing room; omit to start a new one. */
  roomId: z.string().trim().min(1).max(64).optional(),
});

export interface AppOptions {
  meet: MeetClient;
  /**
   * Resolves the signed-in user's id. The quickstart has no auth, so it mints
   * a random id per request; in a real app return your session's user id.
   */
  currentUserId?: () => string;
}

/**
 * The only route a browser needs: POST /api/join. It talks to Meet with the
 * tenant API key and hands back nothing but the participant's join URL.
 */
export function createApp({ meet, currentUserId = () => randomUUID() }: AppOptions) {
  const app = new Hono();

  app.post('/api/join', async (c) => {
    const parsed = JoinRequest.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', issues: z.flattenError(parsed.error).fieldErrors }, 400);
    }
    const { displayName, roomId } = parsed.data;
    const userId = currentUserId();

    try {
      const room = roomId
        ? { id: roomId }
        : await meet.createRoom({ name: `Quickstart call by ${displayName}`, createdByExternalId: userId });
      const joined = await meet.joinRoom(room.id, {
        externalUserId: userId,
        displayName,
        role: roomId ? 'ATTENDEE' : 'HOST',
      });
      if (!joined.joinUrl) return c.json({ error: 'no_join_url' }, 502);
      return c.json({
        roomId: room.id,
        joinUrl: joined.joinUrl,
        waitingForApproval: joined.waitingForApproval,
      });
    } catch (err) {
      if (err instanceof MeetApiError) {
        // Surface which step failed, never the upstream body.
        const status = err.status === 404 ? 404 : 502;
        return c.json(
          { error: 'meet_api_error', operation: err.operation, upstreamStatus: err.status },
          status,
        );
      }
      throw err;
    }
  });

  return app;
}
