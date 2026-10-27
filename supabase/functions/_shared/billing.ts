// The billing webhook's logic (bloque 12), apart from Deno so Vitest can run it. One licence per
// household, monthly; the provider is RevenueCat (decisión de Brad), whose webhook carries the
// Authorization header configured in its dashboard. Billing is off: until the switch is on, the
// webhook answers 200 and changes nothing.

// The model the stores allow (decisión 4 de Brad, 27 de octubre; DESIGN.md and README): App
// Store and Google Play allow one subscription per product and account, so a person who runs two
// households cannot hold two «household_monthly». Billing will be one subscription group per
// person with a level per number of households (casas_1, casas_2…, priced n × amount); «one
// licence per household» stays in what the person pays. Until that is built, the event below binds
// one household per subscription: switch billing on only once it names the households it covers.

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
  /** The household the app tagged the purchase with; only a first purchase uses it. */
  householdId: string | null;
  status: 'active' | 'past_due' | 'canceled';
  periodEnd: string | null;
  /** The subscription: every event after the first finds its household by it. */
  subscriptionId: string;
  paidBy: string | null;
  /** The first purchase, which ties the subscription to the household. */
  initial: boolean;
  /** When the provider says it happened, so a late retry never undoes a newer event. */
  eventAt: string | null;
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
 * event without its subscription). The household the event names is a customer attribute the app
 * sets, overwritten by a second purchase: the server only trusts it on the first purchase.
 */
export function licenseChange(body: unknown): LicenseChange | null {
  const event = asRecord(asRecord(body)?.event);
  if (!event) return null;
  const status = STATUS_BY_EVENT[String(event.type)];
  if (!status) return null;
  const subscription = event.original_transaction_id ?? event.transaction_id;
  if (typeof subscription !== 'string' || subscription === '') return null;
  const attributes = asRecord(event.subscriber_attributes);
  const householdId = asRecord(attributes?.household_id)?.value;
  const expires = event.expiration_at_ms;
  const at = event.event_timestamp_ms;
  const payer = event.app_user_id;
  return {
    householdId: typeof householdId === 'string' && UUID.test(householdId) ? householdId : null,
    status,
    periodEnd: typeof expires === 'number' ? new Date(expires).toISOString() : null,
    subscriptionId: subscription,
    paidBy: typeof payer === 'string' && UUID.test(payer) ? payer : null,
    initial: event.type === 'INITIAL_PURCHASE',
    eventAt: typeof at === 'number' ? new Date(at).toISOString() : null,
  };
}

export type WebhookDeps = {
  secret: string | undefined;
  billingEnabled: () => Promise<boolean>;
  /** Whether a licence changed (false: unknown subscription, not the household's lead, stale). */
  apply: (change: LicenseChange) => Promise<boolean>;
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
  return (await deps.apply(change))
    ? json({ applied: change.status })
    : json({ ignored: 'no_licence' });
}
