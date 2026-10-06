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
| `users` | `me`, `updateProfile` |
| `publisherRequests` | `submit`, `mine`, `listPending`*, `approve`*, `reject`* |
| `events` | `listUpcoming`, `listInBounds`, `getBySlug`, `listMine`†, `create`†, `update`†, `cancel`†, `hide`*, `unhide`* |
| `attendance` | `toggle`, `isAttending`, `myEvents` |
| `files` | `generateUploadUrl`† |

\* sólo admin · † publisher o admin

Subir una imagen: `generateUploadUrl` → `POST` del archivo a esa URL → el `storageId` de la respuesta va como `imageId` en `create` o `update`.

## Verificado manualmente

2026-10-06, en el deployment de dev:

- [x] Registro con contraseña crea el usuario con `role: "user"`, nombre y email normalizado (`  Prueba.Gridd@Example.com ` → `prueba.gridd@example.com`)
- [x] Contraseña débil → `INVALID`
- [x] Login con contraseña funciona aunque el email tenga mayúsculas distintas; contraseña incorrecta → `InvalidSecret`

Pendiente: requiere cargar las credenciales de Google, Apple y Resend.

- [ ] Reset de contraseña: llega el mail con el código y permite cambiarla
- [ ] Login con Google
- [ ] Login con Apple (en deployment con HTTPS)
