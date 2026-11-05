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
  const transfer = vi.fn<(change: LicenseChange) => Promise<boolean>>(() => Promise.resolve(true));
  return { secret: SECRET, billingEnabled: () => Promise.resolve(enabled), apply, transfer };
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
      eventId: null,
      productId: null,
      transfer: null,
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

// Bloque 15.6: a level per product (casas_n), every event once by its id, and the seven events
// RevenueCat sends.
describe('the seven events (bloque 15.6)', () => {
  const change = (type: string, extra: Record<string, unknown> = {}) =>
    licenseChange(event(type, { id: 'ev-1', product_id: 'casas_2', ...extra }));

  it('carries the event id and the product, so the server applies it once at the right level', () => {
    expect(change('INITIAL_PURCHASE')).toMatchObject({
      eventId: 'ev-1',
      productId: 'casas_2',
      status: 'active',
      initial: true,
    });
    expect(change('RENEWAL')).toMatchObject({ status: 'active', initial: false });
  });

  it('a product change carries the new product', () => {
    expect(change('PRODUCT_CHANGE', { new_product_id: 'casas_3' })).toMatchObject({
      status: 'active',
      productId: 'casas_3',
    });
  });

  it('a cancellation changes nothing; an expiry cancels; a billing issue is past_due', () => {
    expect(change('CANCELLATION')).toBeNull();
    expect(change('EXPIRATION')).toMatchObject({ status: 'canceled' });
    expect(change('BILLING_ISSUE')).toMatchObject({ status: 'past_due' });
  });

  it('a transfer names who loses and who gains, with no subscription in it (as RevenueCat sends it)', async () => {
    const payload = {
      event: {
        type: 'TRANSFER',
        id: 'ev-t',
        app_user_id: '00000000-0000-0000-0000-0000000000b2',
        transferred_from: [PAYER],
        transferred_to: ['00000000-0000-0000-0000-0000000000b2'],
        event_timestamp_ms: Date.UTC(2026, 9, 26),
        store: 'PLAY_STORE',
      },
    };
    expect(licenseChange(payload)).toMatchObject({
      transfer: { from: [PAYER], to: '00000000-0000-0000-0000-0000000000b2' },
      eventId: 'ev-t',
      status: null,
    });
    const d = deps(true);
    const response = await handleBillingWebhook(request(payload), d);
    expect(await response.json()).toEqual({ applied: 'transfer' });
    expect(d.transfer).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'ev-t' }));
    expect(d.apply).not.toHaveBeenCalled();
  });

  it('hands the id and the product to the server', async () => {
    const d = deps(true);
    await handleBillingWebhook(
      request(event('INITIAL_PURCHASE', { id: 'ev-9', product_id: 'casas_1' })),
      d,
    );
    expect(d.apply).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'ev-9', productId: 'casas_1' }),
    );
  });
});
