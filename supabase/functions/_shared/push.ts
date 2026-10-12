// Pure sending logic for the send-push Edge Function. No Deno or Node APIs: the app's
// Vitest, ESLint and tsc check this file, and the Deno function imports it as-is.

export type OutboxRow = {
  id: number;
  title: string;
  body: string;
  data: Record<string, unknown>;
  tokens: string[];
};

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channelId: 'household';
  sound: 'default';
};

export type ExpoTicket =
  { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } };

export type PushResult = {
  sent: number[];
  failed: number[];
  deadTokens: string[];
  error: string | null;
};

// Same shape register_push_token accepts: ExponentPushToken[...] or ExpoPushToken[...].
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

// One message per well-formed token; owner[i] is the outbox row id of messages[i]. Malformed
// tokens are skipped, so a row with only malformed tokens counts as a row without tokens.
export function buildExpoMessages(rows: OutboxRow[]): { messages: ExpoMessage[]; owner: number[] } {
  const messages: ExpoMessage[] = [];
  const owner: number[] = [];
  for (const row of rows) {
    for (const token of row.tokens) {
      if (!EXPO_TOKEN.test(token)) continue;
      messages.push({
        to: token,
        title: row.title,
        body: row.body,
        data: { ...row.data, casa: 'push' },
        channelId: 'household',
        sound: 'default',
      });
      owner.push(row.id);
    }
  }
  return { messages, owner };
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be at least 1');
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function toTicket(value: unknown): ExpoTicket {
  if (isRecord(value) && value.status === 'ok') return { status: 'ok' };
  if (isRecord(value) && value.status === 'error') {
    const ticket: ExpoTicket = { status: 'error' };
    if (typeof value.message === 'string') ticket.message = value.message;
    if (isRecord(value.details) && typeof value.details.error === 'string') {
      ticket.details = { error: value.details.error };
    }
    return ticket;
  }
  return { status: 'error', message: 'invalid ticket' };
}

// Tickets of one Expo request, one per message in order. Expo's `data` is trusted only when
// it is an array with exactly one entry per message; anything else becomes error tickets for
// the whole request, so tickets never shift onto another request's messages and no token is
// declared dead on a guess.
export function alignTickets(messageCount: number, tickets: unknown): ExpoTicket[] {
  if (!Array.isArray(tickets) || tickets.length !== messageCount) {
    const message = Array.isArray(tickets)
      ? `Expo push returned ${tickets.length} tickets for ${messageCount} messages`
      : 'Expo push response without tickets';
    return Array.from({ length: messageCount }, () => ({ status: 'error' as const, message }));
  }
  return tickets.map(toTicket);
}

// A row is sent when any of its tickets is ok, failed when none is. Rows with no messages
// (recipient without tokens) count as sent: there is nothing left to deliver. A missing
// ticket counts as an error so the row is retried.
export function classifyTickets(
  rowIds: number[],
  owner: number[],
  messages: ExpoMessage[],
  tickets: ExpoTicket[],
): PushResult {
  const delivered = new Set<number>();
  const errors = new Map<number, string>();
  const deadTokens: string[] = [];

  owner.forEach((rowId, i) => {
    const ticket = tickets[i];
    if (ticket?.status === 'ok') {
      delivered.add(rowId);
      return;
    }
    const code = ticket?.details?.error;
    if (code === 'DeviceNotRegistered') {
      const token = messages[i]?.to;
      if (token !== undefined) deadTokens.push(token);
    }
    if (!errors.has(rowId)) {
      errors.set(rowId, ticket ? (code ?? ticket.message ?? 'unknown error') : 'missing ticket');
    }
  });

  const sent: number[] = [];
  const failed: number[] = [];
  const failures: string[] = [];
  for (const id of rowIds) {
    const error = errors.get(id);
    if (delivered.has(id) || error === undefined) {
      sent.push(id);
    } else {
      failed.push(id);
      failures.push(`${id}: ${error}`);
    }
  }

  return {
    sent,
    failed,
    deadTokens,
    error: failures.length > 0 ? failures.join('; ') : null,
  };
}

// Non-2xx answer or network failure: every row of the batch gets another attempt.
export function classifyResponse(
  rowIds: number[],
  status: number,
): { sent: []; failed: number[]; deadTokens: []; error: string } {
  return {
    sent: [],
    failed: [...rowIds],
    deadTokens: [],
    error: status > 0 ? `Expo push responded ${status}` : 'Expo push request failed',
  };
}

// True when the request's secret header equals the configured secret, comparing every byte
// whatever the first difference (only the length can leak). No configured secret, no match.
export function sameSecret(given: string | null, expected: string | undefined): boolean {
  if (!expected || given === null) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
