import { clerkClient } from "@clerk/nextjs/server";

/**
 * Fetches the caller's GitHub OAuth access token from Clerk.
 *
 * Used both by API routes (fail-fast UX check) and by Inngest functions at
 * execution time. Fetching inside the function — rather than passing the token
 * through the event payload — keeps the live token out of Inngest's durable
 * event/step storage and ensures each retry/replay uses a fresh, unexpired
 * token. `clerkClient()` needs only CLERK_SECRET_KEY, so it works outside a
 * request context.
 */
export async function getGithubTokenForUser(
  userId: string,
): Promise<string | null> {
  const client = await clerkClient();
  const tokens = await client.users.getUserOauthAccessToken(userId, "github");
  return tokens.data[0]?.token ?? null;
}
