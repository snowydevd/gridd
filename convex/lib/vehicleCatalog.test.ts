import { describe, expect, test } from "vitest";
import { findModel, isValidVehicle, modelYears, VEHICLE_CATALOG } from "./vehicleCatalog";

const YEAR = 2026;
const sortKey = (s: string) => s.toLocaleLowerCase("es");
const isSorted = (names: string[]) =>
  names.every((n, i) => i === 0 || sortKey(names[i - 1]).localeCompare(sortKey(n), "es", { numeric: true }) <= 0);

describe("VEHICLE_CATALOG", () => {
  test("marcas sin repetir y en orden alfabético", () => {
    const names = VEHICLE_CATALOG.map((x) => x.name);
    expect(new Set(names).size).toBe(names.length);
    expect(isSorted(names)).toBe(true);
  });

  test.each(VEHICLE_CATALOG)("$name: modelos sin repetir, ordenados y con años válidos", ({ models }) => {
    expect(models.length).toBeGreaterThan(0);
    const names = models.map((x) => x.name);
    expect(new Set(names).size).toBe(names.length);
    expect(isSorted(names)).toBe(true);
    for (const { name, from, to } of models) {
      expect(name.trim(), name).toBe(name);
      expect(from, name).toBeGreaterThanOrEqual(1900);
      expect(from, name).toBeLessThanOrEqual(YEAR);
      if (to !== null) {
        expect(to, name).toBeGreaterThanOrEqual(from);
        expect(to, name).toBeLessThanOrEqual(YEAR);
      }
    }
  });
});

describe("helpers", () => {
  test("findModel encuentra por marca y modelo exactos", () => {
    expect(findModel("Volkswagen", "Saveiro")).toMatchObject({ from: 1982 });
    expect(findModel("Volkswagen", "saveiro")).toBeUndefined();
    expect(findModel("Ford", "Saveiro")).toBeUndefined();
  });

  test("modelYears va del más nuevo al más viejo y no pasa del año actual", () => {
    expect(modelYears({ name: "X", from: 2024, to: null }, YEAR)).toEqual([2026, 2025, 2024]);
    expect(modelYears({ name: "X", from: 1990, to: 1992 }, YEAR)).toEqual([1992, 1991, 1990]);
  });

  test("isValidVehicle valida marca, modelo y año dentro del rango", () => {
    expect(isValidVehicle({ make: "Volkswagen", model: "Saveiro", year: 2014 }, YEAR)).toBe(true);
    expect(isValidVehicle({ make: "Volkswagen", model: "Saveiro", year: 1981 }, YEAR)).toBe(false);
    expect(isValidVehicle({ make: "Volkswagen", model: "Saveiro", year: 2027 }, YEAR)).toBe(false);
    expect(isValidVehicle({ make: "Volkswagen", model: "Saveiro", year: 2014.5 }, YEAR)).toBe(false);
    expect(isValidVehicle({ make: "Fiat", model: "Saveiro", year: 2014 }, YEAR)).toBe(false);
  });
});
