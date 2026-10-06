import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { currentUser, requireAdmin, requirePublisher, roleOf } from "./lib/auth";
import { fail } from "./lib/errors";
import { toEventView } from "./lib/eventView";
import { slugBase, uniqueSlug } from "./lib/slug";
import { DAY, validateEventInput } from "./lib/validation";
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

async function assertImageExists(
  ctx: MutationCtx,
  imageId: Id<"_storage"> | undefined,
  eventId?: Id<"events">,
) {
  if (!imageId) return;
  if (!(await ctx.db.system.get(imageId))) {
    fail("INVALID", "La imagen no existe. Volvé a subirla.");
  }
  // Una imagen ya usada por otro evento no se puede tomar: al reemplazarla se borraría la ajena.
  const owner = await ctx.db
    .query("events")
    .withIndex("by_image", (q) => q.eq("imageId", imageId))
    .first();
  if (owner && owner._id !== eventId) fail("FORBIDDEN", "Esa imagen pertenece a otro evento.");
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
      await assertImageExists(ctx, imageId, id);
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

const MAX_IN_BOUNDS = 200;

export const listUpcoming = query({
  args: { paginationOpts: paginationOptsValidator, kind: v.optional(eventKind) },
  handler: async (ctx, { paginationOpts, kind }) => {
    const now = Date.now();
    const result = await ctx.db
      .query("events")
      .withIndex("by_status_startsAt", (q) =>
        q.eq("status", "published").gte("startsAt", now - DAY),
      )
      .filter((q) =>
        kind
          ? q.and(q.gte(q.field("endsAt"), now), q.eq(q.field("kind"), kind))
          : q.gte(q.field("endsAt"), now),
      )
      .paginate(paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((event) => toEventView(ctx, event))),
    };
  },
});

export const listInBounds = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLon: v.number(),
    maxLon: v.number(),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.minLat > args.maxLat || args.minLon > args.maxLon) {
      fail("INVALID", "El área del mapa no es válida.");
    }
    if (args.to < args.from || args.to - args.from > 90 * DAY) {
      fail("INVALID", "El rango de fechas tiene que ser de hasta 90 días.");
    }
    const events = await ctx.db
      .query("events")
      .withIndex("by_status_startsAt", (q) =>
        q.eq("status", "published").gte("startsAt", args.from).lte("startsAt", args.to),
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("lat"), args.minLat),
          q.lte(q.field("lat"), args.maxLat),
          q.gte(q.field("lon"), args.minLon),
          q.lte(q.field("lon"), args.maxLon),
        ),
      )
      .take(MAX_IN_BOUNDS);
    return await Promise.all(events.map((event) => toEventView(ctx, event)));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!event) return null;
    if (event.status === "hidden") {
      const viewer = await currentUser(ctx);
      const canSee =
        viewer && (viewer._id === event.organizerId || roleOf(viewer) === "admin");
      if (!canSee) return null;
    }
    return await toEventView(ctx, event);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePublisher(ctx);
    const events = await ctx.db
      .query("events")
      .withIndex("by_organizer", (q) => q.eq("organizerId", user._id))
      .order("desc")
      .collect();
    return await Promise.all(events.map((event) => toEventView(ctx, event)));
  },
});
