# Gridd backend — diseño (v1)

Fecha: 2026-10-06
Estado: pendiente de revisión

## Objetivo

Backend único en **Convex** para Gridd (encuentros fierreros de Uruguay), consumido por la app móvil y por la web. La v1 cubre:

- Eventos públicos: listado, mapa y ficha por slug, sin necesidad de cuenta.
- Cuentas con **Convex Auth**: Google, Apple y **email + contraseña**, con recuperación por código enviado por mail. Perfil básico.
- Rol **publisher** que se obtiene con una solicitud aprobada por un admin. Sólo los publishers publican.
- **Asistencia** ("Voy") con contador por evento.
- **Imagen** de portada por evento en Convex File Storage.

Fuera de alcance en v1: verificación obligatoria del email al registrarse, reportes y moderación de la comunidad, notificaciones push, comentarios, búsqueda por texto, índice geoespacial y migración de datos de Supabase.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataforma | Convex (se abandona Supabase para el backend) |
| Auth | Convex Auth: Google, Apple y Password (reset por código de 8 dígitos vía Resend, sin verificación de email) |
| Publicar | Sólo `role` publisher/admin. Se llega por solicitud que aprueba un admin |
| Mapa | Rango de fechas por índice y después filtro por bounding box en memoria |
| Estados de evento | `published` / `cancelled` / `hidden`, sin borradores |
| Tests | vitest + convex-test, TDD |

## Estructura del repo

```
convex/
  schema.ts
  auth.ts               # convexAuth({ providers: [Google, Apple, Password] })
  auth.config.ts
  http.ts               # rutas HTTP de Convex Auth
  users.ts
  publisherRequests.ts
  events.ts
  attendance.ts
  files.ts
  lib/
    auth.ts             # requireUser / requirePublisher / requireAdmin
    errors.ts           # helper de ConvexError con código
    validation.ts       # reglas de evento, bbox de Uruguay
    slug.ts
    passwordReset.ts    # provider Resend que manda el código de reset
  *.test.ts
```

Se eliminan `lib/schema.ts`, `index.ts` y `types/`. Los clientes usan `Doc<"events">` y `Doc<"users">`, más los tipos de retorno de `api` desde `convex/_generated`. Se quita `dotenv` porque Convex maneja sus propias env vars.

## Modelo de datos

### users (extiende `authTables.users`)
- `name?`, `email?`, `image?`, más los campos opcionales que define Convex Auth.
- `role?: "user" | "publisher" | "admin"`. Si no está, se trata como `"user"`. El callback `afterUserCreatedOrUpdated` lo setea en `"user"` cuando se crea la cuenta.
- `updatedAt?: number`
- Índice `email` (lo trae Convex Auth).

### publisherRequests
- `userId: Id<"users">`
- `message: string`: por qué quiere publicar, sus redes o su club. Entre 10 y 500 caracteres.
- `status: "pending" | "approved" | "rejected"`
- `reviewedBy?: Id<"users">`, `reviewedAt?: number`
- Índices `by_user` (`userId`) y `by_status` (`status`).

### events
- `title: string`: entre 3 y 80 caracteres después de `trim`.
- `description: string`: hasta 2000 caracteres.
- `slug: string`: único.
- `kind`: uno de `junada`, `rodada`, `cars_and_coffee`, `expo`, `clasicos`, `jdm`, `tuning`, `4x4`, `motos`, `pista`, `otro`.
- `startsAt: number`, `endsAt: number`: epoch ms.
- `placeName: string`: entre 2 y 120 caracteres, por ejemplo "Rambla de Pocitos, frente al Kibon".
- `lat: number`, `lon: number`
- `imageId?: Id<"_storage">`
- `organizerId: Id<"users">`
- `status: "published" | "cancelled" | "hidden"`
- `attendeeCount: number`
- `updatedAt: number`
- Índices:
  - `by_slug` (`slug`)
  - `by_status_startsAt` (`status`, `startsAt`)
  - `by_organizer` (`organizerId`, `startsAt`)

`isCompleted` no se guarda. El cliente lo calcula como `endsAt < Date.now()`.

### attendances
- `userId: Id<"users">`, `eventId: Id<"events">`
- Índices:
  - `by_event_user` (`eventId`, `userId`): unicidad y consulta "¿voy?".
  - `by_user` (`userId`)

## API

Convenciones:
- Todas las funciones públicas validan sus argumentos con `v`.
- Los errores son `ConvexError({ code, message })` con `code` ∈ `UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | INVALID | CONFLICT`.
- Las queries de eventos devuelven el evento con `imageUrl: string | null` resuelto y con `organizer: { _id, name, image }`.

### users
- `me` (query): el usuario logueado o `null`.
- `updateProfile({ name })` (mutation, requireUser): nombre de 2 a 50 caracteres.
- `setRole({ userId, role })` (**internalMutation**): bootstrap del primer admin con `npx convex run users:setRole`.

### publisherRequests
- `submit({ message })` (mutation, requireUser):
  - Devuelve `CONFLICT` si el usuario ya es publisher o admin, o si ya tiene una solicitud `pending`.
  - Un usuario rechazado puede volver a pedir.
- `mine` (query, requireUser): su solicitud más reciente, o `null`.
- `listPending` (query, requireAdmin): solicitudes pendientes con nombre, email e imagen del usuario, ordenadas de la más vieja a la más nueva.
- `approve({ requestId })` (mutation, requireAdmin): pasa la solicitud a `approved` y al usuario a `role: "publisher"`.
- `reject({ requestId })` (mutation, requireAdmin): pasa la solicitud a `rejected`.
- `approve` y `reject` sobre una solicitud que no está `pending` devuelven `CONFLICT`.

### events
- `listUpcoming({ paginationOpts, kind? })` (query, pública):
  - Trae los `published` con `startsAt >= now - 24h` por índice, en orden ascendente.
  - Filtra los que tienen `endsAt >= now` y, si se pasa `kind`, los de ese tipo.
  - Se pagina con `.paginate`.
- `listInBounds({ minLat, maxLat, minLon, maxLon, from, to })` (query, pública):
  - Rango de fechas `published` por índice, con `to - from` de hasta 90 días.
  - Filtro por bbox en memoria y máximo de 200 resultados.
- `getBySlug({ slug })` (query, pública):
  - Devuelve el evento `published` o `cancelled`.
  - Un evento `hidden` sólo lo ven su organizador o un admin. Para el resto devuelve `null`.
- `listMine` (query, requirePublisher): todos los eventos del organizador, sin importar el estado, ordenados por `startsAt` de forma descendente.
- `create(input)` (mutation, requirePublisher):
  - Valida el input y genera el slug.
  - Crea el evento con `status: "published"` y `attendeeCount: 0`.
  - Devuelve `{ id, slug }`.
- `update({ id, ...partial })` (mutation, requirePublisher):
  - Sólo puede hacerlo el organizador.
  - No se permite sobre eventos `cancelled` ni `hidden`.
  - Vuelve a validar todo con el estado resultante.
  - El slug no cambia.
  - Si se reemplaza `imageId`, se borra el archivo anterior.
- `cancel({ id })` (mutation, requirePublisher): sólo el organizador, y sólo sobre un evento `published`.
- `hide({ id })` / `unhide({ id })` (mutation, requireAdmin).

Reglas de validación (`lib/validation.ts`):
- `startsAt > now` al crear o al cambiar la fecha.
- `endsAt > startsAt` y `endsAt - startsAt <= 7 días`.
- `lat` ∈ [-35.5, -29.5] y `lon` ∈ [-59.0, -52.5] (Uruguay con margen).
- Longitudes de texto según el modelo.

Slug (`lib/slug.ts`):
- Se arma como `slugify(title)-YYYY-MM-DD` usando la fecha de `startsAt` en America/Montevideo, en minúsculas, sin acentos y con un máximo de 60 caracteres en la parte del título.
- Si ya existe, se agrega `-2`, `-3`, etc.

### attendance
- `toggle({ eventId })` (mutation, requireUser): devuelve `{ attending: boolean }`.
  - Para **marcar**: el evento tiene que estar `published` con `endsAt >= now`. Si no, devuelve `INVALID`.
  - **Desmarcar** siempre está permitido.
  - `attendeeCount` se ajusta en la misma mutation, que es transaccional.
- `isAttending({ eventId })` (query): `false` si no hay sesión.
- `myEvents` (query, requireUser): eventos a los que asiste el usuario, sin los `hidden`, ordenados por `startsAt`.

### files
- `generateUploadUrl` (mutation, requirePublisher).
- `create` y `update` verifican que el `imageId` exista en `_storage`.

## Auth: configuración

- Paquetes: `@convex-dev/auth`, `@auth/core` y `resend`.
- `auth.ts` usa los providers `Google` y `Apple` de `@auth/core/providers` y `Password` de `@convex-dev/auth/providers/Password`.

### Email + contraseña
- Registro con el flujo `signUp` y los campos `email`, `password` y `name`. El callback `profile` normaliza el email a minúsculas y `trim`, y guarda el `name`, que tiene que tener entre 2 y 50 caracteres.
- Login con el flujo `signIn`.
- Contraseña: `validatePasswordRequirements` exige al menos 8 caracteres, con al menos una letra y un número. Si no se cumple, devuelve un error `INVALID`.
- Recuperación:
  1. El flujo `reset` recibe `{ email }` y manda un código de 8 dígitos por mail, válido por 15 minutos.
  2. El flujo `reset-verification` recibe `{ email, code, newPassword }`.
  - El provider vive en `convex/lib/passwordReset.ts` y usa `Resend` de `@auth/core/providers/resend` con `generateVerificationToken` numérico y el mail en español.
- No hay verificación de email al registrarse.
- Vinculación de cuentas: Convex Auth sólo vincula automáticamente cuentas con email **verificado**. Si alguien se registra con contraseña y después entra con Google con el mismo email, quedan dos usuarios separados. Para v1 se acepta así y queda documentado. Si molesta, se suma la verificación de email.
- Env vars en Convex (las carga el usuario):
  - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - `AUTH_APPLE_ID`, `AUTH_APPLE_SECRET`
  - `SITE_URL`
  - `AUTH_RESEND_KEY` y `AUTH_EMAIL_FROM`, por ejemplo `Gridd <no-reply@gridd.uy>`. El remitente necesita un dominio verificado en Resend.
  - `JWT_PRIVATE_KEY` y `JWKS`, que se generan con `npx @convex-dev/auth`.
- El README va a incluir los pasos para configurar las consolas de Google y Apple, con redirect `https://<deployment>.convex.site/api/auth/callback/<provider>`, y las notas para Expo (deep link y `SITE_URL`).

## Testing

vitest con `convex-test` y entorno `edge-runtime`. Los usuarios se crean insertándolos en `users`, y se usa `t.withIdentity({ subject: "<userId>|<sessionId>" })` para simular el formato de Convex Auth.

Casos mínimos:
1. Permisos: anónimo, user, publisher y admin contra cada mutation protegida.
2. Flujo de publisher: submit → listPending → approve cambia el rol. Submit duplicado → CONFLICT. Reject y después se puede volver a pedir.
3. Eventos:
   - create válido e inválido (fechas, bbox, textos);
   - slug único con sufijo;
   - update sólo por el dueño;
   - cancel;
   - hide oculta el evento de las queries públicas.
4. `listUpcoming` excluye terminados, cancelados y ocultos. `listInBounds` respeta bbox, rango y límite.
5. Password: `signUp` crea el usuario con `role: "user"` y el nombre. Una contraseña débil se rechaza. La generación del código de reset y el texto del mail se testean como unidades. Los flujos de signUp, signIn y reset de punta a punta se verifican a mano contra el deployment, porque necesitan las claves JWT y Resend.
6. Asistencia:
   - toggle ida y vuelta deja el contador en 0;
   - no se puede marcar en un evento cancelado o pasado;
   - `myEvents`.

El login real con OAuth no se testea automáticamente. Se verifica a mano una vez configuradas las credenciales.

## Riesgos y notas

- `listInBounds` filtra en memoria. Está bien para el volumen de Uruguay. Si crece, se migra a `@convex-dev/geospatial` sin cambiar la firma de la función.
- Apple Sign In exige un secret JWT que vence cada 6 meses (limitación de Apple). Va documentado.
- `package.json` declara `typescript ^7`. Si convex-test o vitest no lo soportan, se fija en 5.x.
