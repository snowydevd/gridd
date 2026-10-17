import { api } from "@/lib/convex";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useState } from "react";


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
        organized: mine?.filter((e) => e.status === "published").length ?? 0,
        isLoading: (isSignedIn && attending === undefined) || (isPublisher && mine === undefined),
    };
}

