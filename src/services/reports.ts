import { api } from "@/lib/convex";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";

export type ReportReason = FunctionArgs<typeof api.reports.submit>["reason"];

export type ReportTarget = "event" | "user";

/** Motivos de reporte según qué se reporta, en el orden en que se muestran. */
export const REPORT_REASONS: Record<ReportTarget, { value: ReportReason; label: string }[]> = {
    event: [
        { value: "fake", label: "Es falso o peligroso" },
        { value: "spam", label: "Es spam o publicidad" },
        { value: "offensive", label: "Es ofensivo" },
        { value: "other", label: "Otro motivo" },
    ],
    user: [
        { value: "fake", label: "Se hace pasar por otro" },
        { value: "spam", label: "Publica spam" },
        { value: "offensive", label: "Es ofensivo o acosa" },
        { value: "other", label: "Otro motivo" },
    ],
};

/** Reporta un evento. Un admin lo revisa desde el dashboard. */
export function useReportEvent() {
    return useMutation(api.reports.submit);
}

/** Reporta a un usuario (hoy, a un organizador desde su perfil). */
export function useReportUser() {
    return useMutation(api.reports.submitUser);
}
