import { describe, expect, it, vi } from 'vitest';
import { authorized, handleBillingWebhook, licenseChange, type LicenseChange } from './billing';

const HOUSEHOLD = '00000000-0000-0000-0000-0000000000a1';
const PAYER = '00000000-0000-0000-0000-0000000000b1';
const SECRET = 's3cret';

const event = (type: string, extra: Record<string, unknown> = {}) => ({
  event: {
    type,
    app_user_id: PAYER,
    expiration_at_ms: Date.UTC(2026, 10, 26),
    event_timestamp_ms: Date.UTC(2026, 9, 26),
    original_transaction_id: 'GPA.1',
    subscriber_attributes: { household_id: { value: HOUSEHOLD } },
    ...extra,
  },
});

const request = (body: unknown, auth: string | null = `Bearer ${SECRET}`) =>
  new Request('https://example.test/billing-webhook', {
    method: 'POST',
    headers: auth === null ? {} : { authorization: auth },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

function deps(enabled: boolean) {
  const apply = vi.fn<(change: LicenseChange) => Promise<boolean>>(() => Promise.resolve(true));
  return { secret: SECRET, billingEnabled: () => Promise.resolve(enabled), apply };
}

describe('authorized', () => {
  it('takes only the configured secret, as a bearer', () => {
    expect(authorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(authorized('Bearer wrong', SECRET)).toBe(false);
    expect(authorized(SECRET, SECRET)).toBe(false);
    expect(authorized(null, SECRET)).toBe(false);
    expect(authorized(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(authorized('Bearer ', '')).toBe(false);
  });
});

describe('licenseChange', () => {
  it('a purchase or a renewal makes the licence active until it expires', () => {
    expect(licenseChange(event('INITIAL_PURCHASE'))).toEqual({
      householdId: HOUSEHOLD,
      status: 'active',
      periodEnd: '2026-11-26T00:00:00.000Z',
      subscriptionId: 'GPA.1',
      paidBy: PAYER,
      initial: true,
      eventAt: '2026-10-26T00:00:00.000Z',
    });
    expect(licenseChange(event('RENEWAL'))).toMatchObject({ status: 'active', initial: false });
  });

  it('a failed renewal is past_due, an expiry canceled', () => {
    expect(licenseChange(event('BILLING_ISSUE'))?.status).toBe('past_due');
    expect(licenseChange(event('EXPIRATION'))?.status).toBe('canceled');
  });

  it('a cancellation changes nothing yet: the licence holds until it expires', () => {
    expect(licenseChange(event('CANCELLATION'))).toBeNull();
  });

  it('an event without its subscription changes nothing', () => {
    expect(
      licenseChange(event('RENEWAL', { original_transaction_id: undefined, transaction_id: '' })),
    ).toBeNull();
    expect(licenseChange({})).toBeNull();
    expect(licenseChange(null)).toBeNull();
  });

  it('a household that is not an id is not passed on: the server finds it by the subscription', () => {
    expect(
      licenseChange(
        event('RENEWAL', { subscriber_attributes: { household_id: { value: 'x;drop' } } }),
      )?.householdId,
    ).toBeNull();
  });
});

describe('handleBillingWebhook', () => {
  it('a wrong or missing signature is refused, whatever the switch says', async () => {
    const d = deps(true);
    expect((await handleBillingWebhook(request(event('RENEWAL'), 'Bearer nope'), d)).status).toBe(
      401,
    );
    expect((await handleBillingWebhook(request(event('RENEWAL'), null), d)).status).toBe(401);
    expect(d.apply).not.toHaveBeenCalled();
  });

  it('with billing off it answers 200 and touches nothing', async () => {
    const d = deps(false);
    const response = await handleBillingWebhook(request(event('RENEWAL')), d);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ignored: 'billing_disabled' });
    expect(d.apply).not.toHaveBeenCalled();
  });

  it('with billing on and the right signature it applies the change', async () => {
    const d = deps(true);
    const response = await handleBillingWebhook(request(event('BILLING_ISSUE')), d);
    expect(response.status).toBe(200);
    expect(d.apply).toHaveBeenCalledWith(expect.objectContaining({ status: 'past_due' }));
  });

  it('says so when no licence changed', async () => {
    const d = deps(true);
    d.apply.mockResolvedValueOnce(false);
    const response = await handleBillingWebhook(request(event('RENEWAL')), d);
    expect(await response.json()).toEqual({ ignored: 'no_licence' });
  });

  it('a body that is not JSON is a bad request', async () => {
    expect((await handleBillingWebhook(request('{nope'), deps(true))).status).toBe(400);
  });
});
