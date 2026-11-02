/* global http, json, SUPABASE_KEY */
// Omar (owner of "Piso Omar", see supabase/e2e/fixtures.sql) deletes the household through the
// API while Olivia, its member, has it open in the app (e2e/household-ended.yaml, bloque 15.2).
// Maestro runs this script on the host, so Supabase is on localhost. SUPABASE_KEY is the anon
// key, passed with `maestro test -e`. Wrapped so its names never clash with a reused context.
(function () {
  const SUPABASE_URL = 'http://localhost:54321';

  function check(step, response) {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(step + ' failed with status ' + response.status + ': ' + response.body);
    }
    return response;
  }

  if (typeof SUPABASE_KEY === 'undefined' || !SUPABASE_KEY) {
    throw new Error('SUPABASE_KEY is not set: run maestro test with -e SUPABASE_KEY=<anon key>');
  }

  const signIn = check(
    'Sign in as Omar',
    http.post(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'omar@e2e.dev', password: 'e2e-password-2026' }),
    }),
  );
  const session = json(signIn.body);
  const authHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + session.access_token,
    'Content-Type': 'application/json',
  };

  const households = check(
    'Read Omar’s households',
    http.post(SUPABASE_URL + '/rest/v1/rpc/my_households', { headers: authHeaders, body: '{}' }),
  );
  const rows = json(households.body).filter(function (row) {
    return row.name === 'Piso Omar';
  });
  if (rows.length === 0) throw new Error('Omar is not in "Piso Omar"');

  check(
    'Delete "Piso Omar"',
    http.post(SUPABASE_URL + '/rest/v1/rpc/delete_household', {
      headers: authHeaders,
      body: JSON.stringify({ p_household_id: rows[0].household_id }),
    }),
  );
})();
