import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,

  // Strip POS tokens and image data from server-side events [I-5] [I-6]
  beforeSend(event) {
    // Never log access_token, refresh_token, or image data
    if (event.extra) {
      const sanitized = { ...event.extra };
      for (const key of Object.keys(sanitized)) {
        const k = key.toLowerCase();
        if (k.includes("token") || k.includes("secret") || k.includes("key")) {
          sanitized[key] = "[redacted]";
        }
        if (k.includes("image") || k.includes("base64")) {
          sanitized[key] = "[image data stripped]";
        }
      }
      event.extra = sanitized;
    }
    return event;
  },
});
