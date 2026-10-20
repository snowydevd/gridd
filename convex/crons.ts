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

// Jueves 15:00 UTC: genera los drafts de la semana siguiente para revisarlos antes del lunes.
// No hace nada salvo que IG_AUTOGEN_ENABLED=true.
crons.weekly(
  "instagram: generar lote semanal",
  { dayOfWeek: "thursday", hourUTC: 15, minuteUTC: 0 },
  internal.instagram.generate.generateWeekly,
  {},
);

export default crons;
