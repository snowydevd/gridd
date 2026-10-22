import { api } from "@/lib/convex";
import { uploadImage } from "@/lib/upload";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { ImageSource } from "expo-image";
import { useEffect, useState } from "react";

import { DAY, UY_BOUNDS } from "../../convex/lib/validation";

const PAGE_SIZE = 5

/** Próximos eventos paginados. `kind` filtra en el servidor; `pageSize` es cuántos trae por página. */
export function useUpcomingEvents({ kind, pageSize = PAGE_SIZE }: { kind?: EventKind; pageSize?: number } = {}){
    // La hora se fija al montar: si cambiara entre páginas, el servidor rechazaría los cursores.
    const [now] = useState(Date.now);
    const {results, status, loadMore} = usePaginatedQuery(
        api.events.listUpcoming, 
        kind ? { now, kind } : { now }, 
        { initialNumItems: pageSize }
    )

    return{
        events: results ?? [],
        isLoading: status === "LoadingFirstPage",
        canLoadMore: status === "CanLoadMore",
        loadMore: () => loadMore(pageSize)
    }
}

/**
 * Eventos para el mapa: los publicados en todo Uruguay que todavía no terminaron, por fecha de inicio.
 * `undefined` mientras carga.
 */
export function useMapEvents() {
    // La consulta se arma una vez al montar (un evento puede durar hasta 7 días, por eso arranca una
    // semana atrás). El mapa queda montado al cambiar de tab, así que la hora para descartar los que
    // terminaron se actualiza cada minuto.
    const [from] = useState(() => Date.now() - 7 * DAY);
    const events = useQuery(api.events.listInBounds, { ...UY_BOUNDS, from, to: from + 90 * DAY });
    const now = useNow(60_000);
    return events?.filter((e) => e.endsAt >= now);
}

/** Hora actual, refrescada cada `intervalMs`. */
function useNow(intervalMs: number) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}

/** Ancho al que se achica la portada: alcanza para el hero de Inicio y la ficha sin gastar datos. */
const COVER_WIDTH = 1280;

export type NewEvent = Omit<FunctionArgs<typeof api.events.create>, "imageId">;

/**
 * Publica un evento: sube la portada (si hay) y lo crea. Devuelve el slug para abrir la ficha.
 * Los errores del backend llegan como ConvexError, con el mensaje en `error.data.message`.
 */
export function usePublishEvent() {
    const generateUploadUrl = useMutation(api.files.generateUploadUrl);
    const create = useMutation(api.events.create);

    return async (event: NewEvent, coverUri?: string) => {
        const imageId = coverUri ? await uploadImage(await generateUploadUrl(), coverUri, COVER_WIDTH) : undefined;
        const { slug } = await create({ ...event, imageId });
        return slug;
    };
}

/** Un evento por slug (`null` si no existe, `undefined` mientras carga). */
export function useEventBySlug(slug: string | undefined) {
    return useQuery(api.events.getBySlug, slug ? { slug } : "skip");
}   





// ---------- Adaptador Convex → tarjetas ----------

/** Lo que muestran las tarjetas y el detalle de un evento. */
export type MeetEvent = {
    id: string;
    title: string;
    /** Etiqueta de la categoría (`KIND_LABELS`). */
    category: string;
    /** Short day label shown on cards: "Hoy", "Sáb 15", "Oct 28"... */
    day: string;
    /** Long date for the detail screen. */
    date: string;
    time: string;
    endTime?: string;
    isToday?: boolean;
    place: string;
    area: string;
    /** Sin la ubicación del usuario no se puede calcular. */
    distanceKm?: number;
    going: number;
    image: ImageSource;
    description: string;
    organizer: { name: string; initials: string; verified?: boolean };
    /** Position on the stylized map, as 0–1 fractions of its width/height. */
    map: { x: number; y: number };
    /** Ubicación real, para el mapa nativo. */
    coords: { latitude: number; longitude: number };
    past?: boolean;
};

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
