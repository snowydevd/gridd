import { describe, expect, test } from "vitest";
import type { Angle } from "./angles";
import { pickAngles, pickTemplate, schedule } from "./plan";

const DAY = 24 * 60 * 60 * 1000;

const angle = (id: string, facts = ["algo"]): Angle => ({
  id,
  title: id,
  goal: "",
  templates: ["headline", "feature"],
  facts,
});

describe("pickAngles", () => {
  const angles = [angle("a"), angle("b"), angle("c"), angle("vacio", [])];

  test("primero los nunca usados, después los usados hace más tiempo", () => {
    // recent: más reciente primero
    expect(pickAngles(angles, ["a", "b"], 3).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  test("saltea ángulos sin hechos verificados", () => {
    expect(pickAngles(angles, [], 3).map((x) => x.id)).not.toContain("vacio");
  });

  test("si piden más que los disponibles, rota sin repetir seguido", () => {
    const ids = pickAngles(angles, [], 5).map((x) => x.id);
    expect(ids).toEqual(["a", "b", "c", "a", "b"]);
  });

  test("sin ángulos con hechos, falla con un mensaje claro", () => {
    expect(() => pickAngles([angle("x", [])], [], 1)).toThrow(/angles\.ts/);
  });
});

test("pickTemplate rota las plantillas del ángulo", () => {
  const a = angle("a");
  expect([0, 1, 2].map((i) => pickTemplate(a, i))).toEqual(["headline", "feature", "headline"]);
});

test("schedule reparte los posts cada N días desde startAt", () => {
  const start = Date.UTC(2026, 9, 26, 22);
  expect(schedule(start, 3, 2)).toEqual([start, start + 2 * DAY, start + 4 * DAY]);
});
