import { api } from "@/lib/convex";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";

/** Perfil público de un organizador (`null` si no existe o no organiza, `undefined` mientras carga). */
export function useOrganizer(userId: string | undefined) {
    return useQuery(api.organizers.get, userId ? { userId: userId as Id<"users"> } : "skip");
}

/** Seguir / dejar de seguir. Actualiza el perfil al instante, sin esperar al servidor. */
export function useFollowToggle() {
    return useMutation(api.follows.toggle).withOptimisticUpdate((store, { organizerId }) => {
        const profile = store.getQuery(api.organizers.get, { userId: organizerId });
        if (!profile) return;
        const isFollowing = !profile.isFollowing;
        store.setQuery(api.organizers.get, { userId: organizerId }, {
            ...profile,
            isFollowing,
            followerCount: Math.max(0, profile.followerCount + (isFollowing ? 1 : -1)),
        });
    });
}
