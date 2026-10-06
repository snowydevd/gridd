import { describe, expect, test } from "vitest";
import { insertEvent, makeUser, setup } from "../test.helpers";
import { slugBase, uniqueSlug } from "./slug";

// 2026-10-10 01:00 UTC = 2026-10-09 22:00 en Montevideo
const LATE_NIGHT = Date.UTC(2026, 9, 10, 1);

describe("slugBase", () => {
  test("saca acentos, baja a minúsculas y usa la fecha de Montevideo", () => {
    expect(slugBase("Junada Clásicos & Café!", LATE_NIGHT)).toBe(
      "junada-clasicos-cafe-2026-10-09",
    );
  });

  test("título de sólo emojis cae en 'evento'", () => {
    expect(slugBase("🔥🔥🔥", LATE_NIGHT)).toBe("evento-2026-10-09");
  });

  test("corta el título a 60 sin dejar guion colgando", () => {
    const slug = slugBase(`${"a".repeat(59)} bbbb`, LATE_NIGHT);
    expect(slug).toBe(`${"a".repeat(59)}-2026-10-09`);
  });

  test("conserva 4x4", () => {
    expect(slugBase("Salida 4x4", LATE_NIGHT)).toBe("salida-4x4-2026-10-09");
  });
});

describe("uniqueSlug", () => {
  test("agrega -2, -3 si ya existe", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    expect(await t.run((ctx) => uniqueSlug(ctx, "junada-2026-10-09"))).toBe(
      "junada-2026-10-09",
    );
    await insertEvent(t, id, { slug: "junada-2026-10-09" });
    await insertEvent(t, id, { slug: "junada-2026-10-09-2" });
    expect(await t.run((ctx) => uniqueSlug(ctx, "junada-2026-10-09"))).toBe(
      "junada-2026-10-09-3",
    );
  });
});
