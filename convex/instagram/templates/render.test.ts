// @vitest-environment node
import jpeg from "jpeg-js";
import { describe, expect, test } from "vitest";
import { SAMPLES } from "./samples";
import { renderSlides, renderStory } from "./render";
import { STORY_HEIGHT, STORY_WIDTH, storyFromEvent } from "./story";
import { HEIGHT, WIDTH } from "./theme";
import { buildSlides, checkTemplateData } from "./index";

function decode(buf: Uint8Array) {
  return jpeg.decode(buf, { useTArray: true });
}

function pixel(img: ReturnType<typeof decode>, x: number, y: number) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

const near = (rgb: number[], hex: string, tol = 12) => {
  const target = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return rgb.every((c, i) => Math.abs(c - target[i]) <= tol);
};

/** ¿Hay algún pixel del color en la imagen? (muestreo cada 4 px) */
function contains(img: ReturnType<typeof decode>, hex: string) {
  for (let y = 0; y < img.height; y += 4) {
    for (let x = 0; x < img.width; x += 4) if (near(pixel(img, x, y), hex)) return true;
  }
  return false;
}

describe("render de plantillas", () => {
  test.each(["headline", "feature", "carousel"] as const)(
    "%s: JPEG 1080×1350 con fondo y acento de la marca",
    async (template) => {
      const slides = await renderSlides(SAMPLES[template]);
      expect(slides.length).toBe(template === "carousel" ? 2 + SAMPLES.carousel.data.slides.length : 1);
      for (const buf of slides) {
        // Firma JPEG (FF D8 FF).
        expect([...buf.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
        const img = decode(buf);
        expect([img.width, img.height]).toEqual([WIDTH, HEIGHT]);
        expect(near(pixel(img, 4, 4), "#0B0B0C")).toBe(true);
        expect(contains(img, "#DFFF00")).toBe(true);
      }
    },
    30_000,
  );
});

describe("checkTemplateData", () => {
  test("acepta los ejemplos", () => {
    for (const sample of Object.values(SAMPLES)) expect(() => checkTemplateData(sample)).not.toThrow();
  });

  test("rechaza cantidades fuera de rango y textos vacíos", () => {
    expect(() =>
      checkTemplateData({ template: "feature", data: { title: "X", bullets: ["uno"] } }),
    ).toThrow(/bullets/);
    expect(() =>
      checkTemplateData({
        template: "carousel",
        data: { cover: { title: "X" }, slides: [{ title: "a", body: "b" }], cta: { title: "c" } },
      }),
    ).toThrow(/slides/);
    expect(() => checkTemplateData({ template: "headline", data: { headline: "  " } })).toThrow(/headline/);
  });
});

describe("carrusel", () => {
  const texts = (el: unknown): string[] =>
    typeof el === "string"
      ? [el]
      : Array.isArray(el)
        ? el.flatMap(texts)
        : el && typeof el === "object" && "props" in el
          ? texts((el as { props: { children?: unknown } }).props.children)
          : [];

  test("no repite gridd.app si el subtítulo del cierre ya lo dice", () => {
    const slides = buildSlides({
      template: "carousel",
      data: { ...SAMPLES.carousel.data, cta: { title: "Bajate *Gridd*", subtitle: "gridd.app" } },
    });
    const last = texts(slides[slides.length - 1]);
    expect(last.filter((t) => t.toLowerCase().includes("gridd.app"))).toHaveLength(1);
  });

  test("los slides sólo llevan etiqueta si la piden", () => {
    const data = SAMPLES.carousel.data;
    const sinEtiqueta = buildSlides({ template: "carousel", data });
    expect(texts(sinEtiqueta[1]).join(" ")).not.toMatch(/Paso/);
    const conEtiqueta = buildSlides({
      template: "carousel",
      data: { ...data, slides: data.slides.map((s, i) => ({ ...s, kicker: `Paso ${i + 1}` })) },
    });
    expect(texts(conEtiqueta[1]).join(" ")).toMatch(/Paso 1/);
  });
});

describe("historia de evento", () => {
  const event = {
    slug: "junada-pocitos-2026-10-31",
    title: "Junada nocturna en Pocitos",
    kind: "jdm" as const,
    placeName: "Rambla de Pocitos",
    // Viernes 30/10/2026 23:30 en Uruguay (UTC−3) = sábado 31 02:30 UTC.
    startsAt: Date.UTC(2026, 9, 31, 2, 30),
    endsAt: Date.UTC(2026, 9, 31, 5, 30),
    noEndTime: false,
  };

  test("storyFromEvent formatea en hora de Uruguay y arma el link", () => {
    expect(storyFromEvent(event, null)).toEqual({
      kind: "JDM",
      title: "Junada nocturna en Pocitos",
      day: "Viernes 30 de octubre",
      hours: "23:30 – 02:30 hs",
      place: "Rambla de Pocitos",
      link: "gridd.app/e/junada-pocitos-2026-10-31",
      cover: null,
    });
    expect(storyFromEvent({ ...event, noEndTime: true }, null).hours).toBe("23:30 hs");
  });

  test.each([false, true])(
    "renderStory (con portada: %s): JPEG 1080×1920 con fondo y acento de la marca",
    async (withCover) => {
      // Portada de prueba: un JPEG chico gris.
      const cover = withCover
        ? `data:image/jpeg;base64,${Buffer.from(
            jpeg.encode({ data: new Uint8Array(64 * 40 * 4).fill(128), width: 64, height: 40 }, 80).data,
          ).toString("base64")}`
        : null;
      const buf = await renderStory(storyFromEvent(event, cover));
      expect([...buf.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
      const img = decode(buf);
      expect([img.width, img.height]).toEqual([STORY_WIDTH, STORY_HEIGHT]);
      expect(near(pixel(img, 4, STORY_HEIGHT - 4), "#0B0B0C")).toBe(true);
      expect(contains(img, "#DFFF00")).toBe(true);
    },
    30_000,
  );
});
