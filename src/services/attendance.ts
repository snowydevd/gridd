import { api, type Id } from "@/lib/convex";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Alert } from "react-native";

import { carErrorMessage } from "@/services/cars";
import { useCurrentUser } from "@/services/user";

/**
 * Si el usuario va al evento y cómo anotarse/darse de baja. Sin `eventId` (eventos de ejemplo) no hace nada.
 * Para invitados no hace nada: la pantalla los manda al login. A diferencia de guardar, no es optimista:
 * el botón cambia recién cuando el servidor confirma, porque puede rechazar la asistencia (evento
 * terminado o no publicado).
 */
export function useAttendanceToggle(eventId: Id<"events"> | undefined) {
    const { isSignedIn } = useCurrentUser();
    const attending = useQuery(api.attendance.isAttending, eventId && isSignedIn ? { eventId } : "skip");
    const toggleAttendance = useMutation(api.attendance.toggle);
    const [pending, setPending] = useState(false);

    const toggle = async () => {
        if (!eventId || !isSignedIn || pending) return;
        setPending(true);
        try {
            await toggleAttendance({ eventId });
        } catch (error) {
            Alert.alert("No pudimos anotarte", carErrorMessage(error, "Revisá tu conexión y probá de nuevo."));
        } finally {
            setPending(false);
        }
    };

    return {
        attending: attending ?? false,
        // También mientras llega el estado inicial, para no mostrar "Voy!" a quien ya va.
        loading: pending || (isSignedIn && !!eventId && attending === undefined),
        toggle,
    };
}

/**
 * Eventos a los que el usuario se anotó y todavía no terminaron, por fecha. Incluye los cancelados para
 * que se entere. Vacío si es invitado; `isLoading` mientras llega la primera respuesta.
 */
export function useMyUpcomingEvents() {
    const { isSignedIn } = useCurrentUser();
    const events = useQuery(api.attendance.myEvents, isSignedIn ? {} : "skip");
    // La hora se toma una vez al montar: llamar a Date.now() en cada render rompe la pureza del React Compiler.
    const [now] = useState(Date.now);
    return {
        events: events?.filter((e) => e.endsAt >= now) ?? [],
        isLoading: isSignedIn && events === undefined,
    };
}
