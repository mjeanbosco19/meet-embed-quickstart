import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/server/app.js';
import { MeetApiError, type MeetClient } from '../src/server/meet-client.js';

const API_KEY = 'k_live_super_secret';

function fakeMeet(overrides: Partial<MeetClient> = {}): MeetClient {
  return {
    createRoom: vi.fn(async () => ({ id: 'room-new', name: 'n', status: 'WAITING' as const })),
    joinRoom: vi.fn(async () => ({ joinUrl: 'https://meet.example/join/t0k3n', waitingForApproval: false })),
    ...overrides,
  };
}

function post(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request('/api/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/join', () => {
  it('starts a new room and joins as host when no roomId is given', async () => {
    const meet = fakeMeet();
    const app = createApp({ meet, currentUserId: () => 'user-42' });

    const res = await post(app, { displayName: 'Ada' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      roomId: 'room-new',
      joinUrl: 'https://meet.example/join/t0k3n',
      waitingForApproval: false,
    });
    expect(meet.createRoom).toHaveBeenCalledWith({
      name: 'Quickstart call by Ada',
      createdByExternalId: 'user-42',
    });
    expect(meet.joinRoom).toHaveBeenCalledWith('room-new', {
      externalUserId: 'user-42',
      displayName: 'Ada',
      role: 'HOST',
    });
  });

  it('joins an existing room as attendee without creating one', async () => {
    const meet = fakeMeet();
    const res = await post(createApp({ meet }), { displayName: 'Grace', roomId: 'room-7' });

    expect(res.status).toBe(200);
    expect(meet.createRoom).not.toHaveBeenCalled();
    expect(vi.mocked(meet.joinRoom).mock.calls[0]![1]).toMatchObject({ role: 'ATTENDEE' });
  });

  it('never returns anything but the join payload to the browser', async () => {
    const res = await post(createApp({ meet: fakeMeet() }), { displayName: 'Ada' });
    const text = await res.text();

    expect(text).not.toContain(API_KEY);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(['joinUrl', 'roomId', 'waitingForApproval']);
  });

  it('rejects an invalid body with 400', async () => {
    const res = await post(createApp({ meet: fakeMeet() }), { displayName: '   ' });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('maps an unknown room to 404 and other upstream failures to 502', async () => {
    const notFound = fakeMeet({
      joinRoom: vi.fn(async () => Promise.reject(new MeetApiError(404, 'joinRoom'))),
    });
    const res404 = await post(createApp({ meet: notFound }), { displayName: 'Ada', roomId: 'missing' });
    expect(res404.status).toBe(404);

    const down = fakeMeet({
      createRoom: vi.fn(async () => Promise.reject(new MeetApiError(500, 'createRoom'))),
    });
    const res502 = await post(createApp({ meet: down }), { displayName: 'Ada' });
    expect(res502.status).toBe(502);
    expect(await res502.json()).toEqual({
      error: 'meet_api_error',
      operation: 'createRoom',
      upstreamStatus: 500,
    });
  });

  it('returns 502 when Meet does not issue a join URL', async () => {
    const meet = fakeMeet({ joinRoom: vi.fn(async () => ({ joinUrl: null, waitingForApproval: false })) });
    const res = await post(createApp({ meet }), { displayName: 'Ada' });

    expect(res.status).toBe(502);
  });
});
