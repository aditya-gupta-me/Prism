// src/inngest/client.ts
import { Inngest } from "inngest";
import { sentryMiddleware } from "@inngest/middleware-sentry";

export const inngest = new Inngest({
  id: "prism",
  middleware: [sentryMiddleware()],
});
