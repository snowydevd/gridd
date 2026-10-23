import { v } from "convex/values";

export const role = v.union(
  v.literal("user"),
  v.literal("publisher"),
  v.literal("admin"),
);
export type Role = typeof role.type;

export const eventKind = v.union(
  v.literal("junada"),
  v.literal("rodada"),
  v.literal("cars_and_coffee"),
  v.literal("expo"),
  v.literal("clasicos"),
  v.literal("jdm"),
  v.literal("tuning"),
  v.literal("4x4"),
  v.literal("motos"),
  v.literal("pista"),
  v.literal("otro"),
);

export const eventStatus = v.union(
  v.literal("published"),
  v.literal("cancelled"),
  v.literal("hidden"),
);

export const requestStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export const reportReason = v.union(
  v.literal("spam"),
  v.literal("fake"),
  v.literal("offensive"),
  v.literal("other"),
);
export type ReportReason = typeof reportReason.type;

export const reportStatus = v.union(v.literal("pending"), v.literal("resolved"));

export const igPostStatus = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("publishing"),
  v.literal("published"),
  v.literal("failed"),
  v.literal("rejected"),
);
export type IgPostStatus = typeof igPostStatus.type;
