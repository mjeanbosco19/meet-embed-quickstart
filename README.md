# ETITE Meet embed quickstart

[![CI](https://github.com/mjeanbosco19/meet-embed-quickstart/actions/workflows/ci.yml/badge.svg)](https://github.com/mjeanbosco19/meet-embed-quickstart/actions/workflows/ci.yml)

A small, complete reference integration for **[`@etiteltd/meet-embed`](https://www.npmjs.com/package/@etiteltd/meet-embed)**: put a full video call inside your own web app with about 200 lines of application code.

- A **backend** route creates a room and gets a join URL for each participant from the [ETITE Meet](https://meet.etite.tech) platform API, using your tenant API key.
- A **page** embeds the hosted call UI with that URL. It shows live call events and offers mute, camera and leave controls.

```
 Browser                          Your backend                     ETITE Meet API
 ───────                          ────────────                     ──────────────
 POST /api/join {displayName} ──▶ POST /rooms          (x-api-key) ──▶ room
                                  POST /rooms/:id/join (x-api-key) ──▶ joinUrl
 ◀── { roomId, joinUrl } ─────────
 embed({ container, joinUrl })  ─────────── iframe: hosted call UI ───────────▶
 call.on('joined' | 'left' | …)  ◀──────────── typed postMessage events ────────
```

## Why it is built this way

- **The API key never reaches the browser.** Only the backend holds `MEET_API_KEY`. The browser receives a short-lived join URL for one participant and nothing else, and a test checks this ([`test/app.test.ts`](test/app.test.ts)).
- **The browser handles no identity data.** Meet only receives your user id (`externalUserId`) and a display name. This demo uses a random id per request; in your app, return the signed-in user's id from `currentUserId` in [`src/server/app.ts`](src/server/app.ts).
- **Errors are predictable and never leak.**

  | Situation | Response |
  |---|---|
  | Invalid input | `400` with field errors |
  | Unknown room | `404` |
  | Meet API down or unreachable | `502`, naming the step that failed |

  Upstream response bodies are never forwarded to the browser.
- **Thin layers.** [`meet-client.ts`](src/server/meet-client.ts) is a typed, ~90-line client for the two calls you need. The route is ~65 lines and the page script ~60.

## Run it

You need Node 22+, pnpm, and a tenant API key from your ETITE Meet console.

```sh
pnpm install
cp .env.example .env        # add MEET_API_KEY
pnpm dev                    # server on :8787, page on http://localhost:5173
```

Open the page, enter a name, and join. To bring a second person in, copy the room id shown above the call, open the page in another browser, and paste it into **Room id**.

For production, run `pnpm build && pnpm start`: one Node process serves both the page and `/api/join`. Serve it over HTTPS, because browsers only grant camera and microphone access to secure pages.

## Use it in your app

```ts
import { embed } from '@etiteltd/meet-embed';

const { joinUrl } = await fetch('/api/join', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ displayName: 'Ada' }),
}).then((r) => r.json());

const call = embed({ container: document.getElementById('call')!, joinUrl });
call.on('joined', () => console.log('in the call'));
call.on('left', () => call.destroy());
```

- **Events:** `ready`, `joined`, `left`, `participant.joined`, `participant.left`, `recording.started`, `recording.stopped`, `error`, or `'*'` for all of them.
- **Commands:** `leave()`, `toggleAudio()`, `toggleVideo()`, `destroy()`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Server (tsx watch) + Vite page with `/api` proxied |
| `pnpm test` | Vitest: API client and route behaviour, with the Meet API mocked |
| `pnpm typecheck` | `tsc` for the page and server configs |
| `pnpm lint` | Biome |
| `pnpm build` / `pnpm start` | Production build and server |

CI runs lint, typecheck, tests and build on every push and pull request.

## Stack

TypeScript · [Hono](https://hono.dev) on Node · Zod · Vite · Vitest · Biome · `@etiteltd/meet-embed` 0.1.1

## License

[Apache-2.0](LICENSE)
