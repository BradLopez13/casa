import { describe, expect, it } from 'vitest';
import {
  alignTickets,
  buildExpoMessages,
  chunk,
  classifyResponse,
  classifyTickets,
  type ExpoTicket,
  type OutboxRow,
} from './push';

const withTokens: OutboxRow = {
  id: 7,
  title: 'Tienes una tarea nueva',
  body: 'Sacar la basura · hoy',
  data: { route: '/tasks' },
  tokens: ['ExponentPushToken[aaa]', 'ExponentPushToken[bbb]'],
};

const withoutTokens: OutboxRow = {
  id: 8,
  title: 'Alguien nuevo en casa',
  body: 'Berta se ha unido a Piso',
  data: { route: '/household/members' },
  tokens: [],
};

describe('buildExpoMessages', () => {
  it('builds one message per token and records which row owns it', () => {
    const { messages, owner } = buildExpoMessages([withTokens, withoutTokens]);

    expect(messages).toHaveLength(2);
    expect(owner).toEqual([7, 7]);
    expect(messages.map((m) => m.to)).toEqual(withTokens.tokens);
    for (const message of messages) {
      expect(message.title).toBe('Tienes una tarea nueva');
      expect(message.body).toBe('Sacar la basura · hoy');
      expect(message.data).toEqual({ route: '/tasks', casa: 'push' });
      expect(message.channelId).toBe('household');
      expect(message.sound).toBe('default');
    }
  });
});

describe('chunk', () => {
  it('splits 250 items into batches of 100, 100 and 50', () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    expect(chunk(items, 100).map((c) => c.length)).toEqual([100, 100, 50]);
  });

  it('returns no batches for no items', () => {
    expect(chunk([], 100)).toEqual([]);
  });
});

describe('classifyTickets', () => {
  it('marks a row sent when any of its tickets is ok and collects dead tokens', () => {
    const { messages, owner } = buildExpoMessages([withTokens]);
    const tickets: ExpoTicket[] = [
      { status: 'ok' },
      { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
    ];

    expect(classifyTickets([7], owner, messages, tickets)).toEqual({
      sent: [7],
      failed: [],
      deadTokens: ['ExponentPushToken[bbb]'],
      error: null,
    });
  });

  it('marks a row failed with an error when every ticket failed', () => {
    const { messages, owner } = buildExpoMessages([withTokens]);
    const tickets: ExpoTicket[] = [
      { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } },
      { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } },
    ];

    const result = classifyTickets([7], owner, messages, tickets);
    expect(result.sent).toEqual([]);
    expect(result.failed).toEqual([7]);
    expect(result.deadTokens).toEqual([]);
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('MessageRateExceeded');
  });

  it('marks a row without tokens as sent', () => {
    const { messages, owner } = buildExpoMessages([withoutTokens]);
    expect(classifyTickets([8], owner, messages, [])).toEqual({
      sent: [8],
      failed: [],
      deadTokens: [],
      error: null,
    });
  });

  it('fails a row whose ticket is missing from the response', () => {
    const { messages, owner } = buildExpoMessages([withTokens]);
    const result = classifyTickets([7], owner, messages, []);
    expect(result.failed).toEqual([7]);
    expect(result.error).not.toBeNull();
  });
});

describe('classifyResponse', () => {
  it('fails every row of the batch on a non-2xx response', () => {
    const result = classifyResponse([7, 8], 500);
    expect(result.sent).toEqual([]);
    expect(result.failed).toEqual([7, 8]);
    expect(result.deadTokens).toEqual([]);
    expect(result.error).toContain('500');
  });
});

describe('alignTickets', () => {
  const dead = { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } };

  it('keeps tickets whose count matches the messages', () => {
    expect(alignTickets(2, [{ status: 'ok' }, dead])).toEqual([{ status: 'ok' }, dead]);
  });

  it('turns a length mismatch into error tickets that mark no token dead', () => {
    const tickets = alignTickets(2, [dead]);
    expect(tickets).toHaveLength(2);
    expect(tickets.every((t) => t.status === 'error')).toBe(true);

    const { messages, owner } = buildExpoMessages([withTokens]);
    const result = classifyTickets([7], owner, messages, tickets);
    expect(result.failed).toEqual([7]);
    expect(result.deadTokens).toEqual([]);
  });

  it('turns a non-array data into error tickets', () => {
    for (const data of [undefined, null, { status: 'ok' }, 'ok']) {
      const tickets = alignTickets(3, data);
      expect(tickets).toHaveLength(3);
      expect(tickets.every((t) => t.status === 'error')).toBe(true);
    }
  });

  it('never shifts a dead token from a later batch onto an earlier one', () => {
    const other: OutboxRow = { ...withoutTokens, id: 9, tokens: ['ExponentPushToken[ccc]'] };
    const { messages, owner } = buildExpoMessages([withTokens, other]);
    const [first, second] = chunk(messages, 2);

    // Batch 1 (two messages of row 7) comes back one ticket short; batch 2 (row 9) is dead.
    const tickets = [
      ...alignTickets(first!.length, [{ status: 'ok' }]),
      ...alignTickets(second!.length, [dead]),
    ];

    const result = classifyTickets([7, 9], owner, messages, tickets);
    expect(result.deadTokens).toEqual(['ExponentPushToken[ccc]']);
    expect(result.sent).toEqual([]);
    expect(result.failed).toEqual([7, 9]);
  });

  it('turns entries that are not tickets into errors', () => {
    expect(alignTickets(2, [{ status: 'ok' }, 42])).toEqual([
      { status: 'ok' },
      { status: 'error', message: 'invalid ticket' },
    ]);
  });
});
