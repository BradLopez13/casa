/* global http, json, EMAIL, output */
// Reads the 6-digit sign-up code Supabase sent to EMAIL, from the local Mailpit inbox.
// Maestro runs this script on the host, so Mailpit is on localhost. The code ends up in
// output.code. Wrapped in a function so its names never clash with a JS context Maestro reuses.
(function () {
  const MAILPIT_URL = 'http://localhost:54324';
  const ATTEMPTS = 10;

  if (typeof EMAIL === 'undefined' || !EMAIL) {
    throw new Error('EMAIL is not set: pass it with env: EMAIL: ${output.email}');
  }

  function check(step, response) {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(step + ' failed with status ' + response.status + ': ' + response.body);
    }
    return response;
  }

  function sleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      // busy wait: Maestro scripts have no timers
    }
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const search = check(
      'Search Mailpit',
      http.get(MAILPIT_URL + '/api/v1/search?query=' + encodeURIComponent('to:"' + EMAIL + '"')),
    );
    // Mailpit lists the most recent message first.
    const messages = json(search.body).messages || [];
    if (messages.length > 0) {
      const message = check(
        'Read the message',
        http.get(MAILPIT_URL + '/api/v1/message/' + messages[0].ID),
      );
      const match = /\b(\d{6})\b/.exec(json(message.body).Text);
      if (match) {
        output.code = match[1];
        return;
      }
    }
    if (attempt < ATTEMPTS) sleep(1000);
  }
  throw new Error('No email with a 6-digit code arrived for ' + EMAIL);
})();
