import { api } from "@/lib/convex";
import { useMutation, useQuery } from "convex/react";

import { useCurrentUser } from "@/services/user";

export const REQUEST_MIN = 10;
export const REQUEST_MAX = 500;

/**
 * La última solicitud para organizar del usuario (`null` si nunca pidió, `undefined` mientras carga)
 * y la mutación para enviar una. A un publisher no le hace falta: la consulta se saltea.
 */
export function usePublisherRequest() {
    const { isSignedIn, isPublisher } = useCurrentUser();
    const request = useQuery(api.publisherRequests.mine, isSignedIn && !isPublisher ? {} : "skip");
    const submit = useMutation(api.publisherRequests.submit);
    return { request, status: request?.status ?? null, submit };
}

export const REQUEST_STATUS_LABELS = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" } as const;
