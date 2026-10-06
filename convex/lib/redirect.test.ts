import { describe, expect, test } from "vitest";
import { resolveRedirect } from "./redirect";

const SITE = "http://localhost:3000";

describe("resolveRedirect", () => {
  test("rutas relativas van contra SITE_URL", () => {
    expect(resolveRedirect("/perfil", { siteUrl: SITE })).toBe(`${SITE}/perfil`);
    expect(resolveRedirect("?x=1", { siteUrl: `${SITE}/` })).toBe(`${SITE}?x=1`);
  });

  test("acepta SITE_URL pero no un dominio que sólo empieza igual", () => {
    expect(resolveRedirect(`${SITE}/ok`, { siteUrl: SITE })).toBe(`${SITE}/ok`);
    expect(() => resolveRedirect(`${SITE}.evil.com`, { siteUrl: SITE })).toThrow();
  });

  test("acepta el esquema de la app", () => {
    expect(resolveRedirect("gridd:///", { siteUrl: SITE })).toBe("gridd:///");
  });

  test("exp:// (Expo Go) sólo si está habilitado", () => {
    const url = "exp://192.168.1.10:8081/--/";
    expect(() => resolveRedirect(url, { siteUrl: SITE })).toThrow();
    expect(resolveRedirect(url, { siteUrl: SITE, allowExpoGo: true })).toBe(url);
  });

  test("rechaza cualquier otro destino", () => {
    expect(() => resolveRedirect("https://evil.com", { siteUrl: SITE })).toThrow();
  });
});

