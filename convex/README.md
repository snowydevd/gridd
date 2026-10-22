# Backend (Convex)

Backend de Gridd en [Convex](https://convex.dev). Vive en este repo junto a la app; antes estaba en `gridd-backend` (el historial se trajo con el merge).

**Todos los comandos `convex` se corren desde la raíz de `mobile/`.**

## Desarrollo

```bash
bun install
bun run convex     # convex dev: sincroniza funciones y genera tipos
bun run test       # vitest + convex-test
bun run typecheck  # app + convex/
```

## Variables de entorno (en Convex, no en .env)

Se cargan con `npx convex env set NOMBRE valor` (agregar `--prod` para producción).

| Variable | Para qué |
|---|---|
| `JWT_PRIVATE_KEY`, `JWKS` | Firmar las sesiones. Las genera `npx @convex-dev/auth` (ya están en dev) |
| `SITE_URL` | URL a la que vuelve el OAuth (web o deep link de la app). En dev: `http://localhost:3000` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Login con Google |
| `AUTH_APPLE_ID`, `AUTH_APPLE_SECRET` | Login con Apple |
| `AUTH_RESEND_KEY` | API key de Resend para el código de "olvidé mi contraseña" |
| `AUTH_EMAIL_FROM` | Remitente, ej. `Gridd <no-reply@gridd.uy>` (dominio verificado en Resend) |

### Google
1. Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (Web application).
2. Authorized redirect URI: `https://<tu-deployment>.convex.site/api/auth/callback/google`
3. Cargar `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`.

### Apple
1. Apple Developer → Identifiers: un *App ID* con "Sign in with Apple" y un *Services ID* (ese es `AUTH_APPLE_ID`).
2. En el Services ID: dominio `<tu-deployment>.convex.site` y return URL `https://<tu-deployment>.convex.site/api/auth/callback/apple`.
3. Crear una *Key* con Sign in with Apple y generar el client secret (JWT) con esa key. Ese es `AUTH_APPLE_SECRET`. **Vence a los 6 meses como máximo**: hay que regenerarlo.
4. Apple no deja probar en localhost; se prueba contra un deployment con HTTPS.

### Email + contraseña
- Flujos de `signIn("password", { ... })`:
  - `flow: "signUp"`: `email`, `password`, `name`.
  - `flow: "signIn"`: `email`, `password`.
  - `flow: "reset"`: `email`. Manda un código de 8 dígitos que vence a los 15 minutos.
  - `flow: "reset-verification"`: `email`, `code`, `newPassword`.
- La contraseña tiene que tener al menos 8 caracteres, con letras y números.
- No hay verificación de email. Por eso una cuenta con contraseña y una de Google con el mismo email **no se unen**: son dos usuarios distintos.

### App móvil (Expo)
- Cliente: `ConvexAuthProvider` de `@convex-dev/auth/react` con `storage` de `expo-secure-store` (en `src/lib/convex.ts` y `src/app/_layout.tsx`).
- Para OAuth, `SITE_URL` tiene que ser el esquema de la app (ej. `gridd://`) y el login abre `WebBrowser.openAuthSessionAsync` con la URL que devuelve `signIn`. Ver la guía "React Native" de Convex Auth.

## Primer admin

1. Entrar a la app con tu cuenta, así se crea el usuario.
2. `npx convex run users:setRole '{"email":"vos@mail.com","role":"admin"}'`

## Errores

Las funciones tiran `ConvexError` con `data = { code, message }`:
- `code` es uno de `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID` o `CONFLICT`.
- `message` ya viene en español, listo para mostrar.

## API

| Módulo | Funciones |
|---|---|
| `users` | `me`, `updateProfile`, `deleteAccount` |
| `publisherRequests` | `submit`, `mine`, `listPending`*, `approve`*, `reject`* |
| `events` | `listUpcoming`, `listInBounds`, `getBySlug`, `listMine`†, `create`†, `update`†, `cancel`†, `hide`*, `unhide`* |
| `attendance` | `toggle`, `isAttending`, `myEvents` |
| `files` | `generateUploadUrl`† |

\* sólo admin · † publisher o admin

`deleteAccount` borra en una transacción al usuario, su foto, autos, anotaciones (descontando el contador del evento), guardados, solicitudes, sus eventos pasados o cancelados con sus portadas, y sus cuentas y sesiones de Convex Auth. Si tiene eventos publicados que todavía no terminaron, falla con `CONFLICT`: hay que cancelarlos antes.

Subir una imagen: `generateUploadUrl` → `POST` del archivo a esa URL → el `storageId` de la respuesta va como `imageId` en `create` o `update`.

## Instagram

Posts promocionales para la cuenta de Gridd, en `convex/instagram/`:

```
generar lote → draft → aprobación manual → approved + fecha → cron publica → published
```

Nada pasa de `draft` a `approved` sin un admin. Un cron (`publishDue`, cada 15 min) publica los `approved` cuya fecha ya pasó; si Instagram falla, reintenta 30 min después hasta 3 veces y después queda `failed` con el error de Meta en `lastError`.

### Variables de entorno

| Variable | Para qué |
|---|---|
| `IG_ACCESS_TOKEN` | Token long-lived de Instagram. Sólo se usa la primera vez: después vive en la tabla `igCredentials` y se refresca solo (lunes, o si vence en menos de 10 días) |
| `IG_USER_ID` | `user_id` de la cuenta (`GET https://graph.instagram.com/v26.0/me?fields=user_id,username`) |
| `IG_GRAPH_VERSION` | Versión de la Graph API, ej. `v26.0` |
| `IG_DRY_RUN` | `true` = no llama a Meta: loguea las requests y usa IDs falsos |
| `ANTHROPIC_API_KEY` | Para generar copys con IA |
| `IG_LLM_MODEL` | Opcional. Por defecto `claude-haiku-5-5` |
| `IG_AUTOGEN_ENABLED` | `true` activa el lote semanal automático (jueves, drafts para lun/mié/vie 19:00) |
| `IG_AUTOGEN_COUNT` | Opcional. Posts por lote semanal, por defecto 3 |

Si generás un token nuevo, además de la env var hay que borrar la fila de `igCredentials` en el dashboard.

**Configuración en Meta** (una vez): cuenta de Instagram profesional → app en developers.facebook.com con el producto Instagram ("API setup with Instagram login") → permisos `instagram_business_basic` e `instagram_business_content_publish` → invitar a la cuenta como "Evaluador de Instagram" y aceptar en instagram.com/accounts/manage_access → "Agregar cuenta" y "Generar token".

### Contenido

- `instagram/content/angles.ts`: los hechos verificados de Gridd. **Es lo único que la IA puede afirmar**; un ángulo sin hechos no se usa. Completá los `TODO`.
- Plantillas (headline, feature, carousel) en `instagram/templates/`. Para verlas sin Convex: `bun scripts/preview-templates.ts` (deja los JPEG en `tmp/`). Si cambian las fuentes: `bun scripts/embed-template-assets.ts`.

```bash
# Lote con IA: 3 posts, el primero en startAt (ms) y uno cada 2 días
npx convex run instagram/generate:generateBatch '{"count":3,"startAt":1793000000000,"everyDays":2}'

# Lote escrito a mano (mismas validaciones, sin IA)
npx convex run instagram/generate:createBatch '{"startAt":1793000000000,"posts":[{"angle":"cerca-tuyo","template":"headline","caption":"...","data":{"headline":"...","subline":"..."}}]}'
```

### Aprobar

- **Dashboard local** (recomendado): `gridd/admin-dashboard`, `bun dev`. Login con una cuenta admin; ahí se ve el preview, se edita el caption, se elige la fecha y se aprueba, rechaza o reprograma.
- **Dashboard de Convex**: en la tabla `igPosts`, cambiar `status` a `approved` y ajustar `scheduledAt` (ms).

Para publicar uno ya aprobado sin esperar al cron: `npx convex run instagram/client:publishTest '{"postId":"..."}'`.

## Verificado manualmente

2026-10-06, en el deployment de dev:

- [x] Registro con contraseña crea el usuario con `role: "user"`, nombre y email normalizado (`  Prueba.Gridd@Example.com ` → `prueba.gridd@example.com`)
- [x] Contraseña débil → `INVALID`
- [x] Login con contraseña funciona aunque el email tenga mayúsculas distintas; contraseña incorrecta → `InvalidSecret`

Pendiente: requiere cargar las credenciales de Google, Apple y Resend.

- [ ] Reset de contraseña: llega el mail con el código y permite cambiarla
- [ ] Login con Google
- [ ] Login con Apple (en deployment con HTTPS)

Instagram, 2026-10-20 en dev:

- [x] Token válido contra Meta (cuenta `gridd.app`, BUSINESS) y cupo de publicación leído
- [x] Dry-run: render → draft → aprobación como admin → `publishTest` → `published` con IDs falsos
- [x] Publicación real de un post y permalink confirmado
- [x] `generateBatch` con Haiku 5.5 y `createBatch` (rechaza cifras que no están en los hechos)
