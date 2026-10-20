# Plan de implementación: foto de perfil

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el usuario pueda elegir una foto de la galería, recortarla cuadrada y guardarla como foto de perfil. La foto se ve en el perfil y como organizador de sus eventos. También se puede quitar.

**Architecture:**
- La foto subida va al storage de Convex y el usuario guarda su id en un campo nuevo, `users.avatarId`.
- `users.image` **no se toca**. Es la foto que trae el login de Google/Apple, y Convex Auth la puede pisar en cada login. Por eso la foto propia vive aparte y tiene prioridad.
- Un helper `avatarUrl(ctx, user)` resuelve qué URL mostrar: `avatarId` primero y `image` después. Lo usan `users.me` y `toEventView`, así la app sigue leyendo `image` y no cambia ningún componente que muestre la foto.
- La subida usa el flujo de Convex de 3 pasos:
  1. `files.generateAvatarUploadUrl`;
  2. `POST` del archivo;
  3. `users.setAvatar({ storageId })`.
- Antes de subir, el cliente achica la foto a 512 px en JPEG. Pesa ~50–150 KB, y así no se suben fotos de 5 MB para mostrarlas en 88 px.

**Tech Stack:**
- Expo SDK 57: `expo-image-picker` y `expo-image-manipulator`, ambos nuevos.
- Convex 1.46 file storage.
- vitest + `convex-test`.

**Base:** rama `dev`. Si `feature/user-interests` ya se mergeó, rebasar encima: los dos tocan `convex/schema.ts`, `convex/users.ts` y `src/services/user.ts` (choques chicos, en líneas distintas).

## Global Constraints

- Tipos aceptados: `image/jpeg`, `image/png`, `image/webp`. Tamaño máximo en el servidor: **2 MB**. Es un tope de seguridad, porque el cliente ya manda ~100 KB.
- Un archivo inválido **se borra del storage** antes de fallar, para no dejar basura.
- Un `storageId` que ya usa otro usuario (`users.avatarId`) o un evento (`events.imageId`) no se puede tomar → `FORBIDDEN`. Es el mismo criterio que `assertImageExists` en `convex/events.ts`. Sin este chequeo, alguien podría "robar" la foto de otro y borrársela al cambiar la suya.
- Al reemplazar o quitar la foto, se borra el archivo anterior con `ctx.storage.delete`.
- Los mensajes de error van en español rioplatense, con los códigos de `convex/lib/errors.ts`.
- Expo: instalar siempre con `bunx expo install`. Los dos paquetes traen código nativo, así que hace falta **un dev build nuevo**: `bunx expo run:android` o `bunx eas-cli build --profile development`.
- No hay que tocar `android/` a mano: la configuración va en `app.json`.

## Archivos

| Archivo | Cambio |
|---|---|
| `convex/schema.ts` | `users.avatarId: v.optional(v.id("_storage"))` + índice `by_avatar` |
| `convex/lib/avatar.ts` (nuevo) | `avatarUrl(ctx, user)` y `assertAvatarFile(ctx, storageId, userId)` |
| `convex/files.ts` | `generateAvatarUploadUrl` (cualquier usuario logueado) |
| `convex/users.ts` | `me` usa `avatarUrl`; nuevas `setAvatar` y `removeAvatar` |
| `convex/lib/eventView.ts` | `organizer.image` usa `avatarUrl` |
| `convex/users.avatar.test.ts` (nuevo) | Tests del flujo |
| `app.json` | Plugin `expo-image-picker` con `photosPermission`, sin cámara ni micrófono |
| `src/services/user.ts` | `useAvatarUpload` real + `removeAvatar` |
| `src/app/(tabs)/profile.tsx` | Tocar la foto abre "Cambiar foto / Quitar foto" |

`src/components/account-cards.tsx` ya llama a `useAvatarUpload().pickAndUpload` y marca la tarjeta como completa con `user.image`, así que no necesita cambios.

---

## Task 1: Schema y helper de avatar

- [ ] En `convex/schema.ts`, dentro de `users`:
  ```ts
  // Foto subida por el usuario. Tiene prioridad sobre `image` (la del login social).
  avatarId: v.optional(v.id("_storage")),
  ```
  y agregar `.index("by_avatar", ["avatarId"])` a la tabla.
- [ ] Crear `convex/lib/avatar.ts`:
  ```ts
  import type { Doc, Id } from "../_generated/dataModel";
  import type { MutationCtx, QueryCtx } from "../_generated/server";
  import { fail } from "./errors";

  export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
  export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

  /** La foto a mostrar: la subida si hay, si no la del login social. */
  export async function avatarUrl(ctx: QueryCtx, user: Doc<"users">) {
    if (user.avatarId) return await ctx.storage.getUrl(user.avatarId);
    return user.image ?? null;
  }

  /** Valida un archivo recién subido para usarlo de avatar. Si es inválido lo borra. */
  export async function assertAvatarFile(ctx: MutationCtx, storageId: Id<"_storage">, userId: Id<"users">) {
    const file = await ctx.db.system.get(storageId);
    if (!file) fail("INVALID", "La foto no existe. Volvé a subirla.");
    const owner = await ctx.db.query("users").withIndex("by_avatar", (q) => q.eq("avatarId", storageId)).first();
    if (owner && owner._id !== userId) fail("FORBIDDEN", "Esa foto pertenece a otro usuario.");
    const event = await ctx.db.query("events").withIndex("by_image", (q) => q.eq("imageId", storageId)).first();
    if (event) fail("FORBIDDEN", "Esa imagen pertenece a un evento.");
    if (!file.contentType || !AVATAR_TYPES.includes(file.contentType) || file.size > AVATAR_MAX_BYTES) {
      await ctx.storage.delete(storageId);
      fail("INVALID", "La foto tiene que ser JPG, PNG o WebP de hasta 2 MB.");
    }
  }
  ```
  Ojo con el orden: los chequeos de dueño van **antes** del `delete`. Si no, un archivo ajeno inválido terminaría borrado.

## Task 2: Funciones de Convex

- [ ] En `convex/files.ts`:
  ```ts
  /** Cualquier usuario logueado puede subir su foto de perfil. */
  export const generateAvatarUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
      await requireUser(ctx);
      return await ctx.storage.generateUploadUrl();
    },
  });
  ```
- [ ] En `convex/users.ts`:
  - `me`: `image: await avatarUrl(ctx, user)`.
  - `setAvatar({ storageId: v.id("_storage") })`:
    1. `requireUser`.
    2. `assertAvatarFile`.
    3. Si `user.avatarId` existe y es distinto, `ctx.storage.delete(user.avatarId)`.
    4. `patch({ avatarId: storageId, updatedAt })`.
  - `removeAvatar({})`:
    1. `requireUser`.
    2. Si hay `avatarId`, borrar el archivo y hacer `patch({ avatarId: undefined, updatedAt })`.
    3. La foto vuelve a ser la del login social, si había.
- [ ] En `convex/lib/eventView.ts`: `image: await avatarUrl(ctx, organizer)`.

## Task 3: Tests de backend (`convex/users.avatar.test.ts`)

Para subir archivos en los tests: `await t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "image/jpeg" })))`.

- [ ] `generateAvatarUploadUrl`: anónimo → `UNAUTHENTICATED`; un usuario común recibe un string.
- [ ] `setAvatar` guarda el id y `me.image` pasa a ser la URL del storage.
- [ ] Con foto subida, `me.image` ignora `users.image`. Con `removeAvatar`, vuelve a `users.image`.
- [ ] Reemplazar la foto borra el archivo anterior: `ctx.db.system.get(viejo)` da `null`.
- [ ] Tipo inválido (`text/plain`) → `INVALID`, y el archivo queda borrado.
- [ ] Más de 2 MB → `INVALID`. Con un Blob de 2 MB + 1 byte alcanza.
- [ ] Usar el avatar de otro usuario → `FORBIDDEN`, y el archivo del otro **sigue existiendo**.
- [ ] Usar la imagen de un evento → `FORBIDDEN`.
- [ ] `toEventView` devuelve el avatar subido del organizador.
- [ ] `bun run test` y `bun run typecheck` en verde.

## Task 4: Dependencias nativas y permisos

- [ ] `bunx expo install expo-image-picker expo-image-manipulator`
- [ ] En `app.json`, `plugins`:
  ```json
  ["expo-image-picker", {
    "photosPermission": "Gridd usa tus fotos para que elijas tu foto de perfil.",
    "cameraPermission": false,
    "microphonePermission": false
  }]
  ```
  Con `cameraPermission: false` no se pide `CAMERA` en Android. Si más adelante queremos "Sacar foto", se activa y se agrega `launchCameraAsync`.
- [ ] Hacer un dev build nuevo y verificar que la app abre.

## Task 5: `useAvatarUpload` en `src/services/user.ts`

Reemplazar el stub actual:

```ts
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

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
            quality: 1, // Se comprime una sola vez, abajo.
        });
        if (picked.canceled) return;

        setUploading(true);
        try {
            const rendered = await ImageManipulator.manipulate(picked.assets[0].uri)
                .resize({ width: AVATAR_SIZE })
                .renderAsync();
            const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

            const uploadUrl = await generateUploadUrl();
            const body = await (await fetch(photo.uri)).blob();
            const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body });
            if (!res.ok) throw new Error(`upload ${res.status}`);
            const { storageId } = await res.json();
            await setAvatar({ storageId });
        } catch (error) {
            if (__DEV__) console.log("[avatar] no se pudo subir:", error);
            Alert.alert("No pudimos subir la foto", "Revisá tu conexión y probá de nuevo.");
        } finally {
            setUploading(false);
        }
    };

    return { pickAndUpload, removeAvatar: () => remove(), isUploading };
}
```

- [ ] Probar en Android que `fetch(photo.uri).blob()` funcione con `file://`. Si falla, usar `File` de `expo-file-system` (SDK 57), que se puede pasar directo como `body`.
- [ ] No hace falta `requestMediaLibraryPermissionsAsync`: según los docs de SDK 57, abrir la galería para fotos no pide permiso.

## Task 6: UI del perfil

- [ ] En `src/app/(tabs)/profile.tsx`, envolver el `<Image>` del avatar en un `Pressable` con `accessibilityLabel="Cambiar foto de perfil"` y un badge chico con el ícono de cámara/editar (ver `Icon` en `src/components/icon.tsx`).
- [ ] Al tocarlo:
  - si no hay foto propia, llamar directo a `pickAndUpload()`;
  - si hay, abrir `Alert.alert('Foto de perfil', undefined, [{ text: 'Cambiar foto' }, { text: 'Quitar foto', style: 'destructive' }, { text: 'Cancelar', style: 'cancel' }])`.

  Para saber si la foto es propia, agregar `hasAvatar: !!user.avatarId` a `users.me`.
- [ ] Mientras `isUploading`, mostrar un `ActivityIndicator` encima del avatar.
- [ ] La tarjeta "Foto de perfil" de `AccountCards` ya queda funcionando sola.

## Task 7: Verificación manual (dev build en el emulador)

- [ ] Perfil → tocar avatar → elegir foto → recortar → se ve la foto nueva en el perfil.
- [ ] Inicio/Perfil: la tarjeta "Foto de perfil" de "Completá tu cuenta" desaparece.
- [ ] Cancelar el picker no muestra error ni deja el spinner colgado.
- [ ] "Quitar foto" vuelve al avatar por defecto, o al de Google si se logueó con Google.
- [ ] Un evento organizado por el usuario muestra la foto nueva en el detalle.
- [ ] En el dashboard de Convex → Files, después de cambiar la foto 2 veces queda **un solo** archivo del usuario.
- [ ] Modo avión → subir → aparece el alert de error y la foto anterior sigue igual.
- [ ] `bun run typecheck`, `bun run test` y `bunx expo lint` en verde.

## Fuera de alcance / después

- **Archivos huérfanos:** si la app se cierra entre el `POST` y `setAvatar`, el archivo queda sin dueño. Más adelante conviene un cron diario que borre de `_storage` los archivos de más de 24 h que no referencie ningún `users.avatarId` ni `events.imageId`. Ver la skill `convex:crons`.
- Sacar foto con la cámara.
- Mostrar el avatar del organizador en el detalle del evento: hoy `src/app/event/[id].tsx` muestra iniciales. El dato ya va a venir en `organizer.image`.
