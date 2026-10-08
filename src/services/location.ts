import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type LatLng = { latitude: number; longitude: number };

/**
 * Última ubicación conocida del usuario, sólo si ya dio permiso (no lo pide: eso lo hace el mapa
 * con el botón "Centrar en mi ubicación"). `null` mientras tanto o si no hay permiso.
 */
export function useLastKnownLocation() {
    const [location, setLocation] = useState<LatLng | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status !== "granted") return;
                const position = await Location.getLastKnownPositionAsync();
                if (active && position) {
                    setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
                }
            } catch {
                // Sin GPS o sin servicios de ubicación: Inicio funciona igual, sin distancias.
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    return location;
}
