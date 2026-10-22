import { describe, expect, test } from "vitest";
import { DAY, HOUR, NO_END_DURATION, type EventInput, validateEventInput } from "./validation";

const NOW = Date.UTC(2026, 9, 6, 12);
const base: EventInput = {
  title: "Junada JDM",
  description: "Traé el auto limpio",
  kind: "jdm",
  startsAt: NOW + DAY,
  endsAt: NOW + DAY + 3 * HOUR,
  placeName: "Parque Rodó",
  lat: -34.91,
  lon: -56.17,
};

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  return "OK";
};
const check = (patch: Partial<EventInput>, dateChanged = true) =>
  codeOf(() => validateEventInput({ ...base, ...patch }, NOW, { dateChanged }));

describe("validateEventInput", () => {
  test("acepta un evento válido y hace trim de los textos", () => {
    const out = validateEventInput(
      { ...base, title: "  Junada JDM ", placeName: " Parque Rodó " },
      NOW,
      { dateChanged: true },
    );
    expect(out.title).toBe("Junada JDM");
    expect(out.placeName).toBe("Parque Rodó");
  });

  test.each([
    ["título corto", { title: " ab " }],
    ["título largo", { title: "x".repeat(81) }],
    ["descripción larga", { description: "x".repeat(2001) }],
    ["lugar corto", { placeName: "a" }],
    ["lugar largo", { placeName: "x".repeat(121) }],
    ["empieza en el pasado", { startsAt: NOW - HOUR, endsAt: NOW + HOUR }],
    ["termina antes de empezar", { endsAt: NOW + DAY - HOUR }],
    ["termina igual que empieza", { endsAt: NOW + DAY }],
    ["dura más de 7 días", { endsAt: NOW + DAY + 7 * DAY + 1 }],
    ["lat fuera de Uruguay", { lat: -40 }],
    ["lon fuera de Uruguay", { lon: -60 }],
    ["lat NaN", { lat: Number.NaN }],
  ])("rechaza %s", (_name, patch) => {
    expect(check(patch)).toBe("INVALID");
  });

  test("evento que ya empezó pasa si la fecha no cambió", () => {
    expect(check({ startsAt: NOW - HOUR, endsAt: NOW + HOUR }, false)).toBe("OK");
  });

  test("dura exactamente 7 días: válido", () => {
    expect(check({ endsAt: NOW + DAY + 7 * DAY })).toBe("OK");
  });

  test("sin hora de fin: endsAt queda en inicio + NO_END_DURATION", () => {
    const out = validateEventInput({ ...base, endsAt: undefined, noEndTime: true }, NOW, { dateChanged: true });
    expect(out.endsAt).toBe(base.startsAt + NO_END_DURATION);
    expect(out.noEndTime).toBe(true);
  });

  test("sin hora de fin: ignora el endsAt que venga", () => {
    const out = validateEventInput({ ...base, endsAt: base.startsAt - HOUR, noEndTime: true }, NOW, {
      dateChanged: true,
    });
    expect(out.endsAt).toBe(base.startsAt + NO_END_DURATION);
  });

  test("falta la hora de fin y no se marcó noEndTime → INVALID", () => {
    expect(check({ endsAt: undefined })).toBe("INVALID");
  });
});
