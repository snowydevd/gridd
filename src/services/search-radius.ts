import { api } from "@/lib/convex";
import { useMutation } from "convex/react";

import { useCurrentUser } from "@/services/user";
import {
    DEFAULT_SEARCH_RADIUS,
    SEARCH_RADII,
    searchRadiusLabel,
    withinRadius,
    type SearchRadius,
} from "../../convex/lib/searchRadius";

export { SEARCH_RADII, searchRadiusLabel, withinRadius, type SearchRadius };

/** Rango de "Cerca tuyo" del usuario (el de por defecto si es invitado) y cómo cambiarlo. */
export function useSearchRadius() {
    const { user } = useCurrentUser();
    // Actualiza `users.me` al instante para que el perfil e Inicio cambien sin esperar al servidor.
    const save = useMutation(api.users.setSearchRadius).withOptimisticUpdate((store, { radius }) => {
        const me = store.getQuery(api.users.me, {});
        if (me) store.setQuery(api.users.me, {}, { ...me, searchRadius: radius });
    });

    const setRadius = (radius: SearchRadius) => {
        if (!user) return;
        save({ radius }).catch((error) => {
            if (__DEV__) console.log("[searchRadius] no se pudo guardar:", error);
        });
    };

    return { radius: user?.searchRadius ?? DEFAULT_SEARCH_RADIUS, setRadius };
}
