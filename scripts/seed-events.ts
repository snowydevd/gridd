/**
 * Carga en el deployment de desarrollo de Convex los eventos de ejemplo de la app, con sus fotos, y
 * gente de prueba (sin foto, con un auto) anotada a esos eventos.
 *
 *   bun scripts/seed-events.ts          # siembra (no duplica: saltea lo que ya existe)
 *   bun scripts/seed-events.ts --clear  # borra todo lo sembrado (eventos, fotos, organizadores y gente)
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
  organizerName: string;
  /** Foto de assets/images/meets; sin foto, el evento usa la portada de default. */
  image?: string;
};

// Eventos de ejemplo, con los `kind` del backend.
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
    organizerName: "Drift Uruguay",
    image: "gtr-neon.jpg",
  },
  {
    slug: "cars-and-coffee-punta",
    title: "Cars & Coffee Punta del Este",
    description: "Café y autos frente a la Brava, temprano y sin apuro. Deportivos, clásicos y lo que traigas.",
    kind: "cars_and_coffee",
    day: 1,
    start: "09:00",
    end: "12:00",
    placeName: "Parada 5 de la Brava, Punta del Este",
    lat: -34.9425,
    lon: -54.9295,
    organizerName: "Punta Cars & Coffee",
    image: "login.jpg",
  },
  {
    slug: "rodada-colonia",
    title: "Rodada a Colonia",
    description: "Salimos de Montevideo por la Ruta 1 y almorzamos en el Real de San Carlos. Ritmo tranquilo, todos los autos son bienvenidos.",
    kind: "rodada",
    day: 6,
    start: "08:30",
    end: "17:00",
    placeName: "Plaza de Toros, Real de San Carlos, Colonia",
    lat: -34.444,
    lon: -57.824,
    organizerName: "Rodadas del Litoral",
  },
  {
    slug: "4x4-laguna-de-rocha",
    title: "Travesía 4x4 Laguna de Rocha",
    description: "Recorrido por médanos y caminos de la laguna. Se pide tracción 4x4, eslinga y ganas de embarrarse.",
    kind: "4x4",
    day: 8,
    start: "10:00",
    end: "18:00",
    placeName: "Laguna de Rocha, La Paloma",
    lat: -34.642,
    lon: -54.169,
    organizerName: "4x4 Este",
  },
  {
    slug: "motos-atlantida",
    title: "Motos en la Rambla de Atlántida",
    description: "Encuentro de motos de todas las cilindradas. Customs, café racers y deportivas frente al mar.",
    kind: "motos",
    day: 13,
    start: "15:00",
    end: "20:00",
    placeName: "Rambla de Atlántida, Canelones",
    lat: -34.772,
    lon: -55.759,
    organizerName: "Motoqueros de la Costa",
    image: "midnight-rambla.jpg",
  },
  {
    slug: "jdm-salto-costanera",
    title: "JDM en la Costanera de Salto",
    description: "Primera junada JDM del litoral norte. Proyectos japoneses, música y food trucks sobre el río Uruguay.",
    kind: "jdm",
    day: 19,
    start: "20:00",
    end: "00:30",
    placeName: "Costanera Norte, Salto",
    lat: -31.38,
    lon: -57.975,
    organizerName: "Garage 20B",
    image: "gtr-neon.jpg",
  },
];

type Person = { name: string; car?: { make: string; model: string; year: number } };

// Gente de prueba. Sin foto (la app usa la de default); los autos son del catálogo (convex/lib/vehicleCatalog.ts).
const PEOPLE: Person[] = [
  { name: "Martín Pereira", car: { make: "Subaru", model: "Impreza WRX / WRX", year: 2008 } },
  { name: "Sofía Rodríguez", car: { make: "Mazda", model: "MX-5", year: 1999 } },
  { name: "Nicolás Fernández", car: { make: "Nissan", model: "Skyline", year: 1998 } },
  { name: "Valentina López", car: { make: "Volkswagen", model: "Golf", year: 2016 } },
  { name: "Federico Silva", car: { make: "Toyota", model: "Supra", year: 1995 } },
  { name: "Camila González", car: { make: "Honda", model: "Civic", year: 2019 } },
  { name: "Joaquín Martínez", car: { make: "Chevrolet", model: "Camaro", year: 1969 } },
  { name: "Lucía Sosa", car: { make: "Fiat", model: "147", year: 1984 } },
  { name: "Santiago Núñez", car: { make: "Mitsubishi", model: "Lancer Evolution", year: 2005 } },
  { name: "Agustina Romero", car: { make: "Peugeot", model: "206", year: 2007 } },
  { name: "Diego Cabrera", car: { make: "Ford", model: "Mustang", year: 2018 } },
  { name: "Florencia Díaz", car: { make: "Renault", model: "Clio", year: 2012 } },
  { name: "Matías Acosta", car: { make: "Nissan", model: "Silvia", year: 1997 } },
  { name: "Carolina Ramírez", car: { make: "BMW", model: "Serie 3", year: 2011 } },
  { name: "Gonzalo Méndez", car: { make: "Ford", model: "Falcon", year: 1978 } },
  { name: "Micaela Torres", car: { make: "Audi", model: "A3", year: 2015 } },
  { name: "Bruno Castro", car: { make: "Mazda", model: "RX-7", year: 1993 } },
  { name: "Paula Suárez", car: { make: "Volkswagen", model: "Gol", year: 2010 } },
  { name: "Emiliano Vázquez", car: { make: "Nissan", model: "350Z", year: 2006 } },
  { name: "Rocío Benítez", car: { make: "Chevrolet", model: "Chevette", year: 1987 } },
  { name: "Tomás Olivera", car: { make: "BMW", model: "M3", year: 2002 } },
  { name: "Julieta Morales", car: { make: "Toyota", model: "Corolla", year: 2020 } },
  { name: "Facundo Giménez", car: { make: "Renault", model: "12", year: 1980 } },
  { name: "Lorena Ferreira", car: { make: "Ford", model: "Ranger", year: 2021 } },
  { name: "Andrés Correa", car: { make: "Peugeot", model: "504", year: 1979 } },
  { name: "Mariana Pintos", car: { make: "Volkswagen", model: "Amarok", year: 2017 } },
  { name: "Pablo Rivero" },
  { name: "Natalia Cardozo" },
];

/** Quiénes van a cada evento: un tramo distinto del plantel por evento, siempre el mismo. */
function attendancesFor(events: SeedEvent[]) {
  return events.map((event, i) => {
    const going = Math.min(PEOPLE.length, 6 + ((i * 7) % 17));
    const names = Array.from({ length: going }, (_, k) => PEOPLE[(i * 5 + k) % PEOPLE.length].name);
    return { slug: event.slug, names };
  });
}

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

  // Van todos: los nuevos se crean y los que ya estaban se actualizan con fechas a partir de hoy.
  // Las fotos se suben sólo para los nuevos.
  const events = [];
  for (const { day, start, end, image, ...event } of EVENTS) {
    const startsAt = at(day, start);
    let imageId: string | undefined;
    if (image && !existing.has(event.slug)) {
      console.log(`Subiendo foto de "${event.title}"…`);
      imageId = await upload(image);
    }
    // El contador arranca en 0: lo pone insertPeople según las anotaciones reales.
    events.push({ ...event, attendeeCount: 0, startsAt, endsAt: at(day, end, startsAt), imageId });
  }
  const result = convexRun<{ inserted: number; updated: number; skipped: number }>("seed:insertEvents", { events });
  console.log(
    `Eventos: ${result.inserted} nuevos, ${result.updated} con fechas actualizadas` +
      (result.skipped ? `, ${result.skipped} salteados (el slug es de un evento real)` : "") +
      ".",
  );

  // También corre con eventos ya sembrados: completa anotaciones y corrige contadores viejos.
  const people = convexRun<{ people: number; attendances: number }>("seed:insertPeople", {
    people: PEOPLE,
    attendances: attendancesFor(EVENTS),
  });
  console.log(`Gente: ${people.people} nuevos, ${people.attendances} anotaciones nuevas.`);
}

function clear() {
  const organizerNames = [...new Set(EVENTS.map((e) => e.organizerName))];
  const result = convexRun<{ events: number; organizers: number; people: number }>("seed:clear", {
    organizerNames,
    personNames: PEOPLE.map((p) => p.name),
  });
  console.log(
    `Borrados ${result.events} eventos, ${result.organizers} organizadores y ${result.people} personas de prueba.`,
  );
}

if (process.argv.includes("--clear")) clear();
else await seed();
