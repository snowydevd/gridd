# Plan: publicación automática en Instagram para Gridd

> Plan de implementación para Claude Code. Leelo completo antes de empezar. Ejecutá las fases en orden y, al terminar cada una, frená y mostrame un resumen de lo hecho antes de seguir.

## Contexto

Gridd (gridd.app) es una plataforma que agrega car meets, empezando por Uruguay. El backend es **Convex**. Queremos un sistema que genere, agende y publique en la cuenta de Instagram de Gridd posts promocionales: por qué descargar Gridd, qué hace, features, beneficios para organizadores, etc.

Flujo objetivo:

```
generar lote (copy + imagen) → draft → aprobación manual → approved + scheduledAt → cron publica → published
```

**Identidad visual**
- Fondo `#0B0B0C`, acento `#DFFF00` (amarillo fluorescente).
- Wordmark tipográfico "GR|DD": una barra `|` reemplaza la "I".

**Idioma de los posts:** español rioplatense (Uruguay), tono cercano y "fierrero", sin sonar a IA corporativa.

## Restricciones y decisiones ya tomadas

- Usar **Instagram API with Instagram Login** (host `graph.instagram.com`, permiso `instagram_business_content_publish`). No usar la variante de Facebook Login.
- La cuenta de Instagram es profesional (Business o Creator). Solo publicamos en nuestra propia cuenta, sin OAuth multiusuario.
- Las imágenes que se publican deben ser **JPEG** y estar en una **URL pública**. Usar Convex File Storage con `ctx.storage.getUrl()`.
- La publicación es en dos pasos: crear un contenedor (`POST /{ig-user-id}/media`), esperar `status_code === "FINISHED"` y después llamar a `POST /{ig-user-id}/media_publish`.
- La API publica en el momento. **El agendado lo hacemos nosotros** con crons de Convex.
- **Nunca publicar sin aprobación humana.** Ningún código puede pasar un post de `draft` a `approved` automáticamente.
- La versión de la Graph API va en una env var (`IG_GRAPH_VERSION`), no hardcodeada.
- **Token:** el long-lived token dura ~60 días y se refresca con `GET /refresh_access_token?grant_type=ig_refresh_token`. Como las env vars no se pueden modificar desde funciones, el token vigente se guarda en una tabla interna. La env var `IG_ACCESS_TOKEN` solo sirve como valor inicial (seed).
- Ningún secreto o token puede ser accesible desde queries o mutations públicas.

## Fase 0: Reconocimiento (sin escribir código)

Antes de tocar nada, revisá y reportame:

1. La versión de `convex` en `package.json` y la estructura de `convex/`.
2. `convex/schema.ts`: tablas existentes y convenciones de nombres.
3. El sistema de auth (Convex Auth, Clerk, otro) y si existe un concepto de admin/rol.
4. Si ya existen `convex/crons.ts`, `convex/http.ts` o actions con `"use node"`.
5. Si `convex.json` declara `node.externalPackages`.
6. Si ya hay alguna integración con un LLM (Anthropic u otro) y cómo se maneja la API key.

Con eso proponé ajustes a este plan si algo no encaja con el repo. **Esperá mi OK.**

## Fase 1: Modelo de datos

Agregá a `convex/schema.ts`:

```ts
igPosts: defineTable({
  caption: v.string(),
  angle: v.string(),                       // ángulo de contenido usado (ver Fase 5)
  images: v.array(v.id("_storage")),       // 1 = post simple, 2–10 = carrusel
  status: v.union(
    v.literal("draft"),
    v.literal("approved"),
    v.literal("publishing"),
    v.literal("published"),
    v.literal("failed"),
    v.literal("rejected"),
  ),
  scheduledAt: v.optional(v.number()),     // ms epoch
  containerId: v.optional(v.string()),
  igMediaId: v.optional(v.string()),
  permalink: v.optional(v.string()),
  attempts: v.number(),
  lastError: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
  batchId: v.optional(v.string()),
})
  .index("by_status_scheduledAt", ["status", "scheduledAt"])
  .index("by_batch", ["batchId"]),

igCredentials: defineTable({
  accessToken: v.string(),
  igUserId: v.string(),
  expiresAt: v.number(),
  refreshedAt: v.number(),
}),
```

Funciones en `convex/instagram/posts.ts`, todas internas salvo donde se indique:

- `internalMutation createDraft`
- `internalMutation markPublishing` debe ser **atómica**: solo pasa a `publishing` si el status actual es `approved`. Es el lock contra doble publicación.
- `internalMutation markPublished`
- `internalMutation markFailed`: incrementa `attempts` y guarda `lastError`.
- `internalQuery dueApproved`: posts `approved` con `scheduledAt <= now`.
- Si la Fase 0 confirma que existe un rol admin: `mutation approve`, `reject`, `reschedule` y `query listByStatus`, protegidas por ese rol. Si no existe, **no crear funciones públicas**; la aprobación se hace desde el dashboard de Convex.

## Fase 2: Cliente de Instagram

Archivo `convex/instagram/client.ts` (`"use node"` solo si hace falta; `fetch` funciona en el runtime default).

- `internalAction getCredentials`: lee `igCredentials`. Si la tabla está vacía, hace el seed desde `IG_ACCESS_TOKEN` + `IG_USER_ID`.
- `createImageContainer({ imageUrl, caption?, isCarouselItem? })`
- `createCarouselContainer({ children, caption })`
- `waitForContainer(containerId)`: hace polling a `GET /{container-id}?fields=status_code,status` con backoff, timeout aprox. de 2 minutos. Si el status es `ERROR` o `EXPIRED`, lanza un error con el texto que devuelve Meta.
- `publishContainer(containerId)` → devuelve `igMediaId`.
- `getPermalink(igMediaId)`: si falla, no marca el post como fallido (el post ya está arriba).
- `getPublishingLimit()` → `GET /{ig-user-id}/content_publishing_limit` (para logging).
- `internalAction refreshToken`: guarda el nuevo token y su `expiresAt`.

**Modo dry-run:** si `IG_DRY_RUN === "true"`, loguea las requests y devuelve IDs falsos sin llamar a Meta.

**Prueba manual:** `internalAction publishTest({ postId })` para dispararlo desde el dashboard o con `npx convex run`.

## Fase 3: Scheduler y crons

Archivo `convex/instagram/scheduler.ts`:

- `internalAction publishDue`: por cada post de `dueApproved`:
  1. `markPublishing` (si falla el lock, saltear).
  2. Obtener las URLs de las imágenes con `ctx.storage.getUrl`.
  3. Crear el contenedor (simple o carrusel), esperar a que esté listo y publicarlo.
  4. `markPublished` o `markFailed`.

  Hasta 3 intentos: si `attempts < 3`, volver a `approved` con `scheduledAt` = now + 30 min; si no, queda en `failed`.

  **Importante:** si el post ya tiene `containerId` y `igMediaId`, no republicar. Hay que evitar duplicados si un reintento ocurre después de un publish exitoso.

En `convex/crons.ts`:

- `publishDue` cada 15 minutos.
- `refreshToken` semanal. Además, si `expiresAt` está a menos de 10 días, refrescar en el próximo `publishDue`.

## Fase 4: Plantillas de imagen

Generar los JPEG desde plantillas con la identidad de Gridd.

- **Propuesta:** `satori` (JSX → SVG) + `@resvg/resvg-wasm` o `@resvg/resvg-js` (SVG → PNG) + una conversión a JPEG.
- **Verificar** qué funciona en el runtime Node de Convex. Preferir librerías **pure JS/WASM** (por ejemplo `jpeg-js`) antes que nativas como `sharp`. Si una nativa es inevitable, configurarla en `node.externalPackages` y avisarme.
- Fuentes: incluir los archivos `.ttf`/`.woff` necesarios para satori. **Preguntame qué tipografía usar**, no inventar una.
- Formato **1080×1350 (4:5)**.
- Plantillas iniciales, en `convex/instagram/templates/`:
  1. `headline`: frase grande + wordmark + CTA "Descargá Gridd".
  2. `feature`: título de la feature + 2–3 bullets + slot opcional para un screenshot de la app.
  3. `carousel`: portada + 2–4 slides + slide final con CTA.
- Si falta un asset (screenshot, logo en SVG), dejá un placeholder marcado y avisame. No generar imágenes con IA.
- `internalAction renderTemplate({ template, data })` → `Id<"_storage">`.
- Un script local (`scripts/preview-templates.ts`) que renderice cada plantilla a `./tmp/` para revisarlas sin pasar por Convex.

## Fase 5: Generación de copys y lotes

- `convex/instagram/content/angles.ts`: lista de ángulos con la **información verificada** de Gridd. **Dejala con `TODO`s para que yo la complete.** El LLM solo puede afirmar cosas presentes en este archivo; nada de features, cifras ni testimonios inventados.
- `internalAction generateBatch({ count, startAt, cadence })`:
  - Elige ángulos rotando y evita repetir los últimos usados.
  - Llama al LLM para generar `{ caption, template, templateData }` en JSON validado (el modelo y la API key salen de env vars; si la Fase 0 encontró una integración existente, reusarla).
  - Captions de máximo ~600 caracteres, CTA al final y 3–8 hashtags relevantes (car meets, Uruguay, autos). Nada de spam de hashtags.
  - Renderiza las imágenes y crea los drafts con `scheduledAt` sugerido según `cadence`.
  - Todos los posts del lote comparten un `batchId`.
- Cron semanal opcional (desactivado por defecto con un flag): genera el lote de la semana siguiente en `draft`.

## Fase 6: Aprobación

- **Mínimo viable:** aprobar desde el dashboard de Convex, cambiando `status` a `approved` y ajustando `scheduledAt` si hace falta. Documentarlo en el README.
- **Opcional, solo si hay rol admin:** pantalla de admin en la app con el preview (imagen + caption), editar caption, aprobar/rechazar y reprogramar.

## Configuración manual (la hago yo; vos solo documentala)

1. Confirmar que la cuenta de Instagram de Gridd es profesional.
2. Crear la app en developers.facebook.com y agregar el producto Instagram.
3. En Instagram → API setup with Instagram business login, generar el token de la cuenta y copiar el IG user ID.
4. Cargar las env vars: `npx convex env set IG_ACCESS_TOKEN ...`, `IG_USER_ID`, `IG_GRAPH_VERSION`, `IG_DRY_RUN=true` (al principio) y la API key del LLM.

## Variables de entorno

| Variable | Uso |
|---|---|
| `IG_ACCESS_TOKEN` | Seed inicial del token (después vive en `igCredentials`) |
| `IG_USER_ID` | ID de la cuenta de Instagram |
| `IG_GRAPH_VERSION` | Versión de la Graph API, ej. `v2x.0` |
| `IG_DRY_RUN` | `"true"` = no llama a Meta |
| `IG_AUTOGEN_ENABLED` | Habilita el cron de generación semanal |
| LLM API key + modelo | Según lo que exista en el repo |

## Criterios de aceptación

- [ ] Con `IG_DRY_RUN=true`, un post `approved` y vencido pasa a `published` con IDs falsos y logs claros.
- [ ] Dos ejecuciones simultáneas de `publishDue` no publican el mismo post dos veces.
- [ ] Un error de Meta queda guardado en `lastError` con el mensaje real, y los reintentos respetan el máximo.
- [ ] El token se refresca y se persiste sin intervención manual.
- [ ] Las plantillas renderizan JPEG 1080×1350 con la paleta y el wordmark correctos (verificado con el script de preview).
- [ ] `generateBatch` crea drafts que solo mencionan información de `angles.ts`.
- [ ] Ningún post se publica sin haber pasado por `approved` manualmente.
- [ ] Ninguna función pública expone tokens ni permite aprobar sin ser admin.
- [ ] Prueba real: con `IG_DRY_RUN=false`, publicar **un** post de prueba y confirmar el permalink.

## Fuera de alcance (por ahora)

Reels/video, Stories, TikTok, analytics/insights, respuestas a comentarios y otras cuentas además de la de Gridd.