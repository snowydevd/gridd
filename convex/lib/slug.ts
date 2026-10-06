import type { QueryCtx } from "../_generated/server";
import { HOUR } from "./validation";

// Uruguay no tiene horario de verano desde 2015: UTC-3 fijo.
const MONTEVIDEO_OFFSET = 3 * HOUR;

export function slugBase(title: string, startsAt: number): string {
  const words =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "evento";
  const date = new Date(startsAt - MONTEVIDEO_OFFSET).toISOString().slice(0, 10);
  return `${words}-${date}`;
}

export async function uniqueSlug(ctx: QueryCtx, base: string): Promise<string> {
  let slug = base;
  for (let n = 2; ; n++) {
    const taken = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!taken) return slug;
    slug = `${base}-${n}`;
  }
}
