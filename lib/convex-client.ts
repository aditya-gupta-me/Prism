import { ConvexHttpClient } from "convex/browser";

let client: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL environment variable is required but not set",
    );
  }
  if (!client) {
    client = new ConvexHttpClient(url);
  }
  return client;
}

export const convex = new Proxy({} as ConvexHttpClient, {
  get(_target, prop, receiver) {
    const convexClient = getConvexClient();
    const value = Reflect.get(convexClient, prop, receiver);
    if (typeof value === "function") {
      return value.bind(convexClient);
    }
    return value;
  },
});
