import * as Sentry from '@sentry/react-native';
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';
import { scrubUrl } from './scrub';

// Read by their full names so Expo inlines them into the bundle; typed as unknown because CI has
// no generated env types.
const rawDsn: unknown = process.env.EXPO_PUBLIC_SENTRY_DSN;
const rawAppEnv: unknown = process.env.EXPO_PUBLIC_APP_ENV;
const dsn = typeof rawDsn === 'string' && rawDsn ? rawDsn : undefined;
const environment = typeof rawAppEnv === 'string' && rawAppEnv ? rawAppEnv : 'production';

const navigation = Sentry.reactNavigationIntegration();

function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  if (crumb.message) crumb.message = scrubUrl(crumb.message);
  const url: unknown = crumb.data?.url;
  if (typeof url === 'string') crumb.data = { ...crumb.data, url: scrubUrl(url) };
  for (const key of ['from', 'to'] as const) {
    const value: unknown = crumb.data?.[key];
    if (typeof value === 'string') crumb.data = { ...crumb.data, [key]: scrubUrl(value) };
  }
  return crumb;
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request?.url) event.request.url = scrubUrl(event.request.url);
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);
  return event;
}

/**
 * Starts error reporting. Only release builds with a DSN send anything: no personal data,
 * no replay, no logs; a fifth of the sessions carry performance traces.
 */
export function initTelemetry(): void {
  Sentry.init({
    dsn,
    enabled: !__DEV__ && !!dsn,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    integrations: [navigation],
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

/** Tags later events with the signed-in user's id, never their email or name. */
export function setTelemetryUser(id: string | null): void {
  Sentry.setUser(id ? { id } : null);
}

export function captureError(error: unknown, extra?: Record<string, unknown>): void {
  Sentry.captureException(error, extra ? { extra } : undefined);
}

/** Lets navigation spans follow Expo Router's container. */
export function trackNavigation(ref: unknown): void {
  navigation.registerNavigationContainer(ref);
}

export const withTelemetry = Sentry.wrap;
