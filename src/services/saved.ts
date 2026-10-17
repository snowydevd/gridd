import { api, type Id } from "@/lib/convex";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";

import { useCurrentUser } from "@/services/user";

/** Eventos guardados del usuario (vacío si es invitado). `isLoading` mientras llega la primera respuesta. */
export function useSavedEvents() {
    const { isSignedIn } = useCurrentUser();
    const events = useQuery(api.saves.mySaved, isSignedIn ? {} : "skip");
    return { events: events ?? [], isLoading: isSignedIn && events === undefined };
}

/**
 * Si el evento está guardado y cómo guardarlo/quitarlo. Sin `eventId` (eventos de ejemplo) no hace nada.
 * Los invitados van al login en vez de guardar.
 */
export function useSaveToggle(eventId: Id<"events"> | undefined) {
    const { isSignedIn } = useCurrentUser();
    const saved = useQuery(api.saves.isSaved, eventId && isSignedIn ? { eventId } : "skip") ?? false;
    // Cambia el ícono al instante; si el servidor falla, Convex lo revierte solo.
    const toggleSave = useMutation(api.saves.toggle).withOptimisticUpdate((store, { eventId }) => {
        const current = store.getQuery(api.saves.isSaved, { eventId });
        if (current !== undefined) store.setQuery(api.saves.isSaved, { eventId }, !current);
    });

    const toggle = () => {
        if (!eventId) return;
        if (!isSignedIn) {
            router.push("/login");
            return;
        }
        toggleSave({ eventId }).catch((error) => {
            if (__DEV__) console.log("[saves] toggle falló:", error);
        });
    };

    return { saved, toggle };
}
