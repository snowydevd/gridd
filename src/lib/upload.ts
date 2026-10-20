import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { Id } from "@/lib/convex";

/**
 * Achica una foto local a `width` px de ancho, la comprime como JPEG y la sube a la URL de Convex.
 * Devuelve el id del archivo para guardarlo en el documento.
 */
export async function uploadImage(uploadUrl: string, uri: string, width: number): Promise<Id<"_storage">> {
    const rendered = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
    const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

    // En React Native el blob de un file:// viene sin tipo, y fetch manda ese tipo vacío como
    // Content-Type (pisa el header). Convex lo rechaza con 400, así que se le pone el tipo al blob.
    const file = await (await fetch(photo.uri)).blob();
    const body = new Blob([file], { type: "image/jpeg" });
    const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body });
    if (!res.ok) throw new Error(`upload ${res.status}`);
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return storageId;
}
