import { showDialog } from "@/components/dialog";
import { api } from "@/lib/convex";
import { uploadImage } from "@/lib/upload";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

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

const AVATAR_SIZE = 512;

/** Elige una foto de la galería, la recorta cuadrada, la achica y la guarda como foto de perfil. */
export function useAvatarUpload() {
    const generateUploadUrl = useMutation(api.files.generateAvatarUploadUrl);
    const setAvatar = useMutation(api.users.setAvatar);
    const remove = useMutation(api.users.removeAvatar);
    const [isUploading, setUploading] = useState(false);

    const pickAndUpload = async () => {
        const picked = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1], // Android; en iOS el recorte ya es cuadrado.
            quality: 1, // Se comprime una sola vez, al achicarla.
        });
        if (picked.canceled) return;

        setUploading(true);
        try {
            // ~50–150 KB: alcanza para mostrarla en el perfil y no gasta datos.
            const storageId = await uploadImage(await generateUploadUrl(), picked.assets[0].uri, AVATAR_SIZE);
            await setAvatar({ storageId });
        } catch (error) {
            if (__DEV__) console.log("[avatar] no se pudo subir:", error);
            showDialog("No pudimos subir la foto", "Revisá tu conexión y probá de nuevo.");
        } finally {
            setUploading(false);
        }
    };

    const removeAvatar = async () => {
        try {
            await remove();
        } catch (error) {
            if (__DEV__) console.log("[avatar] no se pudo quitar:", error);
            showDialog("No pudimos quitar la foto", "Revisá tu conexión y probá de nuevo.");
        }
    };

    return { pickAndUpload, removeAvatar, isUploading };
}

/**
 * Elimina la cuenta en el backend y limpia la sesión guardada en el teléfono.
 * Falla con CONFLICT si quedan eventos próximos publicados.
 */
export function useDeleteAccount() {
    const deleteAccount = useMutation(api.users.deleteAccount)
    const { signOut } = useAuthActions()
    return async () => {
        await deleteAccount()
        // El backend ya borró la sesión: signOut sólo limpia el token local y puede fallar al avisarle al servidor.
        await signOut().catch(() => {})
    }
}
