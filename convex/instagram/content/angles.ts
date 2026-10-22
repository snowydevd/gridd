import type { TemplateName } from "../templates/index";

// Única fuente de verdad para los posts generados. El LLM sólo puede afirmar lo que está acá:
// nada de features, cifras ni testimonios que no figuren en `facts`.
//
// Los hechos marcados "(app)" salieron del código de la app al 20/10/2026; revisalos igual.
// Un ángulo sin `facts` no se usa. Completá los TODO y borrá los que no apliquen.

export type Angle = {
  id: string;
  title: string;
  // Qué tiene que lograr el post.
  goal: string;
  templates: TemplateName[];
  facts: string[];
};

/** Hechos de marca que valen para todos los posts. */
export const BRAND_FACTS: string[] = [
  "Gridd es una app para encontrar car meets (encuentros de autos) en Uruguay.",
  "El sitio es gridd.app.",
  // TODO: ¿en qué tiendas está? (App Store / Google Play) y si es gratis.
  // TODO: si ya cubre otros países además de Uruguay.
];

export const ANGLES: Angle[] = [
  {
    id: "descubrir-meets",
    title: "Todos los tipos de meet en un lugar",
    goal: "Que la gente entienda qué es Gridd y la descargue.",
    templates: ["headline", "carousel"],
    facts: [
      "(app) En Gridd hay eventos de estas categorías: Encuentro, Rodada, Cars & Coffee, Exposición, Clásicos, JDM, Tuning, 4x4, Motos y Pista.",
      "(app) En Inicio se destaca el próximo evento y los de hoy llevan la etiqueta \"Hoy\".",
    ],
  },
  {
    id: "cerca-tuyo",
    title: "Meets cerca tuyo",
    goal: "Mostrar que podés ver qué hay cerca de donde estás.",
    templates: ["feature", "headline"],
    facts: [
      "(app) La sección \"Cerca tuyo\" filtra por distancia: 10, 25, 50, 100, 200 o 500 km, o todos.",
      "(app) La pestaña Mapa muestra los eventos en el mapa.",
      "(app) Cada evento tiene un botón \"Cómo llegar\" que abre el mapa del celular.",
    ],
  },
  {
    id: "para-vos",
    title: "Recomendaciones según lo que te gusta",
    goal: "Mostrar que Gridd prioriza los meets que te interesan.",
    templates: ["feature", "headline"],
    facts: [
      "(app) Elegís tus intereses entre las categorías de meets.",
      "(app) La sección \"Para vos\" de Inicio muestra primero las categorías que te gustan.",
    ],
  },
  {
    id: "guardar-compartir",
    title: "Guardá y compartí meets",
    goal: "Mostrar cómo no perderse un evento y armar la salida con amigos.",
    templates: ["feature", "carousel"],
    facts: [
      "(app) Podés guardar eventos y verlos en la pestaña Guardados.",
      "(app) Cada evento tiene un botón Compartir.",
      "(app) En cada evento ves cuánta gente va.",
    ],
  },
  {
    id: "garage",
    title: "Tu garage",
    goal: "Invitar a armar el perfil con sus autos.",
    templates: ["feature", "headline"],
    facts: [
      "(app) En tu perfil podés cargar tus autos: marca, modelo, versión, año y si está modificado.",
    ],
  },
  {
    id: "organizadores",
    title: "Para organizadores",
    goal: "Que los organizadores publiquen sus meets en Gridd.",
    templates: ["feature", "carousel"],
    facts: [
      "(app) Los organizadores publican un evento en pocos pasos: nombre, categoría, fecha y hora, lugar y portada, y lo revisan antes de publicar.",
      // TODO: cómo pide acceso un organizador (hoy no hay pantalla en la app para pedirlo).
    ],
  },
  {
    id: "comunidad",
    title: "Comunidad fierrera",
    goal: "Conectar con la cultura de los meets en Uruguay.",
    templates: ["headline"],
    // TODO: hechos verificados sobre la comunidad (meets reales que estén en Gridd, zonas, etc.).
    // Sin testimonios inventados: si hay testimonios, ponelos acá textuales y con permiso.
    facts: [],
  },
];
