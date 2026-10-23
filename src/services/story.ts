import { useAction } from "convex/react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";

import { showDialog } from "@/components/dialog";
import { api } from "@/lib/convex";
import { carErrorMessage } from "@/services/cars";

/**
 * Genera la imagen para historia de un evento (Convex la renderiza) y abre el menú del sistema para
 * compartirla: Instagram, WhatsApp o guardarla. Tarda uno o dos segundos; `loading` mientras tanto.
 */
export function useShareStory() {
    const render = useAction(api.stories.eventStory);
    const [loading, setLoading] = useState(false);

    const share = async (slug: string) => {
        if (loading) return;
        setLoading(true);
        try {
            const bytes = await render({ slug });
            // Siempre el mismo nombre por evento: se pisa y no se acumulan archivos en la caché.
            const file = new File(Paths.cache, `gridd-historia-${slug}.jpg`);
            file.write(new Uint8Array(bytes));
            await Sharing.shareAsync(file.uri, { mimeType: "image/jpeg", UTI: "public.jpeg", dialogTitle: "Compartir historia" });
        } catch (error) {
            if (__DEV__) console.log("[story] falló:", error);
            showDialog("No pudimos armar la imagen", carErrorMessage(error, "Revisá tu conexión y probá de nuevo."));
        } finally {
            setLoading(false);
        }
    };

    return { share, loading };
}
