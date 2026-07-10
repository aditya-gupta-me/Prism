import { NonRetriableError } from "inngest";

/**
 * Rethrows a caught error, converting permanent GitHub failures into
 * NonRetriableError so Inngest stops retrying them.
 *
 * A 4xx (except 429 Too Many Requests) is deterministic — a repo name
 * collision (422), a bad request (400), a missing resource (404) will fail
 * identically on every retry, so burning the whole backoff window is wasteful.
 * Everything else (5xx, network errors, rate limits) is left as-is so Inngest
 * retries it.
 */
export function toNonRetriableIfPermanent(error: unknown): never {
  const status = (error as { status?: number })?.status;

  if (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 429
  ) {
    throw new NonRetriableError(
      `GitHub request failed permanently (${status}): ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  throw error as Error;
}
