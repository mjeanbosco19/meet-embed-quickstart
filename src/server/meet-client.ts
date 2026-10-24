/**
 * Minimal server-side client for the ETITE Meet platform API.
 *
 * Only two calls are needed to embed a call: create a room, then mint a
 * per-participant join URL. Both authenticate with the tenant API key in the
 * `x-api-key` header, so this module must only ever run on your backend.
 */

export interface MeetClientOptions {
  /** Platform API base, e.g. https://api.meet.etite.tech/api/v1 */
  baseUrl: string;
  /** Tenant API key. Never send this to a browser. */
  apiKey: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export interface CreateRoomInput {
  name: string;
  /** Your user id for whoever is creating the room. */
  createdByExternalId: string;
  type?: 'INSTANT' | 'SCHEDULED' | 'PERMANENT';
  enablePreJoin?: boolean;
}

export interface JoinRoomInput {
  /** Your user id; Meet stores no other identity data. */
  externalUserId: string;
  displayName: string;
  role?: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'ATTENDEE' | 'VIEWER';
  /** Where the hosted UI sends people after they leave. */
  returnUrl?: string;
}

export interface Room {
  id: string;
  name: string;
  status: 'WAITING' | 'ACTIVE' | 'ENDED';
}

export interface JoinResult {
  joinUrl: string | null;
  waitingForApproval: boolean;
}

/**
 * A failed platform API call. `status` is the HTTP status, or 0 when the API
 * could not be reached. The response body is kept server-side.
 */
export class MeetApiError extends Error {
  constructor(
    readonly status: number,
    readonly operation: string,
  ) {
    super(`Meet API ${operation} failed with HTTP ${status}`);
    this.name = 'MeetApiError';
  }
}

export function createMeetClient(options: MeetClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetch ?? fetch;

  async function post<T>(path: string, body: unknown, operation: string): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': options.apiKey },
        body: JSON.stringify(body),
      });
    } catch {
      throw new MeetApiError(0, operation);
    }
    if (!res.ok) throw new MeetApiError(res.status, operation);
    return (await res.json()) as T;
  }

  return {
    createRoom(input: CreateRoomInput): Promise<Room> {
      return post<Room>('/rooms', { type: 'INSTANT', enablePreJoin: true, ...input }, 'createRoom');
    },
    joinRoom(roomId: string, input: JoinRoomInput): Promise<JoinResult> {
      return post<JoinResult>(`/rooms/${encodeURIComponent(roomId)}/join`, input, 'joinRoom');
    },
  };
}

export type MeetClient = ReturnType<typeof createMeetClient>;
