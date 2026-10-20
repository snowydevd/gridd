import { v } from "convex/values";
import { type El, div, h } from "./h";
import { ctaFooter, fitSize, frame, kicker, richText, wordmark } from "./parts";
import { C, F } from "./theme";

export const featureData = v.object({
  kicker: v.optional(v.string()),
  title: v.string(),
  // 2–3 bullets cortos.
  bullets: v.array(v.string()),
  // URL o data URL de un screenshot de la app; "placeholder" deja el hueco marcado.
  screenshot: v.optional(v.string()),
  cta: v.optional(v.string()),
});
export type FeatureData = typeof featureData.type;

const SHOT_W = 330;
const SHOT_H = 620;

function screenshotSlot(src: string): El {
  if (src === "placeholder") {
    return div(
      {
        width: SHOT_W,
        height: SHOT_H,
        border: `4px dashed ${C.accent}`,
        borderRadius: 36,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
        color: C.accent,
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: 30,
      },
      "PLACEHOLDER: screenshot de la app",
    );
  }
  return h("img", {
    src,
    width: SHOT_W,
    height: SHOT_H,
    style: { borderRadius: 36, border: `2px solid ${C.border}`, objectFit: "cover" },
  });
}

export function feature(data: FeatureData) {
  const withShot = Boolean(data.screenshot);
  const size = fitSize(data.title, withShot ? [[80, 22], [68, 40]] : [[96, 24], [80, 44]], 64);
  const bullets = div(
    { flexDirection: "column", gap: 28 },
    ...data.bullets.map((text) =>
      div(
        { gap: 22, alignItems: "flex-start" },
        div({ width: 18, height: 18, backgroundColor: C.accent, marginTop: 14, flexShrink: 0 }),
        h("span", { style: { fontSize: 38, fontWeight: 500, lineHeight: 1.3, color: C.text } }, text),
      ),
    ),
  );
  return [
    frame(
      wordmark(52),
      div(
        { flexDirection: "column", gap: 36, marginTop: 88 },
        kicker(data.kicker ?? "Gridd"),
        richText(data.title, size),
      ),
      div(
        { marginTop: 64, gap: 48, alignItems: "flex-start" },
        div({ flexDirection: "column", flex: 1 }, bullets),
        data.screenshot && screenshotSlot(data.screenshot),
      ),
      ctaFooter(data.cta),
    ),
  ];
}
