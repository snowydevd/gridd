import { describe, expect, test } from "vitest";
import {
  contrastRatio,
  darkPalette,
  lightPalette,
  parsePreference,
  resolveScheme,
  withAlpha,
  themePreferenceLabel,
  THEME_PREFERENCES,
} from "./palettes";

describe("paletas", () => {
  test("la oscura queda igual que antes, con accentText = lima", () => {
    expect(darkPalette).toEqual({
      canvas: "#0B0B0C",
      surface: "#17181B",
      raised: "#1F2024",
      border: "#2A2C30",
      text: "#F2F3F5",
      textSecondary: "#8A8F98",
      textDisabled: "#4A4E55",
      accent: "#E2FF3B",
      onAccent: "#0B0B0C",
      accentText: "#E2FF3B",
      success: "#3DDC84",
      warning: "#FFB020",
      error: "#FF4D4F",
      onError: "#0B0B0C",
    });
  });

  test("la clara es la paleta Papel", () => {
    expect(lightPalette).toEqual({
      canvas: "#F6F5F0",
      surface: "#FFFFFF",
      raised: "#EEEDE7",
      border: "#E1DFD7",
      text: "#121212",
      textSecondary: "#5E6168",
      textDisabled: "#A3A6AC",
      accent: "#E2FF3B",
      onAccent: "#0B0B0C",
      accentText: "#4F5E00",
      success: "#16794A",
      warning: "#9A5B00",
      error: "#C8282B",
      onError: "#FFFFFF",
    });
  });

  test.each(["text", "textSecondary", "accentText", "success", "warning", "error"] as const)(
    "en claro %s se lee sobre canvas y surface (≥ 4.5:1)",
    (token) => {
      expect(contrastRatio(lightPalette[token], lightPalette.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lightPalette[token], lightPalette.surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  test("el texto sobre el lima se lee en las dos paletas", () => {
    for (const p of [darkPalette, lightPalette]) {
      expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("el texto del botón de peligro se lee en las dos paletas", () => {
    for (const p of [darkPalette, lightPalette]) {
      expect(contrastRatio(p.onError, p.error)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("el lima sobre blanco no se ve: por eso existe accentText", () => {
    expect(contrastRatio("#E2FF3B", "#FFFFFF")).toBeLessThan(1.2);
  });
});

describe("preferencia de tema", () => {
  test("resolveScheme sigue al sistema sólo en 'system'", () => {
    expect(resolveScheme("system", "light")).toBe("light");
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", null)).toBe("dark");
    expect(resolveScheme("light", "dark")).toBe("light");
    expect(resolveScheme("dark", "light")).toBe("dark");
  });

  test("parsePreference cae a 'system' con valores desconocidos", () => {
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("system")).toBe("system");
    expect(parsePreference(null)).toBe("system");
    expect(parsePreference("banana")).toBe("system");
  });

  test("opciones y etiquetas en orden", () => {
    expect(THEME_PREFERENCES).toEqual(["system", "light", "dark"]);
    expect(THEME_PREFERENCES.map(themePreferenceLabel)).toEqual(["Sistema", "Claro", "Oscuro"]);
  });
});

describe("withAlpha", () => {
  test("da el mismo rgba que usaba la etiqueta en el tema oscuro", () => {
    expect(withAlpha(darkPalette.canvas, 0.7)).toBe("rgba(11,11,12,0.7)");
    expect(withAlpha(lightPalette.canvas, 0.7)).toBe("rgba(246,245,240,0.7)");
  });
});
