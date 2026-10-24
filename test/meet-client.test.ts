import { describe, expect, it, vi } from 'vitest';
import { createMeetClient, MeetApiError } from '../src/server/meet-client.js';

function fakeFetch(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

describe('createMeetClient', () => {
  it('creates an instant room with the tenant key in x-api-key', async () => {
    const f = fakeFetch(201, { id: 'room-1', name: 'n', status: 'WAITING' });
    const meet = createMeetClient({ baseUrl: 'https://api.example/api/v1/', apiKey: 'k_test', fetch: f });

    const room = await meet.createRoom({ name: 'Standup', createdByExternalId: 'user-1' });

    expect(room.id).toBe('room-1');
    const [url, maybeInit] = f.mock.calls[0]!;
    const init = maybeInit!;
    expect(url).toBe('https://api.example/api/v1/rooms');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('k_test');
    expect(JSON.parse(String(init.body))).toEqual({
      type: 'INSTANT',
      enablePreJoin: true,
      name: 'Standup',
      createdByExternalId: 'user-1',
    });
  });

  it('encodes the room id when joining', async () => {
    const f = fakeFetch(200, { joinUrl: 'https://meet.example/join/abc', waitingForApproval: false });
    const meet = createMeetClient({ baseUrl: 'https://api.example/api/v1', apiKey: 'k', fetch: f });

    await meet.joinRoom('a/b', { externalUserId: 'u', displayName: 'Ada' });

    expect(f.mock.calls[0]![0]).toBe('https://api.example/api/v1/rooms/a%2Fb/join');
  });

  it('reports an unreachable API as status 0', async () => {
    const offline = vi.fn<typeof fetch>(async () => Promise.reject(new TypeError('fetch failed')));
    const meet = createMeetClient({ baseUrl: 'https://api.example', apiKey: 'k', fetch: offline });

    await expect(meet.createRoom({ name: 'n', createdByExternalId: 'u' })).rejects.toMatchObject({
      status: 0,
      operation: 'createRoom',
    });
  });

  it('throws MeetApiError with status and operation on non-2xx', async () => {
    const meet = createMeetClient({ baseUrl: 'https://api.example', apiKey: 'k', fetch: fakeFetch(403, {}) });

    await expect(meet.joinRoom('r', { externalUserId: 'u', displayName: 'Ada' })).rejects.toMatchObject({
      name: 'MeetApiError',
      status: 403,
      operation: 'joinRoom',
    });
    await expect(meet.joinRoom('r', { externalUserId: 'u', displayName: 'Ada' })).rejects.toBeInstanceOf(
      MeetApiError,
    );
  });
});
