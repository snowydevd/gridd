import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { searchRadius } from "./lib/searchRadius";
import { eventKind, eventStatus, igPostStatus, requestStatus, role } from "./lib/validators";

export default defineSchema({
  ...authTables,
  // Índice extra para borrar los verifiers de una sesión al eliminar la cuenta.
  authVerifiers: authTables.authVerifiers.index("sessionId", ["sessionId"]),

  // Misma forma que authTables.users, más rol y updatedAt.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(role),
    // Rango de "Cerca tuyo"; sin valor se usa DEFAULT_SEARCH_RADIUS.
    searchRadius: v.optional(searchRadius),
    // Categorías que le gustan, para ordenar "Para vos" en Inicio. Sin valor = ninguna.
    interests: v.optional(v.array(eventKind)),
    // Foto subida por el usuario. Tiene prioridad sobre `image` (la del login social).
    avatarId: v.optional(v.id("_storage")),
    updatedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_avatar", ["avatarId"]),

  cars: defineTable({
    userId: v.id("users"),
    make: v.string(),
    model: v.string(),
    version: v.optional(v.string()),
    year: v.optional(v.number()),
    isModified: v.optional(v.boolean())
  }).index("by_user", ["userId"]),

  publisherRequests: defineTable({
    userId: v.id("users"),
    message: v.string(),
    status: requestStatus,
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_reviewer", ["reviewedBy"]),

  events: defineTable({
    title: v.string(),
    description: v.string(),
    slug: v.string(),
    kind: eventKind,
    startsAt: v.number(),
    endsAt: v.number(),
    /** El organizador no dio hora de fin; `endsAt` es estimado (ver NO_END_DURATION). */
    noEndTime: v.optional(v.boolean()),
    placeName: v.string(),
    lat: v.number(),
    lon: v.number(),
    imageId: v.optional(v.id("_storage")),
    organizerId: v.id("users"),
    status: eventStatus,
    attendeeCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status_startsAt", ["status", "startsAt"])
    .index("by_organizer", ["organizerId", "startsAt"])
    .index("by_image", ["imageId"]),

  attendances: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
  })
    .index("by_event_user", ["eventId", "userId"])
    .index("by_user", ["userId"]),

  saves: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
  })
    .index("by_event_user", ["eventId", "userId"])
    .index("by_user", ["userId"]),

  // Posts para la cuenta de Instagram de Gridd. Nunca pasan de draft a approved sin un admin.
  igPosts: defineTable({
    caption: v.string(),
    // Ángulo de contenido de content/angles.ts.
    angle: v.string(),
    // 1 = post simple, 2–10 = carrusel.
    images: v.array(v.id("_storage")),
    status: igPostStatus,
    scheduledAt: v.optional(v.number()),
    containerId: v.optional(v.string()),
    igMediaId: v.optional(v.string()),
    permalink: v.optional(v.string()),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    batchId: v.optional(v.string()),
  })
    .index("by_status_scheduledAt", ["status", "scheduledAt"])
    .index("by_batch", ["batchId"]),

  // Token vigente de Instagram. Sólo lo leen funciones internas.
  igCredentials: defineTable({
    accessToken: v.string(),
    igUserId: v.string(),
    expiresAt: v.number(),
    refreshedAt: v.number(),
  }),
});
