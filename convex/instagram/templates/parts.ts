import { type Child, type El, div, h } from "./h";
import { C, CTA_DEFAULT, F, HEIGHT, PAD, SITE, WIDTH } from "./theme";
import { WORDMARK_PNG, WORDMARK_RATIO } from "./wordmark";

/** Lienzo 1080×1350 con el fondo de la marca y la grilla de largada de fondo. */
export function frame(...children: Child[]): El {
  return div(
    {
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: C.bg,
      flexDirection: "column",
      padding: PAD,
      boxSizing: "border-box",
      position: "relative",
      fontFamily: F.body,
      color: C.text,
    },
    startingGrid(),
    ...children,
  );
}

/** Grilla de largada escalonada en el margen derecho, fuera del área de contenido. */
function startingGrid(): El {
  const slot = (i: number) =>
    div({
      position: "absolute",
      top: i * 64,
      right: i % 2 === 0 ? 0 : 20,
      width: 36,
      height: 6,
      backgroundColor: C.border,
    });
  return div(
    { position: "absolute", top: 340, right: 14, width: 56, height: 64 * 10 },
    ...Array.from({ length: 10 }, (_, i) => slot(i)),
  );
}

export function wordmark(height = 56): El {
  return h("img", { src: WORDMARK_PNG, width: Math.round(height * WORDMARK_RATIO), height });
}

/** Texto grande; las palabras entre *asteriscos* van en el color de acento. */
export function richText(text: string, size: number, style: Record<string, string | number> = {}): El {
  const words: { word: string; accent: boolean }[] = [];
  for (const part of text.split(/(\*[^*]+\*)/)) {
    const accent = part.startsWith("*") && part.endsWith("*") && part.length > 2;
    const clean = accent ? part.slice(1, -1) : part;
    for (const word of clean.split(/\s+/).filter(Boolean)) words.push({ word, accent });
  }
  return div(
    {
      flexWrap: "wrap",
      columnGap: Math.round(size * 0.24),
      rowGap: Math.round(size * 0.02),
      fontFamily: F.display,
      fontWeight: 800,
      fontSize: size,
      lineHeight: 1.02,
      letterSpacing: -size * 0.02,
      ...style,
    },
    ...words.map(({ word, accent }) => h("span", { style: { color: accent ? C.accent : C.text } }, word)),
  );
}

/** Tamaño de título según el largo, para que entre sin cortar. */
export function fitSize(text: string, sizes: [max: number, chars: number][], min: number) {
  const len = text.replace(/\*/g, "").length;
  for (const [size, chars] of sizes) if (len <= chars) return size;
  return min;
}

export function kicker(text: string): El {
  return div(
    { alignItems: "center", gap: 16 },
    div({ width: 6, height: 34, backgroundColor: C.accent }),
    h(
      "span",
      {
        style: {
          fontFamily: F.body,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: 4,
          color: C.accent,
          textTransform: "uppercase",
        },
      },
      text,
    ),
  );
}

export function ctaPill(text = CTA_DEFAULT, size = 40): El {
  return div(
    {
      backgroundColor: C.accent,
      color: C.onAccent,
      fontFamily: F.display,
      fontWeight: 700,
      fontSize: size,
      padding: `${Math.round(size * 0.55)}px ${Math.round(size * 1.1)}px`,
      borderRadius: 999,
    },
    text,
  );
}

/** Pie con CTA a la izquierda y el sitio a la derecha. */
export function ctaFooter(cta?: string): El {
  return div(
    { justifyContent: "space-between", alignItems: "center", marginTop: "auto" },
    ctaPill(cta),
    h("span", { style: { fontSize: 32, fontWeight: 500, color: C.muted } }, SITE),
  );
}
