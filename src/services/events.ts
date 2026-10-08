import type { MeetEvent } from "@/data/events";
import { api } from "@/lib/convex";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

const PAGE_SIZE = 5

/** Próximos eventos paginados. `kind` filtra en el servidor; `pageSize` es cuántos trae por página. */
export function useUpcomingEvents({ kind, pageSize = PAGE_SIZE }: { kind?: EventKind; pageSize?: number } = {}){
    const {results, status, loadMore} = usePaginatedQuery(
        api.events.listUpcoming, 
        kind ? { kind } : {}, 
        { initialNumItems: pageSize }
    )

    return{
        events: results ?? [],
        isLoading: status === "LoadingFirstPage",
        canLoadMore: status === "CanLoadMore",
        loadMore: () => loadMore(pageSize)
    }
}

/** Un evento por slug (`null` si no existe, `undefined` mientras carga). */
export function useEventBySlug(slug: string | undefined) {
    return useQuery(api.events.getBySlug, slug ? { slug } : "skip");
}   





// ---------- Adaptador Convex → tarjetas ----------

export type EventView = FunctionReturnType<typeof api.events.listUpcoming>["page"][number];
export type EventKind = EventView["kind"];

/** Etiquetas en español de los `kind` del backend (convex/lib/validators.ts), en el orden de los chips. */
export const KIND_LABELS: Record<EventKind, string> = {
    junada: "Junada",
    rodada: "Rodada",
    cars_and_coffee: "Cars & Coffee",
    expo: "Exposición",
    clasicos: "Clásicos",
    jdm: "JDM",
    tuning: "Tuning",
    "4x4": "4x4",
    motos: "Motos",
    pista: "Pista",
    otro: "Otro",
};
export const EVENT_KINDS = Object.keys(KIND_LABELS) as EventKind[];

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const pad = (n: number) => String(n).padStart(2, "0");
const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Hoy" / "Mañana" / "Sáb 15" para las tarjetas, y la fecha larga para el detalle. */
function formatWhen(startsAt: number, now: Date) {
    const start = new Date(startsAt);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isToday = sameDay(start, now);
    const long = `${DAY_LONG[start.getDay()]} ${start.getDate()} de ${MONTHS[start.getMonth()]}`;
    return {
        isToday,
        day: isToday ? "Hoy" : sameDay(start, tomorrow) ? "Mañana" : `${DAY_SHORT[start.getDay()]} ${start.getDate()}`,
        date: isToday ? `Hoy, ${long}` : capitalize(long),
    };
}

const formatTime = (ms: number) => {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function initials(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words.slice(0, 3).map((w) => w[0]) : [name.slice(0, 2)]).join("").toUpperCase();
}

type LatLng = { latitude: number; longitude: number };

/** Distancia en km entre dos puntos (fórmula de haversine). */
function distanceKm(a: LatLng, b: LatLng) {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Área que cubre el mapa estilizado de web (Montevideo + Costa de Oro), para ubicar los pines en 0–1.
const WEB_MAP = { minLat: -34.96, maxLat: -34.76, minLon: -56.16, maxLon: -55.92 };
const clamp01 = (n: number) => Math.min(0.95, Math.max(0.05, n));

const DEFAULT_EVENT_IMAGE = require("@/assets/images/meets/midnight-rambla.jpg");

/**
 * Convierte un evento de Convex a la forma que usan las tarjetas (`MeetEvent`).
 * `userLocation` es opcional: sin ella no se calcula la distancia y las tarjetas no la muestran.
 */
export function toCardEvent(event: EventView, userLocation?: LatLng | null, now = new Date()): MeetEvent {
    const when = formatWhen(event.startsAt, now);
    const coords = { latitude: event.lat, longitude: event.lon };
    const organizerName = event.organizer?.name ?? "Organizador";
    return {
        // El slug es lo que va a usar el detalle (`events.getBySlug`).
        id: event.slug,
        title: event.title,
        category: KIND_LABELS[event.kind],
        ...when,
        time: formatTime(event.startsAt),
        endTime: formatTime(event.endsAt),
        // Convex guarda un solo texto de lugar.
        place: event.placeName,
        area: event.placeName,
        distanceKm: userLocation ? distanceKm(userLocation, coords) : undefined,
        going: event.attendeeCount,
        image: event.imageUrl ? { uri: event.imageUrl } : DEFAULT_EVENT_IMAGE,
        description: event.description,
        organizer: { name: organizerName, initials: initials(organizerName) },
        coords,
        map: {
            x: clamp01((event.lon - WEB_MAP.minLon) / (WEB_MAP.maxLon - WEB_MAP.minLon)),
            y: clamp01((WEB_MAP.maxLat - event.lat) / (WEB_MAP.maxLat - WEB_MAP.minLat)),
        },
        past: event.endsAt < now.getTime(),
    };
}
