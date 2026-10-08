# Dev log — Mapa real con react-native-maps

- **Fecha:** 2026-10-08
- **Rama:** `gridd-map` (sale de `backend-convex` @ `3ae2e21`)
- **Estado:** integrado y probado en el emulador Android (development build): el mapa carga bien.

## Objetivo

Reemplazar el mapa de mentira de la pestaña **Mapa** (`StylizedMap`, calles dibujadas con `View`s)
por un mapa real, manteniendo la estética oscura de Gridd.

## Decisión: `react-native-maps`

| Opción | Por qué no / por qué sí |
|---|---|
| **react-native-maps** ✅ | Corre en Expo Go en iOS (Apple Maps); en Android hace falta development build (ver *Corrección*). Google Maps en Android, Apple Maps en iOS. Mostrar el mapa no tiene costo (Maps SDK móvil de Google y Apple Maps). Pines como componentes React. |
| `expo-maps` | En **alpha** en SDK 57, no corre en Expo Go y no trae agrupación de pines (clustering). |
| MapLibre / Mapbox | Más control del estilo, pero exigen development build y un proveedor de mapas (MapTiler, Stadia o Mapbox) con límites o costo. Quedan como opción si el estilo del mapa pasa a ser clave para la marca. |

Versión instalada con `bunx expo install`: `react-native-maps@1.27.2` (+ `expo-location@~57.0.20`).

## Corrección: Android no funciona en Expo Go

Al probarlo en el emulador, el mapa quedaba en blanco (sólo el logo de Google y los botones). En logcat:

```
E Google Maps Android API: Error requesting API token. StatusCode=INVALID_ARGUMENT
E Google Android Maps SDK: Authorization failure.
```

La API key de Google Maps que trae **Expo Go** es rechazada, y no se puede reemplazar. Por lo tanto,
en Android el mapa necesita un **development build** con nuestra propia key. Cambios para eso:

- `app.json`: `android.package` y `ios.bundleIdentifier` = **`com.gridd.app`** (ID permanente en las stores).
- `expo-dev-client` instalado; `bunx expo prebuild` cambió los scripts `android`/`ios` de `package.json` a `expo run:*`.
- `android/` se genera con prebuild (está en `.gitignore`, no se commitea).
- SHA-1 del debug keystore de la plantilla de Expo (`android/app/debug.keystore`):
  `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
- **JDK 17 obligatorio.** El JDK 25 de Android Studio (`/opt/android-studio/jbr`) rompe `configureCMakeDebug` de
  `react-native-worklets` y `react-native-screens` con `WARNING: A restricted method in java.lang.System has been called`.
  Solución: `sudo pacman -S jdk17-openjdk` y compilar con `JAVA_HOME=/usr/lib/jvm/java-17-openjdk`.

## Cambios

### Dependencias y configuración
- `package.json` / `bun.lock`: `react-native-maps` y `expo-location`.
- `app.json`: plugin `expo-location` con el texto del permiso
  ("Gridd usa tu ubicación para mostrarte los encuentros cerca tuyo."). Sólo pide permiso **mientras la app está en uso**, nunca en segundo plano.
- **`app.config.ts` (nuevo)**: extiende `app.json` y agrega el plugin `react-native-maps` con
  `androidGoogleMapsApiKey` desde la variable de entorno `GOOGLE_MAPS_ANDROID_API_KEY`, para que la key no quede en git.
  En iOS no se configura key, así que se usa Apple Maps.
- `.env.example`: documenta `GOOGLE_MAPS_ANDROID_API_KEY`.

### Código
- **`src/components/event-map.tsx` (nuevo)**: `EventMap`, envoltorio de `MapView`.
  - Pines con el mismo diseño que tenían en `StylizedMap`: punto blanco, y el seleccionado en el color de acento con un halo alrededor.
  - `tracksViewChanges={false}` para no redibujar los pines en cada frame. Cuando cambia la selección, el pin se vuelve a montar (la `key` incluye si está seleccionado).
  - Handle imperativo `focus(coordinate, delta?)` vía `ref` (React 19, `ref` como prop) para mover la cámara.
  - Sin puntos de interés, brújula, inclinación 3D ni la barra de herramientas de Google: solo calles y los pines.
  - `mapPadding` para que los chips y la tarjeta no tapen el centro del mapa ni el logo de Google (los términos de Google exigen que el logo se vea).
- **`src/components/event-map.web.tsx` (nuevo)**: `react-native-maps` no soporta web, así que en web
  se sigue usando `StylizedMap` con la misma API. Verificado: el bundle web no incluye `react-native-maps`.
- **`src/constants/map-style.ts` (nuevo)**: estilo oscuro de Google Maps armado con los tokens de `theme.ts`.
  En iOS se usa `userInterfaceStyle="dark"` de Apple Maps.
- **`src/app/(tabs)/map.tsx`**:
  - Usa `EventMap` con la región inicial en Montevideo y la Costa de Oro.
  - Tocar un pin lo selecciona y centra la cámara en él.
  - El botón **"Centrar en mi ubicación"** ahora funciona: pide el permiso, usa la última posición conocida (instantánea) o pide una nueva, y muestra el punto azul del usuario. Si el permiso se negó para siempre, ofrece abrir los Ajustes.
- **`src/data/events.ts`**: nuevo campo `coords: { latitude, longitude }` con coordenadas reales
  aproximadas de cada lugar de los eventos de ejemplo. `map: { x, y }` se mantiene para el fallback web.

## Lo que quedó afuera (y por qué)

- **No se conectó `events.listInBounds` de Convex.** Al momento de la integración la tabla `events`
  del deployment de desarrollo está **vacía**, y toda la UI (tarjetas, detalle `event/[id]`, filtro por
  categoría) sigue usando los datos de ejemplo de `src/data/events.ts`. Conectar solo el mapa dejaría pines
  que abren un detalle que no existe. Pasos para hacerlo:
  1. Migrar la lista y el detalle de eventos a Convex (`listUpcoming`, `getBySlug`).
  2. En el mapa, guardar la región en `onRegionChangeComplete` (con debounce) y pasarla a
     `useQuery(api.events.listInBounds, { minLat, maxLat, minLon, maxLon, from, to })`.
  3. Mapear `kind` (backend) ↔ categorías de los chips (UI); hoy no coinciden.
- **Agrupación de pines (clustering):** no hace falta con 7 eventos. Cuando haya muchos, agregar `supercluster`.
- **Búsqueda de direcciones en "Publicar → Dónde"**: necesita Places/Geocoding API de Google (con costo). Es otra tarea.

## Cómo probarlo

- **iOS en Expo Go:** `bunx expo start` y abrir la pestaña Mapa (Apple Maps, sin key).
  Si la PC y el teléfono están en subredes distintas (por ejemplo, la PC detrás del repetidor), usar `bunx expo start --tunnel`.
- **Android (development build local):**
  1. En Google Cloud, habilitar **Maps SDK for Android** y crear una API key restringida a *Apps de Android*
     con `com.gridd.app` y el SHA-1 de arriba.
  2. Ponerla en `.env.local`: `GOOGLE_MAPS_ANDROID_API_KEY=...`
  3. `JAVA_HOME=/usr/lib/jvm/java-17-openjdk bunx expo run:android --no-bundler` (desde la carpeta del proyecto).
     Si `android/` ya existía sin la key: `bunx expo prebuild --platform android` antes.
  4. Desde ahí, el día a día es sólo `bunx expo start --tunnel` y abrir la app "Gridd" (no Expo Go).
     Recompilar sólo al agregar librerías nativas, cambiar plugins/permisos en `app.json` o actualizar el SDK de Expo.
- **EAS:** agregar el SHA-1 de la keystore de EAS (expo.dev → Credentials) a la misma key, cargarla con
  `bunx eas-cli env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key>` y
  `bunx eas-cli build --profile development --platform android`.

## Verificación

- `bunx tsc --noEmit`: sin errores nuevos.
- `bunx expo lint`: sin errores nuevos.
- Bundles de Metro: Android ✅, iOS ✅, web ✅ (web resuelve `event-map.web.tsx`).
- `bunx expo config`: el plugin `react-native-maps` aparece con la key leída del entorno.

Avisos que ya estaban antes y no se tocaron:
- `src/services/cars.ts` no compila (`useUserCars` está a medio escribir), así que `tsc` y `lint` fallan en ese archivo.
- `expo-doctor`: algunas versiones de parche atrasadas (`expo`, `expo-router`, `expo-constants`, `expo-linking`, `@expo/ui`;
  se arregla con `bunx expo install --fix`) y el script `convex` de `package.json` choca con `node_modules/.bin/convex`.

## Actualización: identidad de marca

- Íconos de la app (`icon.png`, capas adaptativas de Android, monocromo, splash, favicon) reemplazados por los de
  Gridd. El ícono de 1024 se exportó desde el vector de `assets/brand/gridd-brand-sheet.pdf` (el PNG original medía 264).
  Se quitó `assets/expo.icon` (ícono de ejemplo de la plantilla); iOS usa `icon.png`. Requiere recompilar.
- Originales de marca copiados a `assets/brand/`.
- **Pines del mapa:** `EventMap` usa `gridd-pin-map-small.png` (30dp) y `gridd-pin-map-large.png` (46dp, el evento seleccionado),
  anclados en la punta del globo (`anchor y ≈ 0.96`). `tracksViewChanges` queda activo hasta que la imagen carga
  y después se apaga, para que en Android el pin no quede vacío.
