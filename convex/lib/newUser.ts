import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Callback de Convex Auth: sólo actúa en el alta, no en cada login. */
export async function initNewUser(
  ctx: MutationCtx,
  { userId, existingUserId }: { userId: Id<"users">; existingUserId: Id<"users"> | null },
): Promise<void> {
  if (existingUserId) return;
  await ctx.db.patch(userId, { role: "user", updatedAt: Date.now() });
}
