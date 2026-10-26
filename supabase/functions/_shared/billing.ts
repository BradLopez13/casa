// The billing webhook's logic (bloque 12), apart from Deno so Vitest can run it. One licence per
// household, monthly; the provider is RevenueCat (decisión de Brad), whose webhook carries the
// Authorization header configured in its dashboard. Billing is off: until the switch is on, the
// webhook answers 200 and changes nothing.

// The _shared modules import nothing: Deno needs the `.ts` in a path that the app's TypeScript
// refuses. So the comparison is push.ts' sameSecret, again.
function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export type LicenseChange = {
  householdId: string;
  status: 'active' | 'past_due' | 'canceled';
  periodEnd: string | null;
  subscriptionId: string | null;
  paidBy: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether the request carries the configured secret, as `Bearer <secret>`, compared in constant time. */
export function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || header === null) return false;
  return sameSecret(header, `Bearer ${secret}`);
}

const STATUS_BY_EVENT: Record<string, LicenseChange['status']> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  UNCANCELLATION: 'active',
  PRODUCT_CHANGE: 'active',
  BILLING_ISSUE: 'past_due',
  EXPIRATION: 'canceled',
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

/**
 * What a RevenueCat event changes in a household's licence, or null when it changes nothing (a
 * cancellation only stops the renewal: the licence holds until it expires; a test event; an
 * event without the household the app tagged the purchase with).
 */
export function licenseChange(body: unknown): LicenseChange | null {
  const event = asRecord(asRecord(body)?.event);
  if (!event) return null;
  const status = STATUS_BY_EVENT[String(event.type)];
  if (!status) return null;
  const attributes = asRecord(event.subscriber_attributes);
  const householdId = asRecord(attributes?.household_id)?.value;
  if (typeof householdId !== 'string' || !UUID.test(householdId)) return null;
  const expires = event.expiration_at_ms;
  const subscription = event.original_transaction_id ?? event.transaction_id;
  const payer = event.app_user_id;
  return {
    householdId,
    status,
    periodEnd: typeof expires === 'number' ? new Date(expires).toISOString() : null,
    subscriptionId: typeof subscription === 'string' ? subscription : null,
    paidBy: typeof payer === 'string' && UUID.test(payer) ? payer : null,
  };
}

export type WebhookDeps = {
  secret: string | undefined;
  billingEnabled: () => Promise<boolean>;
  apply: (change: LicenseChange) => Promise<void>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The webhook: 401 without the secret; with billing off, 200 and nothing touched. */
export async function handleBillingWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  if (!authorized(req.headers.get('authorization'), deps.secret)) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!(await deps.billingEnabled())) return json({ ignored: 'billing_disabled' });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const change = licenseChange(body);
  if (!change) return json({ ignored: 'no_change' });
  await deps.apply(change);
  return json({ applied: change.status });
}
