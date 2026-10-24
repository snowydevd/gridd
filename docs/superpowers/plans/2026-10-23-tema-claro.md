# Tema claro — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar el tema claro "Papel" a la app mobile, con elección Sistema/Claro/Oscuro en Cuenta y cambio en vivo.

**Architecture:** Las paletas viven en un módulo puro (`src/theme/palettes.ts`, testeable con vitest). Un `ThemeProvider` resuelve la paleta activa (preferencia guardada en el dispositivo + esquema del sistema) y la expone con `useTheme()`. Los estilos pasan de `StyleSheet.create` a nivel de módulo a `makeStyles((c) => ({...}))`, que devuelve un hook con una hoja de estilos cacheada por paleta.

**Tech Stack:** Expo 57, React Native, expo-router, React Compiler, expo-secure-store, react-native-maps, vitest (edge-runtime).

**Spec:** `docs/superpowers/specs/2026-10-23-tema-claro-design.md`

## Global Constraints

- Paleta oscura: valores idénticos a los actuales de `src/constants/theme.ts` (`canvas #0B0B0C`, `surface #17181B`, `raised #1F2024`, `border #2A2C30`, `text #F2F3F5`, `textSecondary #8A8F98`, `textDisabled #4A4E55`, `accent #E2FF3B`, `onAccent #0B0B0C`, `success #3DDC84`, `warning #FFB020`, `error #FF4D4F`) y `accentText #E2FF3B`.
- Paleta clara "Papel": `canvas #F6F5F0`, `surface #FFFFFF`, `raised #EEEDE7`, `border #E1DFD7`, `text #121212`, `textSecondary #5E6168`, `textDisabled #A3A6AC`, `accent #E2FF3B`, `onAccent #0B0B0C`, `accentText #4F5E00`, `success #16794A`, `warning #9A5B00`, `error #C8282B`.
- `accent` sólo como relleno con `onAccent` encima; texto/ícono/borde/punto/barra del wordmark usan `accentText`; `tone="accent"` usa `accentText`.
- Destacado del Inicio y vista previa de publicar: tarjeta oscura en ambos temas (Fade y texto con la paleta oscura). Portada del detalle: Fade hacia `canvas` del tema activo; texto superpuesto con tokens del tema; botones circulares de arriba con estilo overlay oscuro. Etiquetas sobre la foto: estilo oscuro/lima en ambos temas.
- Preferencia `'system' | 'light' | 'dark'`, por defecto `'system'`, guardada en el dispositivo con `expo-secure-store` (sin dependencias nuevas).
- `app.json`: `userInterfaceStyle: "automatic"`. Splash e ícono sin cambios. Web (`*.web.tsx`, `stylized-map.tsx`) fuera de alcance: sólo tiene que compilar.
- Sin commits: el usuario decide cuándo commitear.

## Review Focus

1. Preferencia "Sistema" y el usuario cambia el modo del teléfono con la app abierta → la app cambia sin reiniciar (Task 2: `useColorScheme` como fuente, verificado con `adb shell cmd uimode night yes/no`).
2. Arranque con preferencia "Oscuro" en un teléfono claro → no debe verse un destello claro antes de cargar la preferencia (Task 2: el splash se oculta recién cuando la preferencia terminó de leerse).
3. `SecureStore` falla al leer o escribir → la app sigue con "Sistema" y no se rompe (Task 2: try/catch con fallback, test de `parsePreference`).
4. Modales (`dialog.tsx`, `option-picker.tsx`) abiertos o abiertos después de cambiar el tema → toman la paleta nueva (Task 3: usan `makeStyles`, verificación en emulador).
5. Algún uso de lima como texto/ícono que quede sobre fondo claro → auditoría con grep al final (Task 6).

---

### Task 1: Paletas y resolución del tema (lógica pura)

**Files:**
- Create: `src/theme/palettes.ts`
- Test: `src/theme/palettes.test.ts`

**Interfaces:**
- Produces: `type Palette = Record<'canvas'|'surface'|'raised'|'border'|'text'|'textSecondary'|'textDisabled'|'accent'|'onAccent'|'accentText'|'success'|'warning'|'error', string>`; `darkPalette: Palette`; `lightPalette: Palette`; `type ThemePreference = 'system' | 'light' | 'dark'`; `type Scheme = 'light' | 'dark'`; `resolveScheme(pref: ThemePreference, system: Scheme | null | undefined): Scheme` (system null → `'dark'`); `parsePreference(raw: string | null | undefined): ThemePreference` (desconocido → `'system'`); `contrastRatio(a: string, b: string): number` (WCAG, hex `#RRGGBB`); `THEME_PREFERENCES: ThemePreference[]` = `['system','light','dark']`; `themePreferenceLabel(p): string` = `Sistema`/`Claro`/`Oscuro`.
- Sin imports de React Native (corre en vitest edge-runtime).

- [ ] **Step 1: Tests que fallan** en `src/theme/palettes.test.ts`:
  - `darkPalette` es igual a los valores de Global Constraints (oscuro) — `toEqual` con el objeto literal.
  - `lightPalette` es igual a los valores "Papel".
  - Contraste en claro ≥ 4.5 para `text`, `textSecondary`, `accentText`, `success`, `warning`, `error` sobre `canvas` y sobre `surface`; `onAccent` sobre `accent` ≥ 4.5 en ambas paletas.
  - `contrastRatio('#E2FF3B', '#FFFFFF')` < 1.2 (documenta por qué existe `accentText`).
  - `resolveScheme`: `('system','light')→'light'`, `('system',null)→'dark'`, `('light','dark')→'light'`, `('dark','light')→'dark'`.
  - `parsePreference`: `'light'→'light'`, `null→'system'`, `'banana'→'system'`.
- [ ] **Step 2:** `npx vitest run src/theme` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar `src/theme/palettes.ts`.
- [ ] **Step 4:** `npx vitest run src/theme` → PASS.

### Task 2: ThemeProvider, `useTheme`, `makeStyles` y raíz de la app

**Files:**
- Create: `src/theme/index.tsx`
- Modify: `src/app/_layout.tsx`, `app.json`

**Interfaces:**
- Consumes: Task 1.
- Produces (desde `@/theme`): `ThemeProvider({ children })`; `useTheme(): { colors: Palette; scheme: Scheme; preference: ThemePreference; setPreference(p: ThemePreference): void; ready: boolean }`; `makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: Palette) => T): () => T` (cachea un `StyleSheet.create` por paleta; el hook devuelto llama `useTheme()`); re-exporta `darkPalette`, `type Palette`, `type ThemePreference`, `THEME_PREFERENCES`, `themePreferenceLabel`.
- Clave de SecureStore: `gridd.themePreference`.

- [ ] **Step 1:** Implementar `src/theme/index.tsx`: esquema del sistema con `useColorScheme()` de react-native; preferencia leída una vez de SecureStore con `parsePreference` (try/catch → `'system'`), `ready` en `true` al terminar; `setPreference` actualiza estado y guarda con try/catch (error sólo en `__DEV__` por consola).
- [ ] **Step 2:** `_layout.tsx`: envolver con `ThemeProvider`; mover `Stack`/nav theme/`StatusBar` a un componente hijo que use `useTheme()`: nav theme = `DarkTheme` o `DefaultTheme` con `primary: accentText`, `background/card: canvas`, `text`, `border`; `StatusBar style={scheme === 'dark' ? 'light' : 'dark'}`; `SplashScreen.hideAsync()` sólo cuando fuentes cargadas **y** `ready`.
- [ ] **Step 3:** `app.json`: `"userInterfaceStyle": "automatic"`.
- [ ] **Step 4:** `npx tsc --noEmit -p .` → sin errores (`Colors` sigue existiendo hasta la Task 6).

### Task 3: Componentes compartidos

**Files:** `src/components/{text,ui,icon,dialog,tab-bar,event-card,radius-options,option-picker,date-time-field,account-cards,attendees-preview}.tsx`

**Interfaces:**
- Consumes: `useTheme`, `makeStyles`, `darkPalette`.
- Produces: `Fade({ style, opacity = 1, tint = 'theme' }: { …; tint?: 'theme' | 'dark' })` — `'dark'` difumina hacia `darkPalette.canvas`. `Tag` gana `overlay?: boolean` (estilo oscuro fijo para etiquetas sobre fotos). `IconButton` con `overlay` usa siempre estilo oscuro. `Text` `tone="accent"` → `accentText`.

- [ ] **Step 1:** Migrar cada archivo: `StyleSheet.create` de módulo → `const useStyles = makeStyles((c) => ({ … }))` + `const styles = useStyles()` dentro del componente; colores inline → `const { colors: c } = useTheme()`.
- [ ] **Step 2:** Clasificar cada `accent`: relleno con `onAccent` encima → `c.accent`; texto/ícono/borde/punto/`wordmarkBar`/check de selección → `c.accentText`. `GridTile` en `event-card.tsx`: etiqueta de día con `Tag overlay`.
- [ ] **Step 3:** `npx tsc --noEmit -p .` y `npx eslint src/components` → sin errores nuevos.

### Task 4: Pantallas

**Files:** todos los archivos de `src/app/` que importan `Colors` (19).

- [ ] **Step 1:** Misma migración que la Task 3 en cada pantalla.
- [ ] **Step 2:** Excepciones de fotos: `(tabs)/index.tsx` destacado → `Fade tint="dark"`, textos del `heroBody` con colores de `darkPalette`, etiqueta superior `Tag` como hoy (lima). `publish.tsx` vista previa → igual. `event/[id].tsx` → `Fade` con `tint` por defecto (tema), botones de arriba `IconButton overlay`. `login.tsx`: su fondo es foto a pantalla completa → `Fade tint="dark"` y texto con `darkPalette`.
- [ ] **Step 3:** `npx tsc --noEmit -p .` → sin errores.

### Task 5: Mapa en claro

**Files:**
- Modify: `src/constants/map-style.ts` (agregar `lightMapStyle`), `src/components/event-map.tsx`
- Create: `assets/brand/gridd-pin-map-small-light.png`, `assets/brand/gridd-pin-map-large-light.png`

- [ ] **Step 1:** Generar los pines claros desde los actuales con ImageMagick: contorno `#121212` de 2 px (dilatar el canal alfa y componer debajo), mismo tamaño de lienzo + 4 px.
- [ ] **Step 2:** `lightMapStyle`: fondo `#F6F5F0`, agua `#DCE3E6`, calles `#FFFFFF` con borde `#E1DFD7`, etiquetas `#5E6168`, POIs ocultos como en `darkMapStyle`.
- [ ] **Step 3:** `event-map.tsx`: `customMapStyle` y `userInterfaceStyle` según `scheme`; pines según `scheme`.
- [ ] **Step 4:** `npx tsc --noEmit -p .` → sin errores.

### Task 6: Selector en Cuenta, retiro de `Colors` y verificación

**Files:**
- Create: `src/components/theme-options.tsx`
- Modify: `src/app/account-details.tsx`, `src/constants/theme.ts`

**Interfaces:**
- Produces: `ThemeOptions({ value, onSelect, optionStyle }: { value: ThemePreference; onSelect(p: ThemePreference): void; optionStyle?: StyleProp<ViewStyle> })`, mismo patrón visual que `RadiusOptions`.

- [ ] **Step 1:** `account-details.tsx`: sección "Preferencias" (arriba de "Seguridad") con fila "Apariencia" (ícono existente adecuado, valor = `themePreferenceLabel(preference)`), que despliega `ThemeOptions`. No reactivar Intereses ni Ubicación.
- [ ] **Step 2:** Quitar `Colors` de `src/constants/theme.ts`. `grep -rn "Colors\b" src` → sin resultados; `npx tsc --noEmit -p .` → sin errores.
- [ ] **Step 3:** Auditoría de lima: `grep -rn "accent\b" src` y revisar que cada uso restante sea relleno con `onAccent` encima o esté sobre foto.
- [ ] **Step 4:** `npx vitest run` → todo pasa. `npx eslint src` → sin errores nuevos.
- [ ] **Step 5:** Emulador (dev build nuevo por el cambio de `app.json`): capturas en claro y oscuro de Inicio, detalle, mapa, Guardados, Perfil, Cuenta, publicar, login, diálogo. Oscuro idéntico a antes; en claro ningún lima como texto. Cambiar `adb shell cmd uimode night yes|no` con preferencia "Sistema" y ver que cambia en vivo; elegir "Oscuro", reiniciar la app y ver que arranca oscura sin destello.
