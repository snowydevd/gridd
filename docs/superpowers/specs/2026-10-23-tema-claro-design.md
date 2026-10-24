# Tema claro — diseño

Fecha: 2026-10-23 · Estado: aprobado en conversación, pendiente de revisión del documento

## Intención

Gridd hoy es sólo oscuro ("night-time starting grid"). Se agrega un tema claro para quien usa el teléfono en modo claro o lo prefiere de día. El tema claro tiene que sentirse Gridd: misma tipografía, mismas formas, mismo lima como color de marca, pero sin el problema de fondo: **el lima `#E2FF3B` sobre blanco tiene contraste 1,1:1 y no se ve**.

## Objetivos

- Paleta clara "Papel": fondo blanco roto cálido, tarjetas blancas, texto casi negro.
- El lima se queda donde se lee bien: como **relleno** con texto negro encima (botón principal, etiquetas sobre fotos). Donde hoy el lima es **texto, ícono, punto o línea fina**, en claro pasa a un oliva oscuro.
- Por defecto la app sigue el tema del sistema. El usuario puede elegir en Cuenta: Sistema, Claro u Oscuro.
- El cambio se aplica en vivo, sin reiniciar.

## No objetivos

- No se rediseña ninguna pantalla: mismos layouts, mismo espaciado, sólo colores.
- No se cambia el tema oscuro: visualmente queda idéntico al actual.
- No se cambian el ícono de la app ni el splash (siguen oscuros, son marca).
- No se cambia el sitio web (`frontend/`).

## Anti-objetivos (sería un fracaso aunque "funcione")

- Que quede algún texto, ícono o borde en lima sobre fondo claro.
- Que el tema oscuro cambie aunque sea un poco respecto de hoy.
- Que al cambiar de tema quede alguna pantalla con colores mezclados hasta reiniciar.

## Paleta (decidida)

| Token | Oscuro (actual, sin cambios) | Claro "Papel" | Uso |
|---|---|---|---|
| `canvas` | `#0B0B0C` | `#F6F5F0` | Fondo de pantalla |
| `surface` | `#17181B` | `#FFFFFF` | Tarjetas |
| `raised` | `#1F2024` | `#EEEDE7` | Elementos elevados, placeholder de imagen |
| `border` | `#2A2C30` | `#E1DFD7` | Bordes de 1px |
| `text` | `#F2F3F5` | `#121212` | Texto principal (17:1 sobre canvas claro) |
| `textSecondary` | `#8A8F98` | `#5E6168` | Texto secundario (5,7:1) |
| `textDisabled` | `#4A4E55` | `#A3A6AC` | Deshabilitado |
| `accent` | `#E2FF3B` | `#E2FF3B` | **Sólo relleno**: botón principal, etiquetas "Hoy"/"Próximo", fondos de chip activo si aplica |
| `onAccent` | `#0B0B0C` | `#0B0B0C` | Texto/ícono sobre `accent` (17:1) |
| `accentText` *(nuevo)* | `#E2FF3B` | `#4F5E00` | Acento como texto, ícono, punto "en vivo", borde de selección, barra del wordmark (6,6:1) |
| `success` | `#3DDC84` | `#16794A` | (5:1) |
| `warning` | `#FFB020` | `#9A5B00` | (5:1) |
| `error` | `#FF4D4F` | `#C8282B` | (5,1:1) |

`accentText` en oscuro vale lo mismo que `accent`, así que el tema oscuro no cambia.

**Regla para clasificar cada uso de `Colors.accent` (hoy ~50):**
- Es un fondo con contenido en `onAccent` encima → queda `accent`.
- Es color de texto, ícono, borde, punto, subrayado o la barra del wordmark → pasa a `accentText`.
- `tone="accent"` de `Text` → usa `accentText`.

**Contenido sobre fotos** — depende de si la foto es una tarjeta o llega al borde de la pantalla:

- **Tarjetas con texto encima** (destacado del Inicio en `src/app/(tabs)/index.tsx`, vista previa en `src/app/publish.tsx`): son bloques oscuros en ambos temas. Su `Fade` sigue difuminando hacia oscuro (`#0B0B0C`) y el texto encima mantiene los colores del tema oscuro (texto claro, lima para el punto "Hoy"). Así se vio en la maqueta aprobada de la paleta "Papel": el destacado es una tarjeta oscura dentro de la pantalla clara. (Respondido por la maqueta elegida.)
- **Portada a todo el ancho del detalle** (`src/app/event/[id].tsx`): el `Fade` difumina hacia el `canvas` del tema activo para que la foto se funda con la pantalla. El título, las etiquetas y todo lo que se superpone a la parte difuminada (el `body` sube con `marginTop` negativo) usan los tokens del tema activo, porque ahí el fondo ya es prácticamente el `canvas`. Los botones circulares de arriba (Volver, Compartir, Calendario, Más) van sobre la foto sin difuminar y mantienen su estilo oscuro de overlay. (Decisión de Claude.)
- **Etiquetas sobre la foto en sí** (día en las tarjetas de la grilla, "Próximo"/"Hoy" arriba del destacado): mantienen el estilo oscuro/lima en ambos temas.

Por lo tanto `Fade` necesita poder recibir el color hacia el que difumina (oscuro fijo o `canvas` del tema).

## Elección del tema (decidido)

- Tres opciones: **Sistema** (por defecto), **Claro**, **Oscuro**.
- "Sistema" sigue al teléfono en vivo (si el usuario cambia el modo del teléfono con la app abierta, la app cambia).
- La elección se guarda **en el dispositivo**, no en la cuenta de Convex: funciona para invitados y cada teléfono tiene la suya. (Decisión de Claude.)
- UI: en Cuenta, sección "Preferencias", fila "Apariencia" que muestra el valor actual y al tocarla despliega las tres opciones debajo, con el mismo patrón que el selector de radio (`RadiusOptions`). La sección "Preferencias" hoy está comentada en `account-details.tsx`; se agrega sólo esta fila (no se reactivan Intereses ni Ubicación). (Decisión de Claude.)

## Fuera de las pantallas

- `app.json`: `userInterfaceStyle` pasa de `"dark"` a `"automatic"` (requiere nuevo build nativo; documentarlo en el cambio).
- Barra de estado (`expo-status-bar` en `src/app/_layout.tsx`): texto claro en tema oscuro, oscuro en claro.
- Tema de navegación de expo-router (`ThemeProvider` con `DarkTheme` en `_layout.tsx`): usar `DefaultTheme` con los colores claros cuando corresponda, para que fondos de transición y headers no parpadeen en oscuro.
- Mapa (`src/components/event-map.tsx`): hoy usa `darkMapStyle` (`src/constants/map-style.ts`) y `userInterfaceStyle="dark"`. En claro necesita un estilo de Google Maps claro coherente con "Papel" (Android) y `userInterfaceStyle="light"` (Apple Maps en iOS). Los pines (PNG lima sin borde, `assets/brand/gridd-pin-map-*.png`) en un mapa claro quedarían con contraste ~1,1:1, así que en tema claro se usan variantes del mismo pin con un contorno oscuro (`#121212`) de 2 px; en oscuro se mantienen los actuales. (Decisión de Claude.)
- Web: el build web de Expo no se distribuye (el sitio público es `frontend/`), así que `stylized-map.tsx`, `event-map.web.tsx` y `date-time-field.web.tsx` quedan fuera de alcance; basta con que compilen. (Decisión de Claude.)
- Splash e ícono: sin cambios (oscuros).

## Restricciones

- Expo con React Native, expo-router, React Compiler activado.
- Hoy los colores son constantes (`Colors` en `src/constants/theme.ts`) usadas dentro de `StyleSheet.create` a nivel de módulo en ~29 archivos; esos estilos no pueden reaccionar a un cambio de tema tal cual están.
- Evitar sumar dependencias nativas nuevas si alguna existente alcanza para guardar la preferencia (ya está `expo-secure-store`).

## Lo que queda a criterio de quien implemente

- El mecanismo para que los estilos lean el tema activo (hook + fábrica de estilos, contexto, etc.), mientras cumpla el cambio en vivo y no cambie el tema oscuro.
- Dónde y cómo se guarda la preferencia en el dispositivo.
- El estilo exacto del mapa claro.
- Cómo verificar que no quedó lima sobre fondo claro (revisión pantalla por pantalla en el emulador en ambos temas es lo mínimo).
