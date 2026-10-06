import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { eventKind, eventStatus, requestStatus, role } from "./lib/validators";

export default defineSchema({
  ...authTables,

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
    updatedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  publisherRequests: defineTable({
    userId: v.id("users"),
    message: v.string(),
    status: requestStatus,
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  events: defineTable({
    title: v.string(),
    description: v.string(),
    slug: v.string(),
    kind: eventKind,
    startsAt: v.number(),
    endsAt: v.number(),
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
    .index("by_organizer", ["organizerId", "startsAt"]),

  attendances: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
  })
    .index("by_event_user", ["eventId", "userId"])
    .index("by_user", ["userId"]),
});
