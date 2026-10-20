# Nuevo Inicio — diseño

Fecha: 2026-10-19
Estado: borrador para aprobar

## Intención

Inicio es lo primero que ve alguien al abrir Gridd. Su trabajo principal es responder **"¿a qué meet puedo ir pronto que me interese?"**. En segundo plano, tiene que invitar al usuario a completar su cuenta (foto, auto, intereses, primer meet) de una forma cómoda y atractiva, al estilo de Instagram cuando todavía no tenés foto o publicaciones, **sin que la pantalla quede sobrecargada**.

## Objetivos

- Mostrar primero los eventos próximos que matcheen los intereses del usuario.
- Sumar una sección de tarjetas deslizables "Completá tu cuenta" que se vaya vaciando a medida que el usuario completa cosas.
- Sumar una cápsula de perfil en el header, al lado de la cápsula de radio.
- Permitir que el usuario suba su foto de perfil (hoy no se puede).
- Agregar una versión simple de "intereses" basada en las categorías de evento existentes.

## No-objetivos

- **Fotos de encuentros pasados.** Es un proyecto aparte con su propio diseño. Lo único que hace este proyecto es no bloquearlo: Inicio queda ordenado de forma que la grilla "De encuentros pasados" pueda ir al final. No se crea ninguna tabla ni ningún componente de fotos.
- Moderación de imágenes (en el futuro se va a hacer con jev).
- Preferencias completas (marcas, zonas, horarios, etc.). Los intereses de este proyecto son solo las categorías.
- Animaciones o festejos al completar tarjetas.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que Inicio se sienta más cargado que hoy. Si al terminar un usuario nuevo ve más bloques que ahora, algo salió mal.
- Que las tarjetas de "Completá tu cuenta" queden visibles para siempre o insistan después de completarlas.
- Que se muestren secciones vacías (encabezados sin contenido).

## Estructura de la pantalla (decidido con el usuario: opción "B")

De arriba hacia abajo:

1. **Header.** A la izquierda el `Wordmark`; a la derecha la cápsula de radio (`RadiusPill`, igual que hoy) y la **cápsula de perfil**.
2. **Evento destacado.** El hero actual, sin cambios. También se mantiene el estado vacío actual.
3. **"Para vos".** Lista corta de eventos próximos (ver reglas abajo) con "Ver todo".
4. **"Completá tu cuenta".** Carrusel horizontal de tarjetas, con progreso "n/4" en el encabezado.
5. *(Futuro, fuera de alcance)* "De encuentros pasados".

**Se sacan** de Inicio los chips de categoría y el carrusel "Más adelante". Se reemplazan por los intereses y por "Ver todo". *(Decisión mía, comentada con el usuario: es lo que evita la sobrecarga.)*

### Cápsula de perfil

- Es un círculo con la foto del usuario y va a la derecha de la cápsula de radio, con el mismo alto (36px).
- Si el usuario no tiene foto, se muestran sus iniciales (o un ícono de persona si no hay nombre), con un borde punteado del color de acento (`Colors.accent`).
- Al tocarla lleva a la pestaña Perfil; si no hay sesión iniciada, lleva a `/login`.

### "Para vos"

- Trabaja sobre los próximos ~20 eventos que ya trae Inicio (`HOME_EVENTS`). El orden se calcula en el dispositivo, sin queries nuevas en Convex.
- Si se conoce la ubicación, filtra por el radio del usuario (`withinRadius`).
- Si el usuario tiene intereses, los eventos de sus categorías van primero. Dentro de cada grupo se ordenan por fecha (`startsAt`). Sin intereses, se ordenan solo por fecha.
- Muestra hasta 5 filas con `EventRow` y excluye el evento destacado.
- Si no hay eventos para la lista, la sección no se muestra.

### "Ver todo" (decidido con el usuario: versión simple)

- Es una pantalla nueva (`src/app/events/index.tsx` o similar) a la que se llega desde la acción de `SectionHeader` en "Para vos".
- Muestra la lista completa de próximos eventos **por fecha**, paginada con `useUpcomingEvents`.
- Si se conoce la ubicación, filtra por radio.
- Arriba tiene los chips de categoría ("Todos" + `KIND_LABELS`). Son los que se sacan de Inicio y filtran con el parámetro `kind` que ya acepta `listUpcoming`.
- Esta lista **no** pone los intereses primero. Eso pasa solo en las 5 filas de Inicio.
- Como el filtro por radio se hace en el dispositivo, una página puede quedar con pocas filas o ninguna. En ese caso se pide la página siguiente automáticamente mientras el backend tenga más eventos.

### "Completá tu cuenta"

Hay 4 tarjetas, en este orden:

| # | Tarjeta | Completa si… | Botón |
|---|---|---|---|
| 1 | Foto de perfil | el usuario tiene foto | "Subir": abre la galería, sube la foto y la guarda |
| 2 | Tus intereses | el usuario eligió al menos 1 categoría | "Elegir": abre la pantalla de intereses |
| 3 | Tu primer auto | tiene al menos 1 auto (`cars.listMine`) | "Agregar": lleva al flujo de alta en `/garage` |
| 4 | Tu primer meet | se anotó a algún evento, pasado o futuro, incluso uno cancelado (`attendance.myEvents` no vacío). Organizar un evento no cuenta. | "Ver meets": lleva a "Ver todo" |

- Cada tarjeta tiene un ícono, un título, una línea de texto y un botón de acento (ver el mockup B).
- Las tarjetas completas **no se muestran**. Cuando están todas completas, la sección entera desaparece.
- El encabezado muestra el progreso, por ejemplo "Completá tu cuenta · 1/4".
- **Sin sesión:** en lugar de las 4 tarjetas aparece una sola, "Creá tu cuenta", que lleva a `/login`.
- Mientras cargan los datos del usuario, la sección no se muestra (no hay skeleton) para que no aparezca y desaparezca.

## Backend (Convex)

- **Intereses.** Se agrega a `users` el campo `interests: v.optional(v.array(eventKind))`. Hacen falta una mutation `users.setInterests({ interests })` que valide contra `eventKind` y elimine duplicados, y que `users.me` devuelva `interests` (`[]` si no tiene).
- **Foto de perfil.**
  - Se crea una mutation de URL de subida para **cualquier usuario logueado**. La actual `files.generateUploadUrl` exige el rol publisher y no se toca.
  - Se crea una mutation `users.setAvatar({ storageId })` que guarde la imagen.
  - *Decisión mía:* se agrega `imageId: v.optional(v.id("_storage"))` y `users.me` resuelve la URL con `ctx.storage.getUrl`. Si no hay `imageId`, `users.me` usa `image`, que es lo que llega del login con OAuth. Si el usuario ya tenía un avatar subido, el archivo viejo se borra del storage.
- Tests nuevos en el estilo de los existentes (`convex/*.test.ts`): para `setInterests`, para `setAvatar` (incluido el caso sin sesión) y para la URL de subida sin sesión.

## App

- **Dependencia nueva:** `expo-image-picker`. Requiere un dev build nuevo, porque es un módulo nativo.
- **Pantalla de intereses** (`src/app/interests.tsx` o similar): una grilla de `Chip` con `KIND_LABELS` (sin "Otro") y un botón "Guardar". Se llega desde la tarjeta. *Decisión mía:* el Perfil puede tener también una fila de acceso a esta pantalla, pero es opcional.
- Para la tarjeta 4 se expone en `useUserMeets` un dato nuevo, por ejemplo `hasJoinedAny`. El `attended` actual no sirve porque solo cuenta eventos que ya pasaron.
- La foto de perfil se usa en la cápsula de Inicio y, si el Perfil ya muestra un avatar, también ahí.
- Se reusa lo que ya existe: `Chip`, `SectionHeader`, `Button`, `Card`, `EventRow`, los tokens de `constants/theme.ts`, `useCurrentUser`, `useMyCars` y `useUserMeets`.
- Todos los textos de la interfaz van en español rioplatense, como el resto de la app.

## Lo que queda a criterio de quien construye

- Los íconos exactos de cada tarjeta, dentro del set de `components/icon`.
- El ancho de las tarjetas del carrusel (alrededor de 140–160px) y el espaciado, respetando `Spacing`.
- El nombre exacto de las rutas nuevas.
- Si la foto se recorta o comprime antes de subirla: se recomienda un recorte cuadrado con `allowsEditing` y calidad de alrededor de 0.7.
