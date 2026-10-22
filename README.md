# Gridd

App para encontrar y organizar juntadas de autos en Uruguay: meets, rodadas, cars & coffee, exposiciones, JDM, clásicos y más. Muestra los eventos cercanos en un mapa, deja confirmar asistencia, guardar eventos, armar tu garage y, si sos organizador, publicar los tuyos.

Hecha con [Expo](https://expo.dev) (React Native + Expo Router) y backend en [Convex](https://convex.dev), que vive en este mismo repo.

## Stack

- **App:** Expo SDK 57, React Native 0.86, Expo Router (rutas por archivo en `src/app/`), `react-native-maps`
- **Backend:** Convex (base de datos, funciones, storage y crons), Convex Auth (contraseña, Google y Apple), Resend para los mails
- **Instagram:** generación y publicación de posts con plantillas (Satori + resvg) y copys con Claude
- **Tests:** Vitest + `convex-test`
- **Paquetes:** [Bun](https://bun.sh) (`bun.lock`)

## Empezar

Requisitos: Bun, una cuenta de Convex y, para correr en el teléfono o el emulador, Android Studio o Xcode.

```bash
bun install
cp .env.example .env.local
bun run convex        # la primera vez crea el deployment de dev y completa CONVEX_* en .env.local
```

En otra terminal, con `bun run convex` corriendo:

```bash
bun run android       # o: bun run ios
```

La app usa módulos nativos (mapas, `expo-dev-client`), así que **no corre en Expo Go**: hace falta un development build. `bun run android` / `ios` lo compila localmente; después alcanza con `bun start` para levantar el bundler.

Para tener eventos de ejemplo en el deployment de dev:

```bash
bun scripts/seed-events.ts          # carga eventos con fotos (no duplica)
bun scripts/seed-events.ts --clear  # los borra
```

### Variables de entorno

En `.env.local` (ver `.env.example`):

| Variable | Para qué |
|---|---|
| `CONVEX_DEPLOYMENT`, `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL` | Conexión con Convex. Las genera `bun run convex` |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Maps SDK for Android. Se inyecta en `app.config.ts`; en iOS se usa Apple Maps |

Las variables del backend (auth, Resend, Instagram) se cargan en Convex con `bunx convex env set`, no en `.env`. Están en [`convex/README.md`](convex/README.md).

## Scripts

| Comando | Qué hace |
|---|---|
| `bun start` | Bundler de Expo |
| `bun run android` / `bun run ios` | Compila y abre el development build |
| `bun run web` | Versión web |
| `bun run convex` | `convex dev`: sincroniza funciones y genera tipos |
| `bun run test` / `bun run test:watch` | Tests del backend |
| `bun run typecheck` | TypeScript de la app y de `convex/` |
| `bun run lint` | ESLint |

## Estructura

```
src/
  app/          pantallas (Expo Router): (tabs)/ inicio, mapa, guardados, perfil;
                event/, events/, garage/, publish, login, email, interests
  components/   UI compartida (mapa, tarjetas de evento, diálogos, texto)
  services/     hooks que hablan con Convex (eventos, asistencia, autos, usuario…)
  lib/          cliente de Convex, uploads, helpers
  constants/    tema y estilo del mapa
convex/         backend: schema, funciones, auth, crons e instagram/
scripts/        seed de eventos y utilidades de las plantillas de Instagram
docs/           specs, planes y devlog
assets/         marca (assets/brand/), íconos y fotos de ejemplo
```

`android/` e `ios/` no se commitean: los genera Expo (Continuous Native Generation). La configuración nativa va en `app.json`, `app.config.ts` y config plugins.

## Backend

Todo lo de Convex (variables, login con Google/Apple, roles, API, errores y el flujo de posts de Instagram) está documentado en [`convex/README.md`](convex/README.md).

## Builds (EAS)

Los perfiles están en `eas.json`:

```bash
bunx eas-cli build --profile development   # dev client, distribución interna
bunx eas-cli build --profile preview       # APK interno de Android
bunx eas-cli build --profile production    # build de tienda (autoIncrement)
bunx eas-cli submit --profile production   # sube a Google Play (track internal)
```

Las variables de entorno de los builds se cargan en EAS con `bunx eas-cli env:create`.
