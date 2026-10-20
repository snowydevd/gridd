import type { TemplateInput, TemplateName } from "./index";

// Datos de ejemplo para el preview y los tests. No se publican.
export const SAMPLES = {
  headline: {
    template: "headline",
    data: {
      headline: "Todos los *car meets* de Uruguay en un solo lugar",
      subline: "Junadas, rodadas, cars & coffee y más. Encontralos cerca tuyo.",
    },
  },
  feature: {
    template: "feature",
    data: {
      kicker: "Organizadores",
      title: "Publicá tu *meet* en minutos",
      bullets: ["Cargás lugar, fecha y foto", "Ves cuánta gente va", "Lo encuentran los fierreros de la zona"],
      screenshot: "placeholder",
    },
  },
  carousel: {
    template: "carousel",
    data: {
      cover: { title: "Cómo encontrar tu próximo *meet*", subtitle: "En tres pasos, desde el celu." },
      slides: [
        { title: "Descargá *Gridd*", body: "Entrá con tu cuenta y elegí qué tipo de meets te gustan." },
        { title: "Mirá qué hay *cerca*", body: "Junadas, rodadas y exposiciones ordenadas por distancia y fecha." },
        { title: "Avisá que *vas*", body: "Guardalo y caé con la nave lista." },
      ],
      cta: { title: "Nos vemos en la *próxima*", subtitle: "Bajate Gridd y no te pierdas ninguna." },
    },
  },
} satisfies { [K in TemplateName]: Extract<TemplateInput, { template: K }> };
