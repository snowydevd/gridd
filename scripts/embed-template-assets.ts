/**
 * Genera `convex/instagram/templates/fonts.ts` con las fuentes de las plantillas en base64.
 * Convex no sube archivos sueltos de node_modules, así que van embebidas en el bundle.
 *
 *   bun scripts/embed-template-assets.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const FONTS = [
  ["CHIVO_700", "@expo-google-fonts/chivo/700Bold/Chivo_700Bold.ttf"],
  ["CHIVO_800", "@expo-google-fonts/chivo/800ExtraBold/Chivo_800ExtraBold.ttf"],
  ["HANKEN_400", "@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf"],
  ["HANKEN_500", "@expo-google-fonts/hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf"],
  ["HANKEN_700", "@expo-google-fonts/hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf"],
] as const;

const lines = [
  "// Generado por scripts/embed-template-assets.ts. No editar a mano.",
  "// Chivo y Hanken Grotesk (SIL Open Font License) desde @expo-google-fonts.",
  ...FONTS.map(([name, path]) => `export const ${name} = "${readFileSync(require.resolve(path)).toString("base64")}";`),
  "",
];
const out = "convex/instagram/templates/fonts.ts";
writeFileSync(out, lines.join("\n"));
console.log(`${out} (${Math.round(lines.join("\n").length / 1024)} KB)`);
