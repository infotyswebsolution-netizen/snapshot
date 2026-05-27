import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,

  // CRITICAL: Strip base64 image data from events [I-5]
  // Bill images must never appear in Sentry
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      if (typeof data.image === "string") {
        event.request.data = { ...data, image: "[image data stripped]" };
      }
    }
    return event;
  },
});
