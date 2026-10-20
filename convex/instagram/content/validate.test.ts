import { describe, expect, test } from "vitest";
import { checkCaption, checkNumbers } from "./validate";

const ok = `Junadas, rodadas y más, todo en un lugar.

Bajate Gridd y no te pierdas ninguna 👉 gridd.app

#carmeetsuruguay #autosuruguay #fierreros`;

describe("checkCaption", () => {
  test("acepta un caption correcto", () => {
    expect(checkCaption(ok)).toEqual([]);
  });

  test("pide entre 3 y 8 hashtags, sin repetir", () => {
    expect(checkCaption(ok.replace("#autosuruguay #fierreros", ""))).toContainEqual(
      expect.stringMatching(/hashtags/),
    );
    const muchos = `${ok} ${Array.from({ length: 6 }, (_, i) => `#tag${i}`).join(" ")}`;
    expect(checkCaption(muchos)).toContainEqual(expect.stringMatching(/hashtags/));
    expect(checkCaption(`${ok} #fierreros`)).toContainEqual(expect.stringMatching(/repetid/));
  });

  test("corta captions de más de 700 caracteres", () => {
    expect(checkCaption(`${"a".repeat(700)}\n${ok}`)).toContainEqual(expect.stringMatching(/caracteres/));
  });

  test("el CTA a Gridd tiene que estar al final, antes de los hashtags", () => {
    const sinCta = `Junadas y rodadas.\n\nNos vemos.\n\n#carmeetsuruguay #autosuruguay #fierreros`;
    expect(checkCaption(sinCta)).toContainEqual(expect.stringMatching(/CTA/));
  });
});

describe("checkNumbers", () => {
  const facts = ["Radios de 10, 25, 50 km", "Categorías: 4x4, JDM"];

  test("acepta números que están en los hechos", () => {
    expect(checkNumbers(["Buscá a 25 km o 50 km", "Meets 4x4"], facts)).toEqual([]);
  });

  test("marca cifras inventadas", () => {
    expect(checkNumbers(["Más de 5000 usuarios"], facts)).toEqual([
      expect.stringMatching(/5000/),
    ]);
  });
});
