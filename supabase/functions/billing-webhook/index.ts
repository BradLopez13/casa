// Billing webhook (bloque 12): RevenueCat calls it when a household's licence is bought, renewed,
// fails to renew or expires. It checks the Authorization header against BILLING_WEBHOOK_SECRET
// and, only while billing is on (private.app_settings.billing_enabled), applies the change
// through apply_billing_event, the licences' only door. With billing off it answers 200 and
// touches nothing.

import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { handleBillingWebhook } from '../_shared/billing.ts';

Deno.serve((req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  return handleBillingWebhook(req, {
    secret: Deno.env.get('BILLING_WEBHOOK_SECRET'),
    billingEnabled: async () => {
      const { data, error } = await supabase.rpc('billing_enabled');
      if (error) throw error;
      return data === true;
    },
    apply: async (change) => {
      const { data, error } = await supabase.rpc('apply_billing_event', {
        p_household_id: change.householdId,
        p_status: change.status,
        p_period_end: change.periodEnd,
        p_provider: 'revenuecat',
        p_subscription_id: change.subscriptionId,
        p_paid_by: change.paidBy,
        p_initial: change.initial,
        p_event_at: change.eventAt,
      });
      if (error) throw error;
      return data === true;
    },
  });
});
