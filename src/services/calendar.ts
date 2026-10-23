// La API nueva de expo-calendar (`calendar.addEventWithForm()`) pide permiso de calendario y en Android
// exige elegir uno. La legacy abre el formulario del sistema sin permisos: en Android es un intent
// ACTION_INSERT y en iOS 17+ el sistema no lo pide. Sólo iOS 16 lo necesita (texto en app.json).
import * as Calendar from "expo-calendar/legacy";
import { Platform } from "react-native";

import { showDialog } from "@/components/dialog";
import { eventUrl } from "@/lib/links";

type CalendarEvent = { slug: string; title: string; place: string; startsAt: number; endsAt: number };

const needsPermission = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) < 17;

/** Abre el formulario del calendario del teléfono con el evento ya cargado; el usuario confirma ahí. */
export async function addToCalendar(event: CalendarEvent) {
    try {
        if (needsPermission) {
            const { granted } = await Calendar.requestCalendarPermissionsAsync();
            if (!granted) {
                showDialog("Sin acceso al calendario", "Activalo en Ajustes para agregar encuentros.");
                return;
            }
        }
        const url = eventUrl(event.slug);
        await Calendar.createEventInCalendarAsync({
            title: event.title,
            location: event.place,
            startDate: new Date(event.startsAt),
            endDate: new Date(event.endsAt),
            notes: url,
            url,
        });
    } catch (error) {
        if (__DEV__) console.log("[calendar] falló:", error);
        showDialog("No pudimos abrir el calendario", "Probá de nuevo en un rato.");
    }
}
