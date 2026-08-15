import * as Sentry from "@sentry/nextjs";

import {
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "@/lib/observability/sentry-privacy";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  sendDefaultPii: false,
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  maxBreadcrumbs: 30,
  maxValueLength: 500,
  beforeBreadcrumb: scrubSentryBreadcrumb,
  beforeSend: scrubSentryEvent,
  beforeSendTransaction: scrubSentryEvent,
  ignoreTransactions: ["/api/health", "/api/readiness"],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
