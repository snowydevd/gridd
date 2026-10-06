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
