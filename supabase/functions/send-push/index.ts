// Drains private.push_outbox through the Expo push service. Woken by the outbox insert
// trigger and by the send-push-retry cron job, both with the shared x-push-secret header.
//
// Each invocation loops claim -> send -> mark until a claim comes back empty, a batch has
// failures, or MAX_BATCHES is reached. Every claimed batch is marked before the next claim, so no batch outlives its
// two-minute lease; if sending fails in any way the whole batch is marked failed (attempts
// grow, a poison row stops after five tries). Only a failing mark_push_result can leave rows
// unmarked, and their lease expiry hands them to the next run.

import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import {
  alignTickets,
  buildExpoMessages,
  chunk,
  classifyResponse,
  classifyTickets,
  sameSecret,
  type ExpoMessage,
  type ExpoTicket,
  type OutboxRow,
  type PushResult,
} from '../_shared/push.ts';

const DEFAULT_EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CLAIM_LIMIT = 100;
const EXPO_BATCH_SIZE = 100;
const MAX_BATCHES = 10;
// A hung Expo request must not outlive the two-minute lease; a timeout is an error ticket.
const EXPO_TIMEOUT_MS = 20_000;

type ClaimedRow = {
  id: number;
  recipient_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  tokens: string[] | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

function errorTickets(count: number, message: string): ExpoTicket[] {
  return Array.from({ length: count }, () => ({ status: 'error' as const, message }));
}

// Sends one Expo batch. Any failure of this batch becomes error tickets for its messages
// only, so a later batch failing never undoes rows an earlier batch already delivered.
async function sendBatch(
  url: string,
  accessToken: string | undefined,
  messages: ExpoMessage[],
): Promise<ExpoTicket[]> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(EXPO_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return errorTickets(messages.length, classifyResponse([], response.status).error);
    }
    const payload = (await response.json()) as { data?: unknown } | null;
    return alignTickets(messages.length, payload?.data);
  } catch (error) {
    return errorTickets(messages.length, `${classifyResponse([], 0).error}: ${errorText(error)}`);
  }
}

async function sendRows(rows: OutboxRow[]): Promise<PushResult> {
  const url = Deno.env.get('EXPO_PUSH_URL') || DEFAULT_EXPO_PUSH_URL;
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || undefined;
  const { messages, owner } = buildExpoMessages(rows);

  const tickets: ExpoTicket[] = [];
  for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
    tickets.push(...(await sendBatch(url, accessToken, batch)));
  }

  return classifyTickets(
    rows.map((row) => row.id),
    owner,
    messages,
    tickets,
  );
}

Deno.serve(async (req) => {
  if (!sameSecret(req.headers.get('x-push-secret'), Deno.env.get('PUSH_WEBHOOK_SECRET'))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let sent = 0;
  let failed = 0;

  try {
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const { data, error } = await supabase.rpc('claim_push_batch', { p_limit: CLAIM_LIMIT });
      if (error) throw new Error(`claim_push_batch: ${error.message}`);
      const claimed = (data ?? []) as ClaimedRow[];
      if (claimed.length === 0) break;

      const ids = claimed.map((row) => row.id);
      let result: PushResult;
      try {
        const rows: OutboxRow[] = claimed.map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          data: row.data ?? {},
          tokens: row.tokens ?? [],
        }));
        result = await sendRows(rows);
      } catch (error) {
        result = { ...classifyResponse(ids, 0), error: errorText(error) };
      }

      const { error: markError } = await supabase.rpc('mark_push_result', {
        p_sent: result.sent,
        p_failed: result.failed,
        p_error: result.error,
        p_dead_tokens: result.deadTokens,
      });
      if (markError) throw new Error(`mark_push_result: ${markError.message}`);

      sent += result.sent.length;
      failed += result.failed.length;

      // mark_push_result clears the lease of failed rows, so the next claim would hand them
      // straight back and burn every attempt in one call. Stop here; the cron retry (or the
      // next wake) tries again later.
      if (result.failed.length > 0) break;
    }
  } catch (error) {
    console.error('send-push failed', errorText(error));
    return json({ error: 'send failed', sent, failed }, 500);
  }

  return json({ sent, failed });
});
