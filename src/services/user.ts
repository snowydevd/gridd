import { api } from "@/lib/convex";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Alert } from "react-native";

import type { EventKind } from "@/services/events";


export function useCurrentUser(){
    const me = useQuery(api.users.me)
    const {signOut} = useAuthActions()
    return {
        user: me ?? null,
        isLoading: me === undefined,
        isSignedIn: !!me,
        isGuest: me === null,
        isPublisher: me?.role === "publisher" || me?.role === "admin",
        signOut
    }
}


export function useUserMeets() {
    const { isSignedIn, isPublisher } = useCurrentUser();
    const attending = useQuery(api.attendance.myEvents, isSignedIn ? {} : "skip");
    const mine = useQuery(api.events.listMine, isPublisher ? {} : "skip");
    // La hora se toma una vez al montar: llamar a Date.now() en cada render rompe la pureza del React Compiler.
    const [now] = useState(Date.now);
    return {
        attended: attending?.filter((e) => e.endsAt < now).length ?? 0,
        // Se anotó a algún evento, pasado o futuro (incluso cancelado). Organizar no cuenta.
        hasJoinedAny: (attending?.length ?? 0) > 0,
        organized: mine?.filter((e) => e.status === "published").length ?? 0,
        isLoading: (isSignedIn && attending === undefined) || (isPublisher && mine === undefined),
    };
}



const NO_INTERESTS: EventKind[] = [];

/** Categorías que le interesan al usuario, para ordenar "Para vos" en Inicio. Un invitado no tiene. */
export function useInterests() {
    const { user } = useCurrentUser();
    // Actualiza `users.me` al instante para que el perfil e Inicio cambien sin esperar al servidor.
    const save = useMutation(api.users.setInterests).withOptimisticUpdate((store, { interests }) => {
        const me = store.getQuery(api.users.me, {});
        if (me) store.setQuery(api.users.me, {}, { ...me, interests: [...new Set(interests)] });
    });
    const setInterests = (next: EventKind[]) => save({ interests: next });
    return { interests: user?.interests ?? NO_INTERESTS, setInterests };
}

/** Elige una foto de la galería, la sube y la guarda como foto de perfil. */
export function useAvatarUpload() {
    // TODO(backend): expo-image-picker (recorte cuadrado, calidad ~0.7) → `files.generateAvatarUploadUrl`
    // → `users.setAvatar`. Hasta que exista el backend sólo avisa.
    const pickAndUpload = async () => {
        Alert.alert("Muy pronto", "Todavía no se puede subir la foto de perfil.");
    };
    return { pickAndUpload, isUploading: false };
}
