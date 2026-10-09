/* global http, json, SUPABASE_KEY */
// Berta (a member of "Casa E2E", see supabase/e2e/fixtures.sql) adds "Pan" to the shopping list
// through the API, from outside the app. Maestro runs this script on the host, so Supabase is
// on localhost. SUPABASE_KEY is the anon/publishable key, passed with `maestro test -e`.
// Wrapped in a function so its names never clash with a JS context Maestro reuses.
(function () {
  const SUPABASE_URL = 'http://localhost:54321';

  function check(step, response) {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(step + ' failed with status ' + response.status + ': ' + response.body);
    }
    return response;
  }

  // A random uuid v4, for the item id the RPC expects from the client.
  function uuidV4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.floor(Math.random() * 16);
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  if (typeof SUPABASE_KEY === 'undefined' || !SUPABASE_KEY) {
    throw new Error('SUPABASE_KEY is not set: run maestro test with -e SUPABASE_KEY=<anon key>');
  }

  const signIn = check(
    'Sign in as Berta',
    http.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'berta@e2e.dev', password: 'e2e-password-2026' }),
    }),
  );
  const session = json(signIn.body);
  const authHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + session.access_token,
    'Content-Type': 'application/json',
  };

  const membership = check(
    'Read Berta’s household',
    http.get(
      SUPABASE_URL +
        '/rest/v1/household_members?select=household_id&left_at=is.null&user_id=eq.' +
        session.user.id,
      { headers: authHeaders },
    ),
  );
  const rows = json(membership.body);
  if (rows.length === 0) throw new Error('Berta is not in any household');

  check(
    'Add "Pan"',
    http.post(SUPABASE_URL + '/rest/v1/rpc/add_shopping_item', {
      headers: authHeaders,
      body: JSON.stringify({
        p_id: uuidV4(),
        p_household_id: rows[0].household_id,
        p_name: 'Pan',
        p_quantity: null,
      }),
    }),
  );
})();
