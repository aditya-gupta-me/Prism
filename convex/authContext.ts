import { MutationCtx, QueryCtx } from "./_generated/server";

// MutationCtx and QueryCtx both uses the GenericMutationCtx
// might work if one is used
// I did as official doc stated this
export const verifyAuth = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Unauthorized!");
  }

  return identity;
};
