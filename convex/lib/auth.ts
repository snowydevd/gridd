import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { fail } from "./errors";
import type { Role } from "./validators";

export async function currentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  return userId ? await ctx.db.get(userId) : null;
}

export function roleOf(user: Doc<"users">): Role {
  return user.role ?? "user";
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) fail("UNAUTHENTICATED", "Tenés que iniciar sesión.");
  return user;
}

export async function requirePublisher(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  const role = roleOf(user);
  if (role !== "publisher" && role !== "admin") {
    fail("FORBIDDEN", "Sólo los publishers pueden hacer esto.");
  }
  return user;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (roleOf(user) !== "admin") fail("FORBIDDEN", "Sólo un admin puede hacer esto.");
  return user;
}
