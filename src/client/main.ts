import { embed, type MeetEmbed } from '@etiteltd/meet-embed';

const form = document.querySelector<HTMLFormElement>('#join-form')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const callArea = document.querySelector<HTMLElement>('#call-area')!;
const container = document.querySelector<HTMLDivElement>('#call')!;
const roomLabel = document.querySelector<HTMLSpanElement>('#room-label')!;
const log = document.querySelector<HTMLOListElement>('#log')!;

let call: MeetEmbed | null = null;

function logEvent(event: string, payload: Record<string, unknown> = {}) {
  const item = document.createElement('li');
  const detail = Object.keys(payload).length ? ` ${JSON.stringify(payload)}` : '';
  item.textContent = `${new Date().toLocaleTimeString()}  ${event}${detail}`;
  log.prepend(item);
}

function endCall() {
  call?.destroy();
  call = null;
  callArea.hidden = true;
  form.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const body = {
    displayName: String(data.get('displayName') ?? ''),
    roomId: String(data.get('roomId') ?? '').trim() || undefined,
  };

  statusEl.textContent = 'Requesting a join URL…';
  const res = await fetch('/api/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  if (!res.ok) {
    statusEl.textContent = `Could not join (${result.error ?? res.status}).`;
    return;
  }

  statusEl.textContent = result.waitingForApproval ? 'Waiting for the host to admit you…' : '';
  form.hidden = true;
  callArea.hidden = false;
  roomLabel.textContent = `Room ${result.roomId}`;

  // The only thing the browser ever handles is this short-lived joinUrl.
  call = embed({ container, joinUrl: result.joinUrl });
  call.on('*', (payload, event) => logEvent(event, payload));
  call.on('left', () => endCall());
});

callArea.addEventListener('click', (e) => {
  const cmd = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-cmd]')?.dataset.cmd;
  if (!call || !cmd) return;
  if (cmd === 'leave') call.leave();
  if (cmd === 'toggleAudio') call.toggleAudio();
  if (cmd === 'toggleVideo') call.toggleVideo();
});
