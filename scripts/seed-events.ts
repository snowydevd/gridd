/**
 * Carga en el deployment de desarrollo de Convex los eventos de ejemplo de la app, con sus fotos.
 *
 *   bun scripts/seed-events.ts          # siembra (no duplica: saltea los slugs que ya existen)
 *   bun scripts/seed-events.ts --clear  # borra todo lo sembrado (eventos, fotos y organizadores de prueba)
 *
 * Las fechas son relativas al momento de correrlo, así siempre hay eventos próximos.
 * Requiere que las funciones de `convex/seed.ts` estén subidas (`bun run convex` corriendo, o `bunx convex dev --once`).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Kind = "junada" | "rodada" | "cars_and_coffee" | "expo" | "clasicos" | "jdm" | "tuning" | "4x4" | "motos" | "pista" | "otro";

type SeedEvent = {
  slug: string;
  title: string;
  description: string;
  kind: Kind;
  /** Días desde hoy (negativo = ya pasó) y hora local de inicio/fin. Si el fin es menor que el inicio, termina al día siguiente. */
  day: number;
  start: string;
  end: string;
  placeName: string;
  lat: number;
  lon: number;
  attendeeCount: number;
  organizerName: string;
  image: string;
};

// Los mismos eventos de src/data/events.ts, con los `kind` del backend.
const EVENTS: SeedEvent[] = [
  {
    slug: "jdm-night-garage",
    title: "JDM Night Garage",
    description: "Juntada tranqui de proyectos japoneses en un estacionamiento techado. Traé tu auto o vení a mirar.",
    kind: "jdm",
    day: 0,
    start: "20:30",
    end: "23:30",
    placeName: "Estacionamiento Carrasco, Carrasco Norte",
    lat: -34.8705,
    lon: -56.0505,
    attendeeCount: 48,
    organizerName: "Garage 20B",
    image: "jdm-garage.jpg",
  },
  {
    slug: "midnight-meet-mvd",
    title: "Midnight Meet MVD",
    description:
      "La clásica edición nocturna en la Rambla. Proyectos JDM, euro, stance y clásicos bajo las luces de Kibón. Entrada libre.",
    kind: "junada",
    day: 3,
    start: "21:00",
    end: "02:00",
    placeName: "Explanada de Kibón, Pocitos",
    lat: -34.9126,
    lon: -56.1408,
    attendeeCount: 142,
    organizerName: "Montevideo Midnight Club",
    image: "midnight-rambla.jpg",
  },
  {
    slug: "clasicos-en-la-rambla",
    title: "Clásicos en la Rambla",
    description: "Tarde de clásicos frente al río. Muscle, vintage y nacionales restaurados. Ideal para ir en familia.",
    kind: "clasicos",
    day: 4,
    start: "16:00",
    end: "20:00",
    placeName: "Plaza Virgilio, Punta Gorda",
    lat: -34.9083,
    lon: -56.0846,
    attendeeCount: 76,
    organizerName: "Club Clásicos UY",
    image: "clasicos-rambla.jpg",
  },
  {
    slug: "drift-pista-el-pinar",
    title: "Drift & Pista El Pinar",
    description: "Tanda libre de drift en circuito cerrado. Entrada para pilotos y público general.",
    kind: "pista",
    day: 10,
    start: "14:00",
    end: "19:00",
    placeName: "Autódromo Víctor Borrat Fabini, El Pinar",
    lat: -34.7959,
    lon: -55.9172,
    attendeeCount: 210,
    organizerName: "Drift Uruguay",
    image: "drift-pinar.jpg",
  },
  {
    slug: "expo-fierros-del-sur",
    title: "Expo Fierros del Sur",
    description: "La exposición anual más grande del sur. Más de 300 autos, food trucks y música.",
    kind: "expo",
    day: 16,
    start: "10:00",
    end: "20:00",
    placeName: "Parque Roosevelt, Canelones",
    lat: -34.8617,
    lon: -56.0182,
    attendeeCount: 530,
    organizerName: "Fierros del Sur",
    image: "expo-fierros.jpg",
  },
  {
    slug: "euro-meet-dyno",
    title: "Euro Meet & Dyno",
    description: "Noche europea con banco de potencia abierto. Inscripción previa para medir.",
    kind: "tuning",
    day: 23,
    start: "19:00",
    end: "23:00",
    placeName: "Zona Franca MVD, Montevideo",
    lat: -34.8358,
    lon: -56.038,
    attendeeCount: 95,
    organizerName: "Euro Club MVD",
    image: "euro-meet.jpg",
  },
  {
    slug: "trackday-el-pinar",
    title: "Trackday El Pinar",
    description: "Jornada de pista abierta.",
    kind: "pista",
    day: -4,
    start: "13:00",
    end: "18:00",
    placeName: "Autódromo de El Pinar, Canelones",
    lat: -34.7959,
    lon: -55.9172,
    attendeeCount: 180,
    organizerName: "Drift Uruguay",
    image: "gtr-neon.jpg",
  },
];

const IMAGES_DIR = join(import.meta.dirname, "..", "assets", "images", "meets");

/** Corre una función de Convex con la CLI (las `internal` sólo se pueden llamar así) y devuelve el resultado. */
function convexRun<T>(fn: string, args: unknown = {}): T {
  const out = execFileSync("bunx", ["convex", "run", fn, JSON.stringify(args)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  // Imprime el resultado como JSON (los objetos, en varias líneas); se saltean avisos previos si los hay.
  const start = out.search(/^[[{"\d-]|^null|^true|^false/m);
  return JSON.parse(start === -1 ? "null" : out.slice(start)) as T;
}

function at(day: number, time: string, after?: number) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + day);
  d.setHours(h, m, 0, 0);
  // Fin "02:00" de un evento que empieza 21:00: es al día siguiente.
  if (after !== undefined && d.getTime() <= after) d.setDate(d.getDate() + 1);
  return d.getTime();
}

async function upload(file: string) {
  const url = convexRun<string>("seed:generateUploadUrl");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: readFileSync(join(IMAGES_DIR, file)),
  });
  if (!res.ok) throw new Error(`No se pudo subir ${file}: ${res.status}`);
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}

async function seed() {
  const existing = new Set(convexRun<string[]>("seed:existingSlugs", { slugs: EVENTS.map((e) => e.slug) }));
  const pending = EVENTS.filter((e) => !existing.has(e.slug));
  if (pending.length === 0) {
    console.log("Ya estaban todos los eventos sembrados. Para empezar de cero: bun scripts/seed-events.ts --clear");
    return;
  }

  const events = [];
  for (const { day, start, end, image, ...event } of pending) {
    console.log(`Subiendo foto de "${event.title}"…`);
    const startsAt = at(day, start);
    events.push({ ...event, startsAt, endsAt: at(day, end, startsAt), imageId: await upload(image) });
  }
  const result = convexRun<{ inserted: number; skipped: number }>("seed:insertEvents", { events });
  console.log(`Listo: ${result.inserted} eventos nuevos, ${existing.size + result.skipped} ya existían.`);
}

function clear() {
  const organizerNames = [...new Set(EVENTS.map((e) => e.organizerName))];
  const result = convexRun<{ events: number; organizers: number }>("seed:clear", { organizerNames });
  console.log(`Borrados ${result.events} eventos y ${result.organizers} organizadores de prueba.`);
}

if (process.argv.includes("--clear")) clear();
else await seed();
