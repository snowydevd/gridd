import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireAdmin, requireUser, roleOf } from "./lib/auth";
import { fail } from "./lib/errors";
import { reportReason } from "./lib/validators";

const MAX_NOTE = 500;

function cleanNote(note: string | undefined) {
  const trimmed = note?.trim() || undefined;
  if (trimmed && trimmed.length > MAX_NOTE) {
    fail("INVALID", `El comentario puede tener hasta ${MAX_NOTE} caracteres.`);
  }
  return trimmed;
}

export const submit = mutation({
  args: { eventId: v.id("events"), reason: reportReason, note: v.optional(v.string()) },
  handler: async (ctx, { eventId, reason, note }) => {
    const user = await requireUser(ctx);
    const event = await ctx.db.get(eventId);
    if (!event) fail("NOT_FOUND", "El evento no existe.");
    if (event.organizerId === user._id) fail("INVALID", "No podés reportar tu propio evento.");
    const trimmed = cleanNote(note);

    const pending = await ctx.db
      .query("reports")
      .withIndex("by_reporter", (q) =>
        q.eq("reporterId", user._id).eq("eventId", eventId).eq("status", "pending"),
      )
      .first();
    if (pending) fail("CONFLICT", "Ya reportaste este evento. Lo estamos revisando.");

    return await ctx.db.insert("reports", {
      reporterId: user._id,
      eventId,
      reason,
      note: trimmed,
      status: "pending",
    });
  },
});

export const submitUser = mutation({
  args: { userId: v.id("users"), reason: reportReason, note: v.optional(v.string()) },
  handler: async (ctx, { userId, reason, note }) => {
    const user = await requireUser(ctx);
    if (userId === user._id) fail("INVALID", "No te podés reportar a vos mismo.");
    if (!(await ctx.db.get(userId))) fail("NOT_FOUND", "El usuario no existe.");
    const trimmed = cleanNote(note);

    const pending = await ctx.db
      .query("reports")
      .withIndex("by_reporter_user", (q) =>
        q.eq("reporterId", user._id).eq("reportedUserId", userId).eq("status", "pending"),
      )
      .first();
    if (pending) fail("CONFLICT", "Ya reportaste a este usuario. Lo estamos revisando.");

    return await ctx.db.insert("reports", {
      reporterId: user._id,
      reportedUserId: userId,
      reason,
      note: trimmed,
      status: "pending",
    });
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .collect();
    return await Promise.all(
      reports.map(async (report) => {
        const event = report.eventId ? await ctx.db.get(report.eventId) : null;
        const organizer = event ? await ctx.db.get(event.organizerId) : null;
        const reported = report.reportedUserId ? await ctx.db.get(report.reportedUserId) : null;
        const reporter = await ctx.db.get(report.reporterId);
        return {
          ...report,
          event: event
            ? { _id: event._id, title: event.title, slug: event.slug, status: event.status }
            : null,
          organizer: organizer
            ? { name: organizer.name ?? null, email: organizer.email ?? null }
            : null,
          reportedUser: reported
            ? { _id: reported._id, name: reported.name ?? null, email: reported.email ?? null, role: roleOf(reported) }
            : null,
          reporter: reporter ? { name: reporter.name ?? null, email: reporter.email ?? null } : null,
        };
      }),
    );
  },
});

/** Los reportes pendientes sobre lo mismo que `report` (el evento o el usuario). */
async function pendingOnSameTarget(ctx: MutationCtx, report: Doc<"reports">) {
  if (report.eventId) {
    const eventId = report.eventId;
    return await ctx.db
      .query("reports")
      .withIndex("by_event_status", (q) => q.eq("eventId", eventId).eq("status", "pending"))
      .collect();
  }
  return await ctx.db
    .query("reports")
    .withIndex("by_user_status", (q) => q.eq("reportedUserId", report.reportedUserId).eq("status", "pending"))
    .collect();
}

/**
 * Resuelve todos los reportes pendientes sobre lo mismo. `hide_event` oculta el evento reportado;
 * `revoke_publisher` le saca el permiso de publicar al usuario reportado y oculta sus eventos próximos.
 */
export const resolve = mutation({
  args: {
    reportId: v.id("reports"),
    action: v.union(v.literal("dismiss"), v.literal("hide_event"), v.literal("revoke_publisher")),
  },
  handler: async (ctx, { reportId, action }) => {
    const admin = await requireAdmin(ctx);
    const report = await ctx.db.get(reportId);
    if (!report) fail("NOT_FOUND", "El reporte no existe.");
    if (report.status !== "pending") fail("CONFLICT", "El reporte ya fue resuelto.");
    const now = Date.now();

    if (action === "hide_event") {
      if (!report.eventId) fail("INVALID", "Este reporte no es de un evento.");
      const event = await ctx.db.get(report.eventId);
      if (event && event.status !== "hidden") {
        await ctx.db.patch(event._id, { status: "hidden", updatedAt: now });
      }
    }

    if (action === "revoke_publisher") {
      if (!report.reportedUserId) fail("INVALID", "Este reporte no es de un usuario.");
      const reported = await ctx.db.get(report.reportedUserId);
      if (reported) {
        if (roleOf(reported) === "admin") fail("INVALID", "No se le puede sacar el permiso a un admin.");
        await ctx.db.patch(reported._id, { role: "user", updatedAt: now });
        const events = await ctx.db
          .query("events")
          .withIndex("by_organizer", (q) => q.eq("organizerId", reported._id))
          .collect();
        for (const event of events) {
          if (event.status === "published" && event.endsAt >= now) {
            await ctx.db.patch(event._id, { status: "hidden", updatedAt: now });
          }
        }
      }
    }

    for (const row of await pendingOnSameTarget(ctx, report)) {
      await ctx.db.patch(row._id, { status: "resolved", resolvedBy: admin._id, resolvedAt: now });
    }
    return null;
  },
});
