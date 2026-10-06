import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation } from "./_generated/server";
import { requireAdmin, requirePublisher } from "./lib/auth";
import { fail } from "./lib/errors";
import { slugBase, uniqueSlug } from "./lib/slug";
import { validateEventInput } from "./lib/validation";
import { eventKind } from "./lib/validators";

const eventFields = {
  title: v.string(),
  description: v.string(),
  kind: eventKind,
  startsAt: v.number(),
  endsAt: v.number(),
  placeName: v.string(),
  lat: v.number(),
  lon: v.number(),
};

async function assertImageExists(ctx: MutationCtx, imageId: Id<"_storage"> | undefined) {
  if (imageId && !(await ctx.db.system.get(imageId))) {
    fail("INVALID", "La imagen no existe. Volvé a subirla.");
  }
}

async function getEventOrFail(ctx: MutationCtx, id: Id<"events">) {
  const event = await ctx.db.get(id);
  if (!event) fail("NOT_FOUND", "El evento no existe.");
  return event;
}

function assertOrganizer(user: Doc<"users">, event: Doc<"events">) {
  if (event.organizerId !== user._id) {
    fail("FORBIDDEN", "Sólo el organizador puede modificar este evento.");
  }
}

export const create = mutation({
  args: { ...eventFields, imageId: v.optional(v.id("_storage")) },
  handler: async (ctx, args) => {
    const user = await requirePublisher(ctx);
    const now = Date.now();
    const input = validateEventInput(args, now, { dateChanged: true });
    await assertImageExists(ctx, input.imageId);
    const slug = await uniqueSlug(ctx, slugBase(input.title, input.startsAt));
    const id = await ctx.db.insert("events", {
      ...input,
      slug,
      organizerId: user._id,
      status: "published",
      attendeeCount: 0,
      updatedAt: now,
    });
    return { id, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    kind: v.optional(eventKind),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    placeName: v.optional(v.string()),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    imageId: v.optional(v.id("_storage")),
    removeImage: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, removeImage, imageId, ...patch }) => {
    const user = await requirePublisher(ctx);
    const event = await getEventOrFail(ctx, id);
    assertOrganizer(user, event);
    if (event.status !== "published") {
      fail("INVALID", "No se puede editar un evento cancelado u oculto.");
    }

    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<typeof patch>;
    const merged = {
      title: event.title,
      description: event.description,
      kind: event.kind,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      placeName: event.placeName,
      lat: event.lat,
      lon: event.lon,
      ...definedPatch,
    };
    const dateChanged =
      merged.startsAt !== event.startsAt || merged.endsAt !== event.endsAt;
    const input = validateEventInput(merged, Date.now(), { dateChanged });

    let nextImage = event.imageId;
    if (removeImage) nextImage = undefined;
    if (imageId !== undefined) {
      await assertImageExists(ctx, imageId);
      nextImage = imageId;
    }
    if (event.imageId && event.imageId !== nextImage) {
      await ctx.storage.delete(event.imageId);
    }

    await ctx.db.patch(id, { ...input, imageId: nextImage, updatedAt: Date.now() });
    return null;
  },
});

export const cancel = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    const user = await requirePublisher(ctx);
    const event = await getEventOrFail(ctx, id);
    assertOrganizer(user, event);
    if (event.status !== "published") {
      fail("INVALID", "Sólo se puede cancelar un evento publicado.");
    }
    await ctx.db.patch(id, { status: "cancelled", updatedAt: Date.now() });
    return null;
  },
});

export const hide = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await getEventOrFail(ctx, id);
    await ctx.db.patch(id, { status: "hidden", updatedAt: Date.now() });
    return null;
  },
});

export const unhide = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const event = await getEventOrFail(ctx, id);
    if (event.status !== "hidden") fail("INVALID", "El evento no está oculto.");
    await ctx.db.patch(id, { status: "published", updatedAt: Date.now() });
    return null;
  },
});
