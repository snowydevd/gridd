# Plan de implementación: backend de Gridd

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend en Convex para Gridd con:
- auth por Google, Apple y email + contraseña;
- solicitud para ser publisher que aprueba un admin;
- eventos públicos (listado, mapa y ficha por slug);
- asistencia ("Voy");
- imágenes de portada.

**Architecture:**
- Funciones de Convex en `convex/`, separadas por dominio: `users`, `publisherRequests`, `events`, `attendance` y `files`.
- La lógica pura (validación, slug, contraseña) vive en `convex/lib/` y se testea sin base de datos.
- Los permisos pasan por los guards `requireUser`, `requirePublisher` y `requireAdmin`.
- Los errores salen como `ConvexError({ code, message })`.

**Tech Stack:**
- Convex 1.46
- `@convex-dev/auth` 0.0.96, `@auth/core` ^0.41 (providers Google, Apple y Resend)
- `resend`, `@oslojs/crypto`
- vitest 5, `convex-test`, `@edge-runtime/vm`

**Spec:** `docs/superpowers/specs/2026-10-06-gridd-backend-design.md`

## Global Constraints

- Roles: `"user" | "publisher" | "admin"`. Si `role` no está, se trata como `"user"`.
- Códigos de error: `UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | INVALID | CONFLICT`. Los mensajes van en español rioplatense ("Tenés que iniciar sesión.").
- Estados de evento: `published | cancelled | hidden`.
- `kind`: `junada | rodada | cars_and_coffee | expo | clasicos | jdm | tuning | 4x4 | motos | pista | otro`.
- Textos:
  - título: 3 a 80 caracteres después de `trim`;
  - descripción: hasta 2000;
  - `placeName`: 2 a 120;
  - nombre de usuario: 2 a 50;
  - mensaje de solicitud: 10 a 500.
- Fechas:
  - `startsAt > now` al crear o al cambiar fecha;
  - `endsAt > startsAt`;
  - duración de hasta 7 días.
- Bbox de Uruguay: `lat ∈ [-35.5, -29.5]`, `lon ∈ [-59.0, -52.5]`.
- Slug: `slugify(title)` de hasta 60 caracteres + `-YYYY-MM-DD` con la fecha de Montevideo (UTC-3 fijo, sin DST). Si se repite, `-2`, `-3`, etc. No cambia al editar.
- `listInBounds`: ventana de hasta 90 días y hasta 200 resultados. `listUpcoming`: index `startsAt >= now - 24h` y filtro `endsAt >= now`.
- Contraseña: mínimo 8 caracteres, con al menos una letra y un número. El email se normaliza con `trim` y en minúsculas.
- Reset de contraseña: código de 8 dígitos que vence a los 15 minutos, enviado con Resend.
- Timestamps en epoch ms (`number`).
- Todos los comandos se corren desde `/home/lautaro/Documents/Projects/gridd-backend`. El gestor de paquetes es npm (hay `package-lock.json`).

## Review Focus

1. **Título con sólo emojis o símbolos** (por ejemplo "🔥🔥🔥"): el slug no puede quedar vacío ni arrancar con `-`; usa `evento-YYYY-MM-DD`. El test está en la Task 4.
2. **Editar el título de un evento que ya empezó**: no tiene que fallar por "la fecha tiene que ser futura" si la fecha no cambió. El test está en la Task 5.
3. **Update que no toca la imagen**: no se borra el archivo actual de storage. Sólo se borra si se reemplaza o se pide `removeImage`. El test está en la Task 5.
4. **Bbox invertido o ventana negativa** en `listInBounds` (`minLat > maxLat` o `to < from`): devuelve `INVALID`, no una lista vacía silenciosa. El test está en la Task 6.
5. **Desmarcar "Voy" de un evento cancelado o pasado**: tiene que funcionar y bajar el contador, sin dejarlo negativo. El test está en la Task 7.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `convex/schema.ts` | Tablas e índices |
| `convex/lib/validators.ts` | Validadores `v` compartidos (role, kind, status) |
| `convex/lib/errors.ts` | `fail(code, message)` |
| `convex/lib/auth.ts` | `currentUser`, `roleOf`, `requireUser`, `requirePublisher`, `requireAdmin` |
| `convex/lib/validation.ts` | Constantes de tiempo, bbox, `validateEventInput`, `validateName`, `validatePassword`, `passwordProfile` |
| `convex/lib/slug.ts` | `slugBase`, `uniqueSlug` |
| `convex/lib/passwordReset.ts` | Provider Resend para el código de reset |
| `convex/lib/newUser.ts` | `initNewUser`: rol por defecto al crear la cuenta |
| `convex/lib/eventView.ts` | `toEventView`: resuelve `imageUrl` y `organizer` |
| `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts` | Convex Auth |
| `convex/users.ts` | `me`, `updateProfile`, `setRole` (internal) |
| `convex/publisherRequests.ts` | `submit`, `mine`, `listPending`, `approve`, `reject` |
| `convex/events.ts` | Mutations y queries de eventos |
| `convex/files.ts` | `generateUploadUrl` |
| `convex/attendance.ts` | `toggle`, `isAttending`, `myEvents` |
| `convex/test.setup.ts`, `convex/test.helpers.ts` | Harness de convex-test |
| `convex/*.test.ts`, `convex/lib/*.test.ts` | Tests |
| `README.md` | Env vars, consolas de Google y Apple, bootstrap del admin y verificación manual |

Se borran `index.ts`, `lib/schema.ts` y `types/`.

---

### Task 1: Tooling, schema y harness de tests

**Files:**
- Create: `convex/tsconfig.json`, `convex/schema.ts`, `convex/lib/validators.ts`, `convex/lib/errors.ts`, `convex/test.setup.ts`, `convex/test.helpers.ts`, `convex/schema.test.ts`, `vitest.config.ts`
- Modify: `package.json`, `.gitignore`
- Delete: `index.ts`, `lib/schema.ts`, `types/user.ts`, `types/event.ts`

**Interfaces:**
- Produces:
  - `role`, `eventKind`, `eventStatus` y `requestStatus` (validadores `v`) en `convex/lib/validators.ts`
  - `fail(code: ErrorCode, message: string): never` en `convex/lib/errors.ts`
  - `setup()`, `makeUser(t, role?, name?)` → `{ id, as }`, `insertEvent(t, organizerId, overrides?)` → `Id<"events">`, `expectCode(promise, code)`, `HOUR` y `DAY` en `convex/test.helpers.ts`

- [ ] **Step 1: Inicializar git y limpiar archivos viejos**

```bash
git init
rm index.ts lib/schema.ts types/user.ts types/event.ts
rmdir lib types
printf ".env.local\nnode_modules/\n.vitest/\n" > .gitignore
```

- [ ] **Step 2: Instalar dependencias**

```bash
npm uninstall dotenv
npm install @convex-dev/auth@^0.0.96 @auth/core@^0.41.1 resend @oslojs/crypto
npm install -D vitest convex-test @edge-runtime/vm
```

- [ ] **Step 3: Scripts en `package.json`**

Reemplazar el bloque `"scripts"` por:

```json
  "scripts": {
    "dev": "convex dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p convex"
  },
```

Borrar también `"main": "index.js"`.

- [ ] **Step 4: Crear `convex/tsconfig.json`**

```json
{
  "compilerOptions": {
    "allowJs": true,
    "strict": true,
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "target": "ESNext",
    "lib": ["ES2021", "dom"],
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["./**/*"],
  "exclude": ["./_generated"]
}
```

- [ ] **Step 5: Crear `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

- [ ] **Step 6: Crear `convex/lib/validators.ts`**

```ts
import { v } from "convex/values";

export const role = v.union(
  v.literal("user"),
  v.literal("publisher"),
  v.literal("admin"),
);
export type Role = typeof role.type;

export const eventKind = v.union(
  v.literal("junada"),
  v.literal("rodada"),
  v.literal("cars_and_coffee"),
  v.literal("expo"),
  v.literal("clasicos"),
  v.literal("jdm"),
  v.literal("tuning"),
  v.literal("4x4"),
  v.literal("motos"),
  v.literal("pista"),
  v.literal("otro"),
);

export const eventStatus = v.union(
  v.literal("published"),
  v.literal("cancelled"),
  v.literal("hidden"),
);

export const requestStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);
```

- [ ] **Step 7: Crear `convex/lib/errors.ts`**

```ts
import { ConvexError } from "convex/values";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "CONFLICT";

/** Corta la función con un error que el cliente puede leer en `error.data.code`. */
export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}
```

- [ ] **Step 8: Crear `convex/schema.ts`**

```ts
import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { eventKind, eventStatus, requestStatus, role } from "./lib/validators";

export default defineSchema({
  ...authTables,

  // Misma forma que authTables.users, más rol y updatedAt.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(role),
    updatedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  publisherRequests: defineTable({
    userId: v.id("users"),
    message: v.string(),
    status: requestStatus,
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  events: defineTable({
    title: v.string(),
    description: v.string(),
    slug: v.string(),
    kind: eventKind,
    startsAt: v.number(),
    endsAt: v.number(),
    placeName: v.string(),
    lat: v.number(),
    lon: v.number(),
    imageId: v.optional(v.id("_storage")),
    organizerId: v.id("users"),
    status: eventStatus,
    attendeeCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status_startsAt", ["status", "startsAt"])
    .index("by_organizer", ["organizerId", "startsAt"]),

  attendances: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
  })
    .index("by_event_user", ["eventId", "userId"])
    .index("by_user", ["userId"]),
});
```

- [ ] **Step 9: Generar los tipos y verificar TypeScript 7**

Run: `npx convex dev --once`
Expected: `Convex functions ready!` y `convex/_generated/` actualizado con las tablas nuevas.

Run: `npm run typecheck`
Expected: sin errores. Si `convex dev` o `tsc` fallan por TypeScript 7 (errores de API o del binario de `typescript`), correr `npm uninstall typescript && npm install -D typescript@^5.9` y repetir los dos comandos.

- [ ] **Step 10: Crear el harness: `convex/test.setup.ts`**

```ts
/// <reference types="vite/client" />
// Todos los módulos de convex/ salvo los que tienen más de un punto (tests y helpers).
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
```

- [ ] **Step 11: Crear `convex/test.helpers.ts`**

```ts
import { convexTest } from "convex-test";
import { expect } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import type { Role } from "./lib/validators";
import schema from "./schema";
import { modules } from "./test.setup";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export function setup() {
  return convexTest(schema, modules);
}
export type T = ReturnType<typeof setup>;

/** Inserta un usuario y devuelve un cliente autenticado como él (formato de subject de Convex Auth). */
export async function makeUser(t: T, role?: Role, name = "Ana") {
  const id = await t.run((ctx) =>
    ctx.db.insert("users", {
      name,
      email: `${name.toLowerCase()}-${Math.random().toString(36).slice(2)}@test.uy`,
      role,
    }),
  );
  return { id, as: t.withIdentity({ subject: `${id}|test-session` }) };
}

type EventFields = Omit<Doc<"events">, "_id" | "_creationTime">;

/** Inserta un evento válido directo en la base, salteando las validaciones. */
export async function insertEvent(
  t: T,
  organizerId: Id<"users">,
  overrides: Partial<EventFields> = {},
) {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("events", {
      title: "Junada en la rambla",
      description: "",
      slug: `junada-${Math.random().toString(36).slice(2)}`,
      kind: "junada",
      startsAt: now + DAY,
      endsAt: now + DAY + 3 * HOUR,
      placeName: "Rambla de Pocitos",
      lat: -34.91,
      lon: -56.15,
      organizerId,
      status: "published",
      attendeeCount: 0,
      updatedAt: now,
      ...overrides,
    }),
  );
}

/** Espera que la promesa falle con un ConvexError de ese código. */
export async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (e: unknown) => (e as { data?: { code?: string } })?.data?.code === code,
  );
}
```

- [ ] **Step 12: Smoke test: `convex/schema.test.ts`**

```ts
import { expect, test } from "vitest";
import { insertEvent, makeUser, setup } from "./test.helpers";

test("el harness inserta usuarios y eventos", async () => {
  const t = setup();
  const { id } = await makeUser(t, "publisher");
  const eventId = await insertEvent(t, id);
  const event = await t.run((ctx) => ctx.db.get(eventId));
  expect(event?.organizerId).toBe(id);
});
```

- [ ] **Step 13: Correr los tests**

Run: `npm test`
Expected: 1 test pasa.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "chore: tooling de Convex, schema v1 y harness de tests"
```

---

### Task 2: Guards de permisos y validación de usuario/contraseña

**Files:**
- Create: `convex/lib/auth.ts`, `convex/lib/validation.ts`, `convex/lib/validation.test.ts`, `convex/lib/auth.test.ts`

**Interfaces:**
- Consumes: `fail` y `Role` (Task 1).
- Produces:
  - `currentUser(ctx: QueryCtx): Promise<Doc<"users"> | null>`
  - `roleOf(user: Doc<"users">): Role`
  - `requireUser`, `requirePublisher` y `requireAdmin` `(ctx: QueryCtx) => Promise<Doc<"users">>`
  - `HOUR`, `DAY`, `UY_BOUNDS`
  - `validateName(name: string): string` (devuelve el nombre con `trim`)
  - `validatePassword(password: string): void`
  - `passwordProfile(params: Record<string, unknown>): { email: string; name?: string }`

- [ ] **Step 1: Test de validación: `convex/lib/validation.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { passwordProfile, validateName, validatePassword } from "./validation";

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  return "OK";
};

describe("validateName", () => {
  test("hace trim y acepta 2-50", () => {
    expect(validateName("  Lauti ")).toBe("Lauti");
  });
  test("rechaza muy corto o muy largo", () => {
    expect(codeOf(() => validateName(" a "))).toBe("INVALID");
    expect(codeOf(() => validateName("x".repeat(51)))).toBe("INVALID");
  });
});

describe("validatePassword", () => {
  test("acepta 8+ con letra y número", () => {
    expect(codeOf(() => validatePassword("fierro123"))).toBe("OK");
  });
  test.each(["corta1", "solamenteletras", "1234567890"])("rechaza %s", (pw) => {
    expect(codeOf(() => validatePassword(pw))).toBe("INVALID");
  });
});

describe("passwordProfile", () => {
  test("normaliza el email y guarda el nombre en signUp", () => {
    expect(
      passwordProfile({ email: "  Foo@Gridd.UY ", name: " Foo ", flow: "signUp" }),
    ).toEqual({ email: "foo@gridd.uy", name: "Foo" });
  });
  test("en signIn sólo devuelve el email normalizado", () => {
    expect(passwordProfile({ email: "FOO@gridd.uy", flow: "signIn" })).toEqual({
      email: "foo@gridd.uy",
    });
  });
  test("rechaza email inválido", () => {
    expect(codeOf(() => passwordProfile({ email: "no-es-mail", flow: "signIn" }))).toBe(
      "INVALID",
    );
  });
  test("signUp sin nombre válido falla", () => {
    expect(
      codeOf(() => passwordProfile({ email: "a@b.uy", name: "", flow: "signUp" })),
    ).toBe("INVALID");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run convex/lib/validation.test.ts`
Expected: FAIL, `Cannot find module './validation'` o similar.

- [ ] **Step 3: Crear `convex/lib/validation.ts`, parte de usuario**

```ts
import { fail } from "./errors";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** Uruguay con margen. */
export const UY_BOUNDS = { minLat: -35.5, maxLat: -29.5, minLon: -59.0, maxLon: -52.5 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    fail("INVALID", "El nombre tiene que tener entre 2 y 50 caracteres.");
  }
  return trimmed;
}

export function validatePassword(password: string): void {
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    fail(
      "INVALID",
      "La contraseña tiene que tener al menos 8 caracteres, con letras y números.",
    );
  }
}

/** `profile` del provider Password: normaliza el email y en el registro exige nombre. */
export function passwordProfile(params: Record<string, unknown>): {
  email: string;
  name?: string;
} {
  const email = String(params.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) fail("INVALID", "El email no es válido.");
  if (params.flow === "signUp") {
    return { email, name: validateName(String(params.name ?? "")) };
  }
  return { email };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run convex/lib/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Test de los guards: `convex/lib/auth.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { expectCode, makeUser, setup } from "../test.helpers";
import { requireAdmin, requirePublisher, requireUser, roleOf } from "./auth";

describe("guards", () => {
  test("anónimo no pasa requireUser", async () => {
    const t = setup();
    await expectCode(t.run((ctx) => requireUser(ctx)), "UNAUTHENTICATED");
  });

  test("role vacío se trata como user", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const user = await as.run((ctx) => requireUser(ctx));
    expect(roleOf(user)).toBe("user");
    await expectCode(as.run((ctx) => requirePublisher(ctx)), "FORBIDDEN");
  });

  test("publisher pasa requirePublisher pero no requireAdmin", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    await as.run((ctx) => requirePublisher(ctx));
    await expectCode(as.run((ctx) => requireAdmin(ctx)), "FORBIDDEN");
  });

  test("admin pasa todo", async () => {
    const t = setup();
    const { as } = await makeUser(t, "admin");
    await as.run((ctx) => requirePublisher(ctx));
    await as.run((ctx) => requireAdmin(ctx));
  });
});
```

- [ ] **Step 6: Correr y ver que falla**

Run: `npx vitest run convex/lib/auth.test.ts`
Expected: FAIL, el módulo `./auth` no existe.

- [ ] **Step 7: Crear `convex/lib/auth.ts`**

```ts
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { fail } from "./errors";
import type { Role } from "./validators";

export async function currentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  return userId ? await ctx.db.get(userId) : null;
}

export function roleOf(user: Doc<"users">): Role {
  return user.role ?? "user";
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) fail("UNAUTHENTICATED", "Tenés que iniciar sesión.");
  return user;
}

export async function requirePublisher(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  const role = roleOf(user);
  if (role !== "publisher" && role !== "admin") {
    fail("FORBIDDEN", "Sólo los publishers pueden hacer esto.");
  }
  return user;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (roleOf(user) !== "admin") fail("FORBIDDEN", "Sólo un admin puede hacer esto.");
  return user;
}
```

- [ ] **Step 8: Correr los tests**

Run: `npm test`
Expected: todos pasan.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: guards de rol y validación de usuario y contraseña"
```

---

### Task 3: Convex Auth (Google, Apple, Password + reset) y módulo `users`

**Files:**
- Create: `convex/lib/passwordReset.ts`, `convex/lib/passwordReset.test.ts`, `convex/lib/newUser.ts`, `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`, `convex/users.ts`, `convex/users.test.ts`

**Interfaces:**
- Consumes: `passwordProfile`, `validatePassword` y `validateName` (Task 2); `currentUser`, `requireUser` y `roleOf` (Task 2); `fail`; `role`.
- Produces:
  - `api.users.me` → `{ _id, name: string | null, email: string | null, image: string | null, role: Role } | null`
  - `api.users.updateProfile({ name })` → `null`
  - `internal.users.setRole({ email, role })` → `Id<"users">`
  - `initNewUser(ctx: MutationCtx, args: { userId: Id<"users">; existingUserId: Id<"users"> | null }): Promise<void>`
  - `generateResetCode(): string`
  - `resetEmailText(code: string): string`

- [ ] **Step 1: Test del provider de reset: `convex/lib/passwordReset.test.ts`**

```ts
import { expect, test } from "vitest";
import { generateResetCode, resetEmailText } from "./passwordReset";

test("el código de reset son 8 dígitos y varía", () => {
  const a = generateResetCode();
  const b = generateResetCode();
  expect(a).toMatch(/^\d{8}$/);
  expect(b).toMatch(/^\d{8}$/);
  expect(a === b && generateResetCode() === a).toBe(false);
});

test("el mail incluye el código y el vencimiento", () => {
  const text = resetEmailText("12345678");
  expect(text).toContain("12345678");
  expect(text).toContain("15 minutos");
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run convex/lib/passwordReset.test.ts`
Expected: FAIL, el módulo no existe.

- [ ] **Step 3: Crear `convex/lib/passwordReset.ts`**

```ts
import Resend from "@auth/core/providers/resend";
import { type RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { Resend as ResendAPI } from "resend";

const random: RandomReader = {
  read(bytes) {
    crypto.getRandomValues(bytes);
  },
};

export function generateResetCode(): string {
  return generateRandomString(random, "0123456789", 8);
}

export function resetEmailText(code: string): string {
  return [
    `Tu código para cambiar la contraseña de Gridd es: ${code}`,
    "",
    "Vence en 15 minutos. Si no lo pediste, ignorá este mail.",
  ].join("\n");
}

/** Manda el código de "olvidé mi contraseña" (flujos reset / reset-verification). */
export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15,
  async generateVerificationToken() {
    return generateResetCode();
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM ?? "Gridd <onboarding@resend.dev>",
      to: [email],
      subject: "Tu código para cambiar la contraseña de Gridd",
      text: resetEmailText(token),
    });
    if (error) throw new Error("No se pudo enviar el mail de recuperación.");
  },
});
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run convex/lib/passwordReset.test.ts`
Expected: PASS.

- [ ] **Step 5: Test de `users` y `initNewUser`: `convex/users.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { initNewUser } from "./lib/newUser";
import { expectCode, makeUser, setup } from "./test.helpers";

describe("users.me", () => {
  test("anónimo recibe null", async () => {
    const t = setup();
    expect(await t.query(api.users.me, {})).toBeNull();
  });

  test("devuelve el perfil con role por defecto", async () => {
    const t = setup();
    const { id, as } = await makeUser(t, undefined, "Lauti");
    expect(await as.query(api.users.me, {})).toMatchObject({
      _id: id,
      name: "Lauti",
      image: null,
      role: "user",
    });
  });
});

describe("users.updateProfile", () => {
  test("cambia el nombre con trim", async () => {
    const t = setup();
    const { id, as } = await makeUser(t);
    await as.mutation(api.users.updateProfile, { name: "  Nuevo  " });
    const user = await t.run((ctx) => ctx.db.get(id));
    expect(user?.name).toBe("Nuevo");
    expect(user?.updatedAt).toBeTypeOf("number");
  });

  test("anónimo no puede", async () => {
    const t = setup();
    await expectCode(t.mutation(api.users.updateProfile, { name: "Nuevo" }), "UNAUTHENTICATED");
  });
});

describe("users.setRole (internal)", () => {
  test("cambia el rol buscando por email, sin importar mayúsculas", async () => {
    const t = setup();
    const id = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Admin", email: "admin@gridd.uy" }),
    );
    await t.mutation(internal.users.setRole, { email: "ADMIN@gridd.uy", role: "admin" });
    expect((await t.run((ctx) => ctx.db.get(id)))?.role).toBe("admin");
  });

  test("email inexistente → NOT_FOUND", async () => {
    const t = setup();
    await expectCode(
      t.mutation(internal.users.setRole, { email: "nadie@gridd.uy", role: "admin" }),
      "NOT_FOUND",
    );
  });
});

describe("initNewUser", () => {
  test("a un usuario nuevo le pone role user", async () => {
    const t = setup();
    const id = await t.run((ctx) => ctx.db.insert("users", { email: "x@gridd.uy" }));
    await t.run((ctx) => initNewUser(ctx, { userId: id, existingUserId: null }));
    expect((await t.run((ctx) => ctx.db.get(id)))?.role).toBe("user");
  });

  test("no toca el rol de un usuario existente que vuelve a loguearse", async () => {
    const t = setup();
    const id = await t.run((ctx) =>
      ctx.db.insert("users", { email: "x@gridd.uy", role: "publisher" }),
    );
    await t.run((ctx) => initNewUser(ctx, { userId: id, existingUserId: id }));
    expect((await t.run((ctx) => ctx.db.get(id)))?.role).toBe("publisher");
  });
});
```

- [ ] **Step 6: Correr y ver que falla**

Run: `npx vitest run convex/users.test.ts`
Expected: FAIL, `api.users` y `./lib/newUser` no existen.

- [ ] **Step 7: Crear `convex/lib/newUser.ts`**

```ts
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Callback de Convex Auth: sólo actúa en el alta, no en cada login. */
export async function initNewUser(
  ctx: MutationCtx,
  { userId, existingUserId }: { userId: Id<"users">; existingUserId: Id<"users"> | null },
): Promise<void> {
  if (existingUserId) return;
  await ctx.db.patch(userId, { role: "user", updatedAt: Date.now() });
}
```

- [ ] **Step 8: Crear `convex/auth.ts`**

```ts
import Apple from "@auth/core/providers/apple";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { initNewUser } from "./lib/newUser";
import { ResendOTPPasswordReset } from "./lib/passwordReset";
import { passwordProfile, validatePassword } from "./lib/validation";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Apple({
      // Apple sólo manda el nombre la primera vez y devuelve `image: null`.
      profile: (appleInfo) => ({
        id: appleInfo.sub,
        name: appleInfo.user
          ? `${appleInfo.user.name.firstName} ${appleInfo.user.name.lastName}`
          : undefined,
        email: appleInfo.email,
      }),
    }),
    Password<DataModel>({
      profile: (params) => passwordProfile(params),
      validatePasswordRequirements: validatePassword,
      reset: ResendOTPPasswordReset,
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      await initNewUser(ctx as unknown as MutationCtx, args);
    },
  },
});
```

- [ ] **Step 9: Crear `convex/auth.config.ts` y `convex/http.ts`**

`convex/auth.config.ts`:

```ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

`convex/http.ts`:

```ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
```

- [ ] **Step 10: Crear `convex/users.ts`**

```ts
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { currentUser, requireUser, roleOf } from "./lib/auth";
import { fail } from "./lib/errors";
import { validateName } from "./lib/validation";
import { role } from "./lib/validators";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      role: roleOf(user),
    };
  },
});

export const updateProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { name: validateName(name), updatedAt: Date.now() });
    return null;
  },
});

/** Bootstrap: `npx convex run users:setRole '{"email":"vos@mail.com","role":"admin"}'` */
export const setRole = internalMutation({
  args: { email: v.string(), role },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) fail("NOT_FOUND", `No hay usuario con email ${email}.`);
    await ctx.db.patch(user._id, { role: args.role, updatedAt: Date.now() });
    return user._id;
  },
});
```

- [ ] **Step 11: Regenerar `_generated` y correr los tests**

Run: `npx convex dev --once && npm test`
Expected: el deploy anda (las env vars de auth todavía pueden faltar y eso no rompe el push). Todos los tests pasan.

Si `setRole` no encuentra a un usuario de Google cuyo email tiene mayúsculas: Google ya devuelve el email en minúsculas, así que no hace falta otra cosa.

- [ ] **Step 12: Typecheck**

Run: `npm run typecheck`
Expected: sin errores. Si el callback `profile` de Password no tipa porque `passwordProfile` recibe `Record<string, unknown>`, castear el argumento: `profile: (params) => passwordProfile(params as Record<string, unknown>)`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: Convex Auth con Google, Apple y contraseña; módulo users"
```

---

### Task 4: Validación de eventos y slug

**Files:**
- Modify: `convex/lib/validation.ts` (agregar al final)
- Create: `convex/lib/slug.ts`, `convex/lib/slug.test.ts`, `convex/lib/eventValidation.test.ts`

**Interfaces:**
- Consumes: `fail`, `HOUR`, `DAY`, `UY_BOUNDS`.
- Produces:
  - `type EventInput = { title: string; description: string; kind: Doc<"events">["kind"]; startsAt: number; endsAt: number; placeName: string; lat: number; lon: number; imageId?: Id<"_storage"> }`
  - `validateEventInput(input: EventInput, now: number, opts: { dateChanged: boolean }): EventInput` (devuelve los textos con `trim`)
  - `slugBase(title: string, startsAt: number): string`
  - `uniqueSlug(ctx: QueryCtx, base: string): Promise<string>`

- [ ] **Step 1: Test de validación de eventos: `convex/lib/eventValidation.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { DAY, HOUR, type EventInput, validateEventInput } from "./validation";

const NOW = Date.UTC(2026, 9, 6, 12);
const base: EventInput = {
  title: "Junada JDM",
  description: "Traé el auto limpio",
  kind: "jdm",
  startsAt: NOW + DAY,
  endsAt: NOW + DAY + 3 * HOUR,
  placeName: "Parque Rodó",
  lat: -34.91,
  lon: -56.17,
};

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  return "OK";
};
const check = (patch: Partial<EventInput>, dateChanged = true) =>
  codeOf(() => validateEventInput({ ...base, ...patch }, NOW, { dateChanged }));

describe("validateEventInput", () => {
  test("acepta un evento válido y hace trim de los textos", () => {
    const out = validateEventInput(
      { ...base, title: "  Junada JDM ", placeName: " Parque Rodó " },
      NOW,
      { dateChanged: true },
    );
    expect(out.title).toBe("Junada JDM");
    expect(out.placeName).toBe("Parque Rodó");
  });

  test.each([
    ["título corto", { title: " ab " }],
    ["título largo", { title: "x".repeat(81) }],
    ["descripción larga", { description: "x".repeat(2001) }],
    ["lugar corto", { placeName: "a" }],
    ["lugar largo", { placeName: "x".repeat(121) }],
    ["empieza en el pasado", { startsAt: NOW - HOUR, endsAt: NOW + HOUR }],
    ["termina antes de empezar", { endsAt: NOW + DAY - HOUR }],
    ["termina igual que empieza", { endsAt: NOW + DAY }],
    ["dura más de 7 días", { endsAt: NOW + DAY + 7 * DAY + 1 }],
    ["lat fuera de Uruguay", { lat: -40 }],
    ["lon fuera de Uruguay", { lon: -60 }],
    ["lat NaN", { lat: Number.NaN }],
  ])("rechaza %s", (_name, patch) => {
    expect(check(patch)).toBe("INVALID");
  });

  test("evento que ya empezó pasa si la fecha no cambió", () => {
    expect(check({ startsAt: NOW - HOUR, endsAt: NOW + HOUR }, false)).toBe("OK");
  });

  test("dura exactamente 7 días: válido", () => {
    expect(check({ endsAt: NOW + DAY + 7 * DAY })).toBe("OK");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run convex/lib/eventValidation.test.ts`
Expected: FAIL, `validateEventInput` no está exportada.

- [ ] **Step 3: Agregar al final de `convex/lib/validation.ts`**

Agregar arriba del archivo:

```ts
import type { Doc, Id } from "../_generated/dataModel";
```

Y al final:

```ts
export type EventInput = {
  title: string;
  description: string;
  kind: Doc<"events">["kind"];
  startsAt: number;
  endsAt: number;
  placeName: string;
  lat: number;
  lon: number;
  imageId?: Id<"_storage">;
};

function between(n: number, min: number, max: number) {
  return Number.isFinite(n) && n >= min && n <= max;
}

/**
 * Valida el estado completo de un evento (al crear o después de aplicar un update).
 * `dateChanged` evita exigir fecha futura cuando sólo se editan otros campos.
 */
export function validateEventInput(
  input: EventInput,
  now: number,
  { dateChanged }: { dateChanged: boolean },
): EventInput {
  const title = input.title.trim();
  const description = input.description.trim();
  const placeName = input.placeName.trim();

  if (title.length < 3 || title.length > 80) {
    fail("INVALID", "El título tiene que tener entre 3 y 80 caracteres.");
  }
  if (description.length > 2000) {
    fail("INVALID", "La descripción no puede pasar los 2000 caracteres.");
  }
  if (placeName.length < 2 || placeName.length > 120) {
    fail("INVALID", "El lugar tiene que tener entre 2 y 120 caracteres.");
  }
  if (dateChanged && input.startsAt <= now) {
    fail("INVALID", "La fecha de inicio tiene que ser en el futuro.");
  }
  if (input.endsAt <= input.startsAt) {
    fail("INVALID", "El evento tiene que terminar después de empezar.");
  }
  if (input.endsAt - input.startsAt > 7 * DAY) {
    fail("INVALID", "Un evento no puede durar más de 7 días.");
  }
  if (
    !between(input.lat, UY_BOUNDS.minLat, UY_BOUNDS.maxLat) ||
    !between(input.lon, UY_BOUNDS.minLon, UY_BOUNDS.maxLon)
  ) {
    fail("INVALID", "El lugar tiene que estar en Uruguay.");
  }
  return { ...input, title, description, placeName };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run convex/lib/eventValidation.test.ts`
Expected: PASS.

- [ ] **Step 5: Test del slug: `convex/lib/slug.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { insertEvent, makeUser, setup } from "../test.helpers";
import { slugBase, uniqueSlug } from "./slug";

// 2026-10-10 01:00 UTC = 2026-10-09 22:00 en Montevideo
const LATE_NIGHT = Date.UTC(2026, 9, 10, 1);

describe("slugBase", () => {
  test("saca acentos, baja a minúsculas y usa la fecha de Montevideo", () => {
    expect(slugBase("Junada Clásicos & Café!", LATE_NIGHT)).toBe(
      "junada-clasicos-cafe-2026-10-09",
    );
  });

  test("título de sólo emojis cae en 'evento'", () => {
    expect(slugBase("🔥🔥🔥", LATE_NIGHT)).toBe("evento-2026-10-09");
  });

  test("corta el título a 60 sin dejar guion colgando", () => {
    const slug = slugBase(`${"a".repeat(59)} bbbb`, LATE_NIGHT);
    expect(slug).toBe(`${"a".repeat(59)}-2026-10-09`);
  });

  test("conserva 4x4", () => {
    expect(slugBase("Salida 4x4", LATE_NIGHT)).toBe("salida-4x4-2026-10-09");
  });
});

describe("uniqueSlug", () => {
  test("agrega -2, -3 si ya existe", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    expect(await t.run((ctx) => uniqueSlug(ctx, "junada-2026-10-09"))).toBe(
      "junada-2026-10-09",
    );
    await insertEvent(t, id, { slug: "junada-2026-10-09" });
    await insertEvent(t, id, { slug: "junada-2026-10-09-2" });
    expect(await t.run((ctx) => uniqueSlug(ctx, "junada-2026-10-09"))).toBe(
      "junada-2026-10-09-3",
    );
  });
});
```

- [ ] **Step 6: Correr y ver que falla**

Run: `npx vitest run convex/lib/slug.test.ts`
Expected: FAIL, el módulo `./slug` no existe.

- [ ] **Step 7: Crear `convex/lib/slug.ts`**

```ts
import type { QueryCtx } from "../_generated/server";
import { HOUR } from "./validation";

// Uruguay no tiene horario de verano desde 2015: UTC-3 fijo.
const MONTEVIDEO_OFFSET = 3 * HOUR;

export function slugBase(title: string, startsAt: number): string {
  const words =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "evento";
  const date = new Date(startsAt - MONTEVIDEO_OFFSET).toISOString().slice(0, 10);
  return `${words}-${date}`;
}

export async function uniqueSlug(ctx: QueryCtx, base: string): Promise<string> {
  let slug = base;
  for (let n = 2; ; n++) {
    const taken = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!taken) return slug;
    slug = `${base}-${n}`;
  }
}
```

- [ ] **Step 8: Correr todos los tests**

Run: `npm test`
Expected: todos pasan.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: validación de eventos y slugs únicos"
```

---

### Task 5: Mutations de eventos e imágenes

**Files:**
- Create: `convex/lib/eventView.ts`, `convex/files.ts`, `convex/events.ts`, `convex/events.mutations.test.ts`

**Interfaces:**
- Consumes: `requirePublisher`, `requireAdmin`, `validateEventInput`, `EventInput`, `slugBase`, `uniqueSlug`, `fail`, `eventKind`.
- Produces:
  - `toEventView(ctx: QueryCtx, event: Doc<"events">): Promise<EventView>`, con `EventView = Doc<"events"> & { imageUrl: string | null; organizer: { _id: Id<"users">; name: string | null; image: string | null } | null }`
  - `api.files.generateUploadUrl()` → `string`
  - `api.events.create(EventInput)` → `{ id: Id<"events">; slug: string }`
  - `api.events.update({ id, title?, description?, kind?, startsAt?, endsAt?, placeName?, lat?, lon?, imageId?, removeImage? })` → `null`
  - `api.events.cancel({ id })`, `api.events.hide({ id })`, `api.events.unhide({ id })` → `null`

- [ ] **Step 1: Test: `convex/events.mutations.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { DAY, HOUR, expectCode, insertEvent, makeUser, setup, type T } from "./test.helpers";

function validInput() {
  const startsAt = Date.now() + 2 * DAY;
  return {
    title: "Cars & Coffee Carrasco",
    description: "Café y fierros",
    kind: "cars_and_coffee" as const,
    startsAt,
    endsAt: startsAt + 3 * HOUR,
    placeName: "Rambla de Carrasco",
    lat: -34.88,
    lon: -56.05,
  };
}

const storeImage = (t: T) => t.run((ctx) => ctx.storage.store(new Blob(["img"])));

describe("events.create", () => {
  test("un publisher crea un evento publicado con slug", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    const { id, slug } = await as.mutation(api.events.create, validInput());
    expect(slug).toMatch(/^cars-coffee-carrasco-\d{4}-\d{2}-\d{2}$/);
    const event = await t.run((ctx) => ctx.db.get(id));
    expect(event).toMatchObject({
      status: "published",
      attendeeCount: 0,
      organizerId: userId,
    });
  });

  test("dos eventos con el mismo título y fecha tienen slugs distintos", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const input = validInput();
    const a = await as.mutation(api.events.create, input);
    const b = await as.mutation(api.events.create, input);
    expect(b.slug).toBe(`${a.slug}-2`);
  });

  test("un user común no puede publicar", async () => {
    const t = setup();
    const { as } = await makeUser(t, "user");
    await expectCode(as.mutation(api.events.create, validInput()), "FORBIDDEN");
  });

  test("anónimo no puede publicar", async () => {
    const t = setup();
    await expectCode(t.mutation(api.events.create, validInput()), "UNAUTHENTICATED");
  });

  test("valida el input", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    await expectCode(as.mutation(api.events.create, { ...validInput(), lat: 10 }), "INVALID");
  });

  test("imageId de un archivo inexistente → INVALID", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const imageId = await storeImage(t);
    await t.run((ctx) => ctx.storage.delete(imageId));
    await expectCode(as.mutation(api.events.create, { ...validInput(), imageId }), "INVALID");
  });
});

describe("events.update", () => {
  test("el organizador edita y el slug no cambia", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const { id, slug } = await as.mutation(api.events.create, validInput());
    await as.mutation(api.events.update, { id, title: "Otro título" });
    const event = await t.run((ctx) => ctx.db.get(id));
    expect(event?.title).toBe("Otro título");
    expect(event?.slug).toBe(slug);
  });

  test("otro publisher no puede editar", async () => {
    const t = setup();
    const owner = await makeUser(t, "publisher", "Owner");
    const other = await makeUser(t, "publisher", "Other");
    const { id } = await owner.as.mutation(api.events.create, validInput());
    await expectCode(other.as.mutation(api.events.update, { id, title: "Hack" }), "FORBIDDEN");
  });

  test("se puede editar el título de un evento que ya empezó", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    const id = await insertEvent(t, userId, {
      startsAt: Date.now() - HOUR,
      endsAt: Date.now() + 2 * HOUR,
    });
    await as.mutation(api.events.update, { id, title: "Seguimos acá" });
    expect((await t.run((ctx) => ctx.db.get(id)))?.title).toBe("Seguimos acá");
  });

  test("mover la fecha al pasado → INVALID", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const { id } = await as.mutation(api.events.create, validInput());
    await expectCode(
      as.mutation(api.events.update, {
        id,
        startsAt: Date.now() - DAY,
        endsAt: Date.now() - DAY + HOUR,
      }),
      "INVALID",
    );
  });

  test("no se edita un evento cancelado", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const { id } = await as.mutation(api.events.create, validInput());
    await as.mutation(api.events.cancel, { id });
    await expectCode(as.mutation(api.events.update, { id, title: "Vuelve" }), "INVALID");
  });

  test("un update sin imagen no borra la imagen actual", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const imageId = await storeImage(t);
    const { id } = await as.mutation(api.events.create, { ...validInput(), imageId });
    await as.mutation(api.events.update, { id, title: "Nuevo título" });
    expect(await t.run((ctx) => ctx.db.system.get(imageId))).not.toBeNull();
    expect((await t.run((ctx) => ctx.db.get(id)))?.imageId).toBe(imageId);
  });

  test("reemplazar la imagen borra la anterior", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const oldImage = await storeImage(t);
    const newImage = await storeImage(t);
    const { id } = await as.mutation(api.events.create, { ...validInput(), imageId: oldImage });
    await as.mutation(api.events.update, { id, imageId: newImage });
    expect(await t.run((ctx) => ctx.db.system.get(oldImage))).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(id)))?.imageId).toBe(newImage);
  });

  test("removeImage saca y borra la imagen", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const imageId = await storeImage(t);
    const { id } = await as.mutation(api.events.create, { ...validInput(), imageId });
    await as.mutation(api.events.update, { id, removeImage: true });
    expect(await t.run((ctx) => ctx.db.system.get(imageId))).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(id)))?.imageId).toBeUndefined();
  });
});

describe("events.cancel / hide / unhide", () => {
  test("el organizador cancela; cancelar dos veces → INVALID", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const { id } = await as.mutation(api.events.create, validInput());
    await as.mutation(api.events.cancel, { id });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("cancelled");
    await expectCode(as.mutation(api.events.cancel, { id }), "INVALID");
  });

  test("evento inexistente → NOT_FOUND", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    const id = await insertEvent(t, userId);
    await t.run((ctx) => ctx.db.delete(id));
    await expectCode(as.mutation(api.events.cancel, { id }), "NOT_FOUND");
  });

  test("sólo admin oculta y vuelve a mostrar", async () => {
    const t = setup();
    const pub = await makeUser(t, "publisher");
    const admin = await makeUser(t, "admin", "Admin");
    const { id } = await pub.as.mutation(api.events.create, validInput());
    await expectCode(pub.as.mutation(api.events.hide, { id }), "FORBIDDEN");
    await admin.as.mutation(api.events.hide, { id });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("hidden");
    await expectCode(pub.as.mutation(api.events.update, { id, title: "x y z" }), "INVALID");
    await admin.as.mutation(api.events.unhide, { id });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("published");
  });
});

describe("files.generateUploadUrl", () => {
  test("sólo publishers", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    const pub = await makeUser(t, "publisher", "Pub");
    await expectCode(user.as.mutation(api.files.generateUploadUrl, {}), "FORBIDDEN");
    expect(await pub.as.mutation(api.files.generateUploadUrl, {})).toBeTypeOf("string");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run convex/events.mutations.test.ts`
Expected: FAIL, `api.events` y `api.files` no existen.

- [ ] **Step 3: Crear `convex/lib/eventView.ts`**

```ts
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type EventView = Doc<"events"> & {
  imageUrl: string | null;
  organizer: { _id: Id<"users">; name: string | null; image: string | null } | null;
};

/** Forma en que las queries públicas devuelven un evento. */
export async function toEventView(ctx: QueryCtx, event: Doc<"events">): Promise<EventView> {
  const organizer = await ctx.db.get(event.organizerId);
  return {
    ...event,
    imageUrl: event.imageId ? await ctx.storage.getUrl(event.imageId) : null,
    organizer: organizer
      ? { _id: organizer._id, name: organizer.name ?? null, image: organizer.image ?? null }
      : null,
  };
}
```

- [ ] **Step 4: Crear `convex/files.ts`**

```ts
import { mutation } from "./_generated/server";
import { requirePublisher } from "./lib/auth";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePublisher(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
```

- [ ] **Step 5: Crear `convex/events.ts` (mutations)**

```ts
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation } from "./_generated/server";
import { requireAdmin, requirePublisher } from "./lib/auth";
import { fail } from "./lib/errors";
import { slugBase, uniqueSlug } from "./lib/slug";
import { validateEventInput } from "./lib/validation";
import { eventKind } from "./lib/validators";

const eventFields = {
  title: v.string(),
  description: v.string(),
  kind: eventKind,
  startsAt: v.number(),
  endsAt: v.number(),
  placeName: v.string(),
  lat: v.number(),
  lon: v.number(),
};

async function assertImageExists(ctx: MutationCtx, imageId: Id<"_storage"> | undefined) {
  if (imageId && !(await ctx.db.system.get(imageId))) {
    fail("INVALID", "La imagen no existe. Volvé a subirla.");
  }
}

async function getEventOrFail(ctx: MutationCtx, id: Id<"events">) {
  const event = await ctx.db.get(id);
  if (!event) fail("NOT_FOUND", "El evento no existe.");
  return event;
}

function assertOrganizer(user: Doc<"users">, event: Doc<"events">) {
  if (event.organizerId !== user._id) {
    fail("FORBIDDEN", "Sólo el organizador puede modificar este evento.");
  }
}

export const create = mutation({
  args: { ...eventFields, imageId: v.optional(v.id("_storage")) },
  handler: async (ctx, args) => {
    const user = await requirePublisher(ctx);
    const now = Date.now();
    const input = validateEventInput(args, now, { dateChanged: true });
    await assertImageExists(ctx, input.imageId);
    const slug = await uniqueSlug(ctx, slugBase(input.title, input.startsAt));
    const id = await ctx.db.insert("events", {
      ...input,
      slug,
      organizerId: user._id,
      status: "published",
      attendeeCount: 0,
      updatedAt: now,
    });
    return { id, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    kind: v.optional(eventKind),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    placeName: v.optional(v.string()),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    imageId: v.optional(v.id("_storage")),
    removeImage: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, removeImage, imageId, ...patch }) => {
    const user = await requirePublisher(ctx);
    const event = await getEventOrFail(ctx, id);
    assertOrganizer(user, event);
    if (event.status !== "published") {
      fail("INVALID", "No se puede editar un evento cancelado u oculto.");
    }

    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<typeof patch>;
    const merged = {
      title: event.title,
      description: event.description,
      kind: event.kind,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      placeName: event.placeName,
      lat: event.lat,
      lon: event.lon,
      ...definedPatch,
    };
    const dateChanged =
      merged.startsAt !== event.startsAt || merged.endsAt !== event.endsAt;
    const input = validateEventInput(merged, Date.now(), { dateChanged });

    let nextImage = event.imageId;
    if (removeImage) nextImage = undefined;
    if (imageId !== undefined) {
      await assertImageExists(ctx, imageId);
      nextImage = imageId;
    }
    if (event.imageId && event.imageId !== nextImage) {
      await ctx.storage.delete(event.imageId);
    }

    await ctx.db.patch(id, { ...input, imageId: nextImage, updatedAt: Date.now() });
    return null;
  },
});

export const cancel = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    const user = await requirePublisher(ctx);
    const event = await getEventOrFail(ctx, id);
    assertOrganizer(user, event);
    if (event.status !== "published") {
      fail("INVALID", "Sólo se puede cancelar un evento publicado.");
    }
    await ctx.db.patch(id, { status: "cancelled", updatedAt: Date.now() });
    return null;
  },
});

export const hide = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await getEventOrFail(ctx, id);
    await ctx.db.patch(id, { status: "hidden", updatedAt: Date.now() });
    return null;
  },
});

export const unhide = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const event = await getEventOrFail(ctx, id);
    if (event.status !== "hidden") fail("INVALID", "El evento no está oculto.");
    await ctx.db.patch(id, { status: "published", updatedAt: Date.now() });
    return null;
  },
});

```

- [ ] **Step 6: Regenerar los tipos y correr los tests**

Run: `npx convex dev --once && npx vitest run convex/events.mutations.test.ts`
Expected: PASS.

Si `ctx.db.patch(id, { imageId: undefined })` no saca el campo en convex-test, se reemplaza por `ctx.db.replace(id, { ...rest, imageId: nextImage })` usando todo el documento sin `_id` y `_creationTime`. En Convex, `patch` con `undefined` borra el campo.

- [ ] **Step 7: Correr toda la suite y el typecheck**

Run: `npm test && npm run typecheck`
Expected: todo pasa.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: crear, editar, cancelar y ocultar eventos; subida de imágenes"
```

---

### Task 6: Queries públicas de eventos

**Files:**
- Modify: `convex/events.ts` (agregar las queries y ampliar los imports)
- Create: `convex/events.queries.test.ts`

**Interfaces:**
- Consumes: `toEventView`, `EventView`, `currentUser`, `roleOf`, `requirePublisher`, `fail`, `DAY`, `eventKind`.
- Produces:
  - `api.events.listUpcoming({ paginationOpts, kind? })` → `PaginationResult<EventView>`
  - `api.events.listInBounds({ minLat, maxLat, minLon, maxLon, from, to })` → `EventView[]`
  - `api.events.getBySlug({ slug })` → `EventView | null`
  - `api.events.listMine()` → `EventView[]`

- [ ] **Step 1: Test: `convex/events.queries.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { DAY, HOUR, expectCode, insertEvent, makeUser, setup } from "./test.helpers";

const page = { numItems: 50, cursor: null };

describe("events.listUpcoming", () => {
  test("sólo publicados que no terminaron, ordenados por fecha", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    const now = Date.now();
    await insertEvent(t, id, { title: "Después", startsAt: now + 3 * DAY, endsAt: now + 3 * DAY + HOUR });
    await insertEvent(t, id, { title: "Antes", startsAt: now + DAY, endsAt: now + DAY + HOUR });
    await insertEvent(t, id, { title: "En curso", startsAt: now - HOUR, endsAt: now + HOUR });
    await insertEvent(t, id, { title: "Terminado", startsAt: now - 5 * HOUR, endsAt: now - HOUR });
    await insertEvent(t, id, { title: "Cancelado", status: "cancelled" });
    await insertEvent(t, id, { title: "Oculto", status: "hidden" });

    const result = await t.query(api.events.listUpcoming, { paginationOpts: page });
    expect(result.page.map((e) => e.title)).toEqual(["En curso", "Antes", "Después"]);
    expect(result.page[0].organizer?._id).toBe(id);
    expect(result.page[0].imageUrl).toBeNull();
  });

  test("filtra por kind", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    await insertEvent(t, id, { kind: "jdm", title: "JDM" });
    await insertEvent(t, id, { kind: "motos", title: "Motos" });
    const result = await t.query(api.events.listUpcoming, { paginationOpts: page, kind: "motos" });
    expect(result.page.map((e) => e.title)).toEqual(["Motos"]);
  });

  test("resuelve imageUrl", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["img"])));
    await insertEvent(t, id, { imageId });
    const result = await t.query(api.events.listUpcoming, { paginationOpts: page });
    expect(result.page[0].imageUrl).toBeTypeOf("string");
  });
});

describe("events.listInBounds", () => {
  const montevideo = { minLat: -35.0, maxLat: -34.7, minLon: -56.4, maxLon: -55.9 };

  test("devuelve los publicados dentro del bbox y del rango", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    const now = Date.now();
    await insertEvent(t, id, { title: "Pocitos", lat: -34.91, lon: -56.15 });
    await insertEvent(t, id, { title: "Salto", lat: -31.38, lon: -57.96 });
    await insertEvent(t, id, { title: "Lejos en el tiempo", startsAt: now + 60 * DAY, endsAt: now + 60 * DAY + HOUR });
    await insertEvent(t, id, { title: "Cancelado", status: "cancelled" });

    const result = await t.query(api.events.listInBounds, {
      ...montevideo,
      from: now,
      to: now + 30 * DAY,
    });
    expect(result.map((e) => e.title)).toEqual(["Pocitos"]);
  });

  test("máximo 200 resultados", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    for (let i = 0; i < 205; i++) await insertEvent(t, id);
    const now = Date.now();
    const result = await t.query(api.events.listInBounds, { ...montevideo, from: now, to: now + 7 * DAY });
    expect(result).toHaveLength(200);
  });

  test.each([
    ["bbox invertido", { minLat: -34.7, maxLat: -35.0 }],
    ["lon invertida", { minLon: -55.9, maxLon: -56.4 }],
    ["to antes de from", { from: Date.now() + DAY, to: Date.now() }],
    ["ventana de más de 90 días", { from: Date.now(), to: Date.now() + 91 * DAY }],
  ])("%s → INVALID", async (_name, patch) => {
    const t = setup();
    await expectCode(
      t.query(api.events.listInBounds, {
        ...montevideo,
        from: Date.now(),
        to: Date.now() + DAY,
        ...patch,
      }),
      "INVALID",
    );
  });
});

describe("events.getBySlug", () => {
  test("devuelve publicados y cancelados", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    await insertEvent(t, id, { slug: "pub" });
    await insertEvent(t, id, { slug: "can", status: "cancelled" });
    expect((await t.query(api.events.getBySlug, { slug: "pub" }))?.slug).toBe("pub");
    expect((await t.query(api.events.getBySlug, { slug: "can" }))?.status).toBe("cancelled");
    expect(await t.query(api.events.getBySlug, { slug: "nope" })).toBeNull();
  });

  test("un oculto sólo lo ven el organizador y los admins", async () => {
    const t = setup();
    const owner = await makeUser(t, "publisher", "Owner");
    const admin = await makeUser(t, "admin", "Admin");
    const stranger = await makeUser(t, "user", "Stranger");
    await insertEvent(t, owner.id, { slug: "oculto", status: "hidden" });
    expect(await t.query(api.events.getBySlug, { slug: "oculto" })).toBeNull();
    expect(await stranger.as.query(api.events.getBySlug, { slug: "oculto" })).toBeNull();
    expect(await owner.as.query(api.events.getBySlug, { slug: "oculto" })).not.toBeNull();
    expect(await admin.as.query(api.events.getBySlug, { slug: "oculto" })).not.toBeNull();
  });
});

describe("events.listMine", () => {
  test("todos los eventos del organizador, sin importar estado, los más recientes primero", async () => {
    const t = setup();
    const me = await makeUser(t, "publisher", "Me");
    const other = await makeUser(t, "publisher", "Other");
    const now = Date.now();
    await insertEvent(t, me.id, { title: "Viejo", startsAt: now - 10 * DAY, endsAt: now - 10 * DAY + HOUR });
    await insertEvent(t, me.id, { title: "Nuevo", startsAt: now + 5 * DAY, endsAt: now + 5 * DAY + HOUR });
    await insertEvent(t, me.id, { title: "Oculto", status: "hidden" });
    await insertEvent(t, other.id, { title: "Ajeno" });
    const mine = await me.as.query(api.events.listMine, {});
    expect(mine.map((e) => e.title)).toEqual(["Nuevo", "Oculto", "Viejo"]);
  });

  test("un user común → FORBIDDEN", async () => {
    const t = setup();
    const { as } = await makeUser(t, "user");
    await expectCode(as.query(api.events.listMine, {}), "FORBIDDEN");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run convex/events.queries.test.ts`
Expected: FAIL, `api.events.listUpcoming` no existe.

- [ ] **Step 3: Agregar las queries a `convex/events.ts`**

Reemplazar estas dos líneas de import:

```ts
import { type MutationCtx, mutation } from "./_generated/server";
import { requireAdmin, requirePublisher } from "./lib/auth";
```

por:

```ts
import { type MutationCtx, mutation, query } from "./_generated/server";
import { currentUser, requireAdmin, requirePublisher, roleOf } from "./lib/auth";
```

Cambiar `import { validateEventInput } from "./lib/validation";` por `import { DAY, validateEventInput } from "./lib/validation";` y agregar estos imports:

```ts
import { paginationOptsValidator } from "convex/server";
import { toEventView } from "./lib/eventView";
```

Y al final del archivo:

```ts
const MAX_IN_BOUNDS = 200;

export const listUpcoming = query({
  args: { paginationOpts: paginationOptsValidator, kind: v.optional(eventKind) },
  handler: async (ctx, { paginationOpts, kind }) => {
    const now = Date.now();
    const result = await ctx.db
      .query("events")
      .withIndex("by_status_startsAt", (q) =>
        q.eq("status", "published").gte("startsAt", now - DAY),
      )
      .filter((q) =>
        kind
          ? q.and(q.gte(q.field("endsAt"), now), q.eq(q.field("kind"), kind))
          : q.gte(q.field("endsAt"), now),
      )
      .paginate(paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((event) => toEventView(ctx, event))),
    };
  },
});

export const listInBounds = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLon: v.number(),
    maxLon: v.number(),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.minLat > args.maxLat || args.minLon > args.maxLon) {
      fail("INVALID", "El área del mapa no es válida.");
    }
    if (args.to < args.from || args.to - args.from > 90 * DAY) {
      fail("INVALID", "El rango de fechas tiene que ser de hasta 90 días.");
    }
    const events = await ctx.db
      .query("events")
      .withIndex("by_status_startsAt", (q) =>
        q.eq("status", "published").gte("startsAt", args.from).lte("startsAt", args.to),
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("lat"), args.minLat),
          q.lte(q.field("lat"), args.maxLat),
          q.gte(q.field("lon"), args.minLon),
          q.lte(q.field("lon"), args.maxLon),
        ),
      )
      .take(MAX_IN_BOUNDS);
    return await Promise.all(events.map((event) => toEventView(ctx, event)));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!event) return null;
    if (event.status === "hidden") {
      const viewer = await currentUser(ctx);
      const canSee =
        viewer && (viewer._id === event.organizerId || roleOf(viewer) === "admin");
      if (!canSee) return null;
    }
    return await toEventView(ctx, event);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePublisher(ctx);
    const events = await ctx.db
      .query("events")
      .withIndex("by_organizer", (q) => q.eq("organizerId", user._id))
      .order("desc")
      .collect();
    return await Promise.all(events.map((event) => toEventView(ctx, event)));
  },
});
```

- [ ] **Step 4: Regenerar los tipos y correr los tests**

Run: `npx convex dev --once && npx vitest run convex/events.queries.test.ts`
Expected: PASS.

En el test de `listMine`, "Oculto" usa el `startsAt` por defecto (`now + DAY`), así que el orden descendente es Nuevo (+5 días) → Oculto (+1 día) → Viejo (−10 días).

- [ ] **Step 5: Suite completa y typecheck**

Run: `npm test && npm run typecheck`
Expected: todo pasa.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: queries de eventos (próximos, mapa, ficha por slug, mis eventos)"
```

---

### Task 7: Asistencia ("Voy")

**Files:**
- Create: `convex/attendance.ts`, `convex/attendance.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `fail`, `toEventView`, `EventView`, `getAuthUserId`.
- Produces:
  - `api.attendance.toggle({ eventId })` → `{ attending: boolean }`
  - `api.attendance.isAttending({ eventId })` → `boolean`
  - `api.attendance.myEvents()` → `EventView[]`

- [ ] **Step 1: Test: `convex/attendance.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DAY, HOUR, expectCode, insertEvent, makeUser, setup, type T } from "./test.helpers";

const countOf = async (t: T, id: Id<"events">) =>
  (await t.run((ctx) => ctx.db.get(id)))?.attendeeCount;

describe("attendance.toggle", () => {
  test("marcar y desmarcar ajusta el contador", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const eventId = await insertEvent(t, org.id);

    expect(await fan.as.mutation(api.attendance.toggle, { eventId })).toEqual({ attending: true });
    expect(await countOf(t, eventId)).toBe(1);
    expect(await fan.as.query(api.attendance.isAttending, { eventId })).toBe(true);

    expect(await fan.as.mutation(api.attendance.toggle, { eventId })).toEqual({ attending: false });
    expect(await countOf(t, eventId)).toBe(0);
    expect(await fan.as.query(api.attendance.isAttending, { eventId })).toBe(false);
  });

  test("dos usuarios suman 2", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const a = await makeUser(t, "user", "A");
    const b = await makeUser(t, "user", "B");
    const eventId = await insertEvent(t, org.id);
    await a.as.mutation(api.attendance.toggle, { eventId });
    await b.as.mutation(api.attendance.toggle, { eventId });
    expect(await countOf(t, eventId)).toBe(2);
  });

  test("no se puede marcar un evento cancelado, oculto o terminado", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const now = Date.now();
    const cancelled = await insertEvent(t, org.id, { status: "cancelled" });
    const hidden = await insertEvent(t, org.id, { status: "hidden" });
    const past = await insertEvent(t, org.id, { startsAt: now - DAY, endsAt: now - DAY + HOUR });
    for (const eventId of [cancelled, hidden, past]) {
      await expectCode(fan.as.mutation(api.attendance.toggle, { eventId }), "INVALID");
    }
  });

  test("desmarcar un evento que después se canceló funciona y no deja negativo", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const eventId = await insertEvent(t, org.id);
    await fan.as.mutation(api.attendance.toggle, { eventId });
    // Simula un contador desincronizado en 0 para verificar el piso.
    await t.run((ctx) => ctx.db.patch(eventId, { status: "cancelled", attendeeCount: 0 }));
    expect(await fan.as.mutation(api.attendance.toggle, { eventId })).toEqual({ attending: false });
    expect(await countOf(t, eventId)).toBe(0);
  });

  test("anónimo → UNAUTHENTICATED; evento inexistente → NOT_FOUND", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const eventId = await insertEvent(t, org.id);
    await expectCode(t.mutation(api.attendance.toggle, { eventId }), "UNAUTHENTICATED");
    await t.run((ctx) => ctx.db.delete(eventId));
    await expectCode(fan.as.mutation(api.attendance.toggle, { eventId }), "NOT_FOUND");
  });
});

describe("attendance.isAttending", () => {
  test("anónimo recibe false", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const eventId = await insertEvent(t, org.id);
    expect(await t.query(api.attendance.isAttending, { eventId })).toBe(false);
  });
});

describe("attendance.myEvents", () => {
  test("eventos a los que voy, sin ocultos, ordenados por fecha", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const now = Date.now();
    const later = await insertEvent(t, org.id, { title: "Después", startsAt: now + 3 * DAY, endsAt: now + 3 * DAY + HOUR });
    const sooner = await insertEvent(t, org.id, { title: "Antes", startsAt: now + DAY, endsAt: now + DAY + HOUR });
    const willHide = await insertEvent(t, org.id, { title: "Se oculta" });
    for (const eventId of [later, sooner, willHide]) {
      await fan.as.mutation(api.attendance.toggle, { eventId });
    }
    await t.run((ctx) => ctx.db.patch(willHide, { status: "hidden" }));
    const mine = await fan.as.query(api.attendance.myEvents, {});
    expect(mine.map((e) => e.title)).toEqual(["Antes", "Después"]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run convex/attendance.test.ts`
Expected: FAIL, `api.attendance` no existe.

- [ ] **Step 3: Crear `convex/attendance.ts`**

```ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { fail } from "./lib/errors";
import { toEventView } from "./lib/eventView";

export const toggle = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const user = await requireUser(ctx);
    const event = await ctx.db.get(eventId);
    if (!event) fail("NOT_FOUND", "El evento no existe.");

    const existing = await ctx.db
      .query("attendances")
      .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", user._id))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(eventId, { attendeeCount: Math.max(0, event.attendeeCount - 1) });
      return { attending: false };
    }

    if (event.status !== "published" || event.endsAt < Date.now()) {
      fail("INVALID", "Este evento ya no acepta asistencias.");
    }
    await ctx.db.insert("attendances", { eventId, userId: user._id });
    await ctx.db.patch(eventId, { attendeeCount: event.attendeeCount + 1 });
    return { attending: true };
  },
});

export const isAttending = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const row = await ctx.db
      .query("attendances")
      .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", userId))
      .first();
    return row !== null;
  },
});

export const myEvents = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("attendances")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const events = (await Promise.all(rows.map((row) => ctx.db.get(row.eventId)))).filter(
      (event): event is Doc<"events"> => event !== null && event.status !== "hidden",
    );
    events.sort((a, b) => a.startsAt - b.startsAt);
    return await Promise.all(events.map((event) => toEventView(ctx, event)));
  },
});
```

- [ ] **Step 4: Regenerar los tipos y correr los tests**

Run: `npx convex dev --once && npx vitest run convex/attendance.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite completa y typecheck**

Run: `npm test && npm run typecheck`
Expected: todo pasa.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: asistencia a eventos con contador"
```

---

### Task 8: Solicitudes para ser publisher

**Files:**
- Create: `convex/publisherRequests.ts`, `convex/publisherRequests.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `requireAdmin`, `roleOf`, `fail`.
- Produces:
  - `api.publisherRequests.submit({ message })` → `Id<"publisherRequests">`
  - `api.publisherRequests.mine()` → `Doc<"publisherRequests"> | null`
  - `api.publisherRequests.listPending()` → `Array<Doc<"publisherRequests"> & { user: { name: string | null; email: string | null; image: string | null } | null }>`
  - `api.publisherRequests.approve({ requestId })` → `null`
  - `api.publisherRequests.reject({ requestId })` → `null`

- [ ] **Step 1: Test: `convex/publisherRequests.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { expectCode, makeUser, setup } from "./test.helpers";

const MSG = "Organizo la junada de los jueves en Pocitos, @juntadapocitos";

describe("publisherRequests", () => {
  test("flujo completo: submit → listPending → approve cambia el rol", async () => {
    const t = setup();
    const user = await makeUser(t, "user", "Lauti");
    const admin = await makeUser(t, "admin", "Admin");

    const requestId = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    const pending = await admin.as.query(api.publisherRequests.listPending, {});
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ _id: requestId, user: { name: "Lauti" } });

    await admin.as.mutation(api.publisherRequests.approve, { requestId });
    expect((await user.as.query(api.users.me, {}))?.role).toBe("publisher");
    expect(await user.as.query(api.publisherRequests.mine, {})).toMatchObject({
      status: "approved",
      reviewedBy: admin.id,
    });
    expect(await admin.as.query(api.publisherRequests.listPending, {})).toHaveLength(0);
  });

  test("no se puede tener dos solicitudes pendientes", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    await expectCode(user.as.mutation(api.publisherRequests.submit, { message: MSG }), "CONFLICT");
  });

  test("un publisher no puede pedir otra vez", async () => {
    const t = setup();
    const pub = await makeUser(t, "publisher");
    await expectCode(pub.as.mutation(api.publisherRequests.submit, { message: MSG }), "CONFLICT");
  });

  test("rechazada se puede volver a pedir; mine devuelve la última", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const first = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    await admin.as.mutation(api.publisherRequests.reject, { requestId: first });
    expect((await user.as.query(api.users.me, {}))?.role).toBe("user");
    const second = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    expect((await user.as.query(api.publisherRequests.mine, {}))?._id).toBe(second);
  });

  test("aprobar o rechazar algo ya resuelto → CONFLICT", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const requestId = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    await admin.as.mutation(api.publisherRequests.approve, { requestId });
    await expectCode(admin.as.mutation(api.publisherRequests.reject, { requestId }), "CONFLICT");
    await expectCode(admin.as.mutation(api.publisherRequests.approve, { requestId }), "CONFLICT");
  });

  test("mensaje corto o largo → INVALID", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    await expectCode(user.as.mutation(api.publisherRequests.submit, { message: "  hola  " }), "INVALID");
    await expectCode(
      user.as.mutation(api.publisherRequests.submit, { message: "x".repeat(501) }),
      "INVALID",
    );
  });

  test("permisos: sólo admin lista, aprueba y rechaza; anónimo no pide", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    const requestId = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    await expectCode(user.as.query(api.publisherRequests.listPending, {}), "FORBIDDEN");
    await expectCode(user.as.mutation(api.publisherRequests.approve, { requestId }), "FORBIDDEN");
    await expectCode(user.as.mutation(api.publisherRequests.reject, { requestId }), "FORBIDDEN");
    await expectCode(t.mutation(api.publisherRequests.submit, { message: MSG }), "UNAUTHENTICATED");
  });

  test("mine sin solicitudes devuelve null", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    expect(await user.as.query(api.publisherRequests.mine, {})).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run convex/publisherRequests.test.ts`
Expected: FAIL, `api.publisherRequests` no existe.

- [ ] **Step 3: Crear `convex/publisherRequests.ts`**

```ts
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireAdmin, requireUser, roleOf } from "./lib/auth";
import { fail } from "./lib/errors";

export const submit = mutation({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (roleOf(user) !== "user") fail("CONFLICT", "Ya podés publicar eventos.");

    const message = args.message.trim();
    if (message.length < 10 || message.length > 500) {
      fail("INVALID", "Contanos entre 10 y 500 caracteres sobre vos o tu grupo.");
    }

    const pending = await ctx.db
      .query("publisherRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (pending) fail("CONFLICT", "Ya tenés una solicitud pendiente.");

    return await ctx.db.insert("publisherRequests", {
      userId: user._id,
      message,
      status: "pending",
    });
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("publisherRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const requests = await ctx.db
      .query("publisherRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .collect();
    return await Promise.all(
      requests.map(async (request) => {
        const user = await ctx.db.get(request.userId);
        return {
          ...request,
          user: user
            ? { name: user.name ?? null, email: user.email ?? null, image: user.image ?? null }
            : null,
        };
      }),
    );
  },
});

async function resolve(
  ctx: MutationCtx,
  requestId: Id<"publisherRequests">,
  status: "approved" | "rejected",
) {
  const admin = await requireAdmin(ctx);
  const request = await ctx.db.get(requestId);
  if (!request) fail("NOT_FOUND", "La solicitud no existe.");
  if (request.status !== "pending") fail("CONFLICT", "La solicitud ya fue resuelta.");
  await ctx.db.patch(requestId, { status, reviewedBy: admin._id, reviewedAt: Date.now() });
  if (status === "approved") {
    await ctx.db.patch(request.userId, { role: "publisher", updatedAt: Date.now() });
  }
  return null;
}

export const approve = mutation({
  args: { requestId: v.id("publisherRequests") },
  handler: (ctx, { requestId }) => resolve(ctx, requestId, "approved"),
});

export const reject = mutation({
  args: { requestId: v.id("publisherRequests") },
  handler: (ctx, { requestId }) => resolve(ctx, requestId, "rejected"),
});
```

- [ ] **Step 4: Regenerar los tipos y correr los tests**

Run: `npx convex dev --once && npx vitest run convex/publisherRequests.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite completa y typecheck**

Run: `npm test && npm run typecheck`
Expected: todo pasa.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: solicitudes para ser publisher con aprobación de admin"
```

---

### Task 9: README de configuración y verificación manual

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: todo lo anterior. No produce código.

- [ ] **Step 1: Generar las claves de Convex Auth**

Run: `npx @convex-dev/auth --skip-git-check`
Expected: setea `JWT_PRIVATE_KEY`, `JWKS` y `SITE_URL` en el deployment de dev. Si pregunta por `SITE_URL`, usar `http://localhost:3000` en dev (el cliente web). Para Expo, ver la sección de la app móvil en el README.

- [ ] **Step 2: Crear `README.md`**

````markdown
# gridd-backend

Backend de Gridd en [Convex](https://convex.dev). Lo consumen la app móvil (Expo) y la web (Next.js).

## Desarrollo

```bash
npm install
npm run dev        # convex dev: sincroniza funciones y genera tipos
npm test           # vitest + convex-test
npm run typecheck
```

## Variables de entorno (en Convex, no en .env)

Se cargan con `npx convex env set NOMBRE valor` (agregar `--prod` para producción).

| Variable | Para qué |
|---|---|
| `JWT_PRIVATE_KEY`, `JWKS` | Firmar las sesiones. Las genera `npx @convex-dev/auth` |
| `SITE_URL` | URL a la que vuelve el OAuth (web o deep link de la app) |
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
- Cliente: `ConvexAuthProvider` de `@convex-dev/auth/react` con `storage` de `expo-secure-store`.
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
````

- [ ] **Step 3: Verificación final automática**

Run: `npm test && npm run typecheck && npx convex dev --once`
Expected: todos los tests pasan, sin errores de tipos, deploy OK.

- [ ] **Step 4: Verificación manual (después de cargar las env vars)**

En el dashboard de Convex (Functions → Run) o desde un cliente:

1. Registro con contraseña: `signIn("password", { flow: "signUp", email, password: "fierro123", name: "Prueba" })` crea el usuario con `role: "user"` (mirar la tabla `users`).
2. `flow: "reset"` con ese email: llega el mail con un código de 8 dígitos. `flow: "reset-verification"` con el código y una contraseña nueva permite entrar.
3. Login con Google: se crea el usuario con nombre e imagen.
4. Login con Apple: se prueba en el deployment con HTTPS.

Anotar en el README, en una sección "Verificado manualmente", la fecha y el resultado de cada uno.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: README con configuración de auth, env vars y API"
```
