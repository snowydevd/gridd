"use node";

// Render JSX-like → SVG (satori) → pixeles (resvg wasm) → JPEG (jpeg-js). Sólo Node.
// Las fuentes van embebidas (fonts.ts). El wasm de resvg se lee de node_modules:
// en Convex, @resvg/resvg-wasm va en node.externalPackages (convex.json).
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import jpeg from "jpeg-js";
import satori from "satori";
import { type TemplateInput, buildSlides, checkTemplateData } from "./index";
import { CHIVO_700, CHIVO_800, HANKEN_400, HANKEN_500, HANKEN_700 } from "./fonts";
import type { El } from "./h";
import { STORY_HEIGHT, STORY_WIDTH, type StoryData, story } from "./story";
import { C, F, HEIGHT, WIDTH } from "./theme";

const JPEG_QUALITY = 90;

const FONTS = [
  { name: F.display, weight: 700, data: CHIVO_700 },
  { name: F.display, weight: 800, data: CHIVO_800 },
  { name: F.body, weight: 400, data: HANKEN_400 },
  { name: F.body, weight: 500, data: HANKEN_500 },
  { name: F.body, weight: 700, data: HANKEN_700 },
] as const;

const resolve = (path: string) =>
  (typeof require === "function" ? require : createRequire(import.meta.url)).resolve(path);

let ready: Promise<{ name: string; weight: 700 | 800 | 400 | 500; data: Buffer; style: "normal" }[]> | null = null;

function setup() {
  ready ??= (async () => {
    await initWasm(readFile(resolve("@resvg/resvg-wasm/index_bg.wasm")));
    return FONTS.map((f) => ({ ...f, style: "normal" as const, data: Buffer.from(f.data, "base64") }));
  })();
  ready.catch(() => {
    ready = null;
  });
  return ready;
}

async function toJpeg(el: El, width: number, height: number): Promise<Uint8Array<ArrayBuffer>> {
  const fonts = await setup();
  const svg = await satori(el as unknown as Parameters<typeof satori>[0], { width, height, fonts });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width }, background: C.bg }).render();
  const encoded = jpeg.encode({ data: png.pixels, width: png.width, height: png.height }, JPEG_QUALITY);
  return new Uint8Array(encoded.data);
}

/** Devuelve un JPEG 1080×1350 por slide. */
export async function renderSlides(input: TemplateInput): Promise<Uint8Array<ArrayBuffer>[]> {
  const out: Uint8Array<ArrayBuffer>[] = [];
  for (const el of buildSlides(checkTemplateData(input))) out.push(await toJpeg(el, WIDTH, HEIGHT));
  return out;
}

/** Historia de un evento: un JPEG 1080×1920. */
export function renderStory(data: StoryData): Promise<Uint8Array<ArrayBuffer>> {
  return toJpeg(story(data), STORY_WIDTH, STORY_HEIGHT);
}
