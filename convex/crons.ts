import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("instagram: publicar posts vencidos", { minutes: 15 }, internal.instagram.scheduler.publishDue, {});

// Lunes 12:00 UTC (09:00 en Uruguay).
crons.weekly(
  "instagram: refrescar token",
  { dayOfWeek: "monday", hourUTC: 12, minuteUTC: 0 },
  internal.instagram.client.refreshToken,
  {},
);

export default crons;
