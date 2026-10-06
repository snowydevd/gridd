import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type EventView = Doc<"events"> & {
  imageUrl: string | null;
  organizer: { _id: Id<"users">; name: string | null; image: string | null } | null;
};

/** Forma en que las queries públicas devuelven un evento. */
export async function toEventView(ctx: QueryCtx, event: Doc<"events">): Promise<EventView> {
  const organizer = await ctx.db.get(event.organizerId);
  return {
    ...event,
    imageUrl: event.imageId ? await ctx.storage.getUrl(event.imageId) : null,
    organizer: organizer
      ? { _id: organizer._id, name: organizer.name ?? null, image: organizer.image ?? null }
      : null,
  };
}
