import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.js';
import { createMeetClient } from './meet-client.js';

const apiKey = process.env.MEET_API_KEY;
if (!apiKey) {
  console.error('MEET_API_KEY is not set. Copy .env.example to .env and add your tenant API key.');
  process.exit(1);
}

const meet = createMeetClient({
  baseUrl: process.env.MEET_API_URL ?? 'https://api.meet.etite.tech/api/v1',
  apiKey,
});

const app = createApp({ meet });
// In production the same process serves the built page (pnpm build && pnpm start).
app.use('/*', serveStatic({ root: './dist/client' }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`quickstart server on http://localhost:${port}`));
