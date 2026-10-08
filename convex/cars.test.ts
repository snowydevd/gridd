import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { MAX_CARS } from "./cars";
import { expectCode, makeUser, setup } from "./test.helpers";

const saveiro = { make: "Volkswagen", model: "Saveiro", year: 2014 };

describe("cars.listMine", () => {
  test("anónimo recibe una lista vacía", async () => {
    const t = setup();
    expect(await t.query(api.cars.listMine, {})).toEqual([]);
  });

  test("sólo devuelve los autos propios, del más viejo al más nuevo", async () => {
    const t = setup();
    const ana = await makeUser(t, undefined, "Ana");
    const beto = await makeUser(t, undefined, "Beto");
    await ana.as.mutation(api.cars.add, saveiro);
    await ana.as.mutation(api.cars.add, { make: "Toyota", model: "Corolla", year: 2020 });
    await beto.as.mutation(api.cars.add, saveiro);

    const mine = await ana.as.query(api.cars.listMine, {});
    expect(mine.map((c) => c.model)).toEqual(["Saveiro", "Corolla"]);
  });
});

describe("cars.add", () => {
  test("guarda el auto con versión recortada y modificado por defecto en false", async () => {
    const t = setup();
    const { id, as } = await makeUser(t);
    const carId = await as.mutation(api.cars.add, { ...saveiro, version: "  G5 1.6  " });
    const car = await t.run((ctx) => ctx.db.get(carId));
    expect(car).toMatchObject({ ...saveiro, userId: id, version: "G5 1.6", isModified: false });
  });

  test("versión vacía no se guarda", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const carId = await as.mutation(api.cars.add, { ...saveiro, version: "   " });
    expect((await t.run((ctx) => ctx.db.get(carId)))?.version).toBeUndefined();
  });

  test("anónimo no puede", async () => {
    const t = setup();
    await expectCode(t.mutation(api.cars.add, saveiro), "UNAUTHENTICATED");
  });

  test.each([
    ["marca inexistente", { ...saveiro, make: "Fierro" }],
    ["modelo de otra marca", { ...saveiro, make: "Fiat" }],
    ["año antes del modelo", { ...saveiro, year: 1950 }],
    ["año futuro", { ...saveiro, year: 3000 }],
    ["versión muy larga", { ...saveiro, version: "x".repeat(41) }],
  ])("%s → INVALID", async (_, car) => {
    const t = setup();
    const { as } = await makeUser(t);
    await expectCode(as.mutation(api.cars.add, car), "INVALID");
  });

  test(`no se pueden tener más de ${MAX_CARS} autos`, async () => {
    const t = setup();
    const { as } = await makeUser(t);
    for (let i = 0; i < MAX_CARS; i++) await as.mutation(api.cars.add, saveiro);
    await expectCode(as.mutation(api.cars.add, saveiro), "CONFLICT");
  });
});

describe("cars.update", () => {
  test("el dueño puede cambiar todos los campos", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const carId = await as.mutation(api.cars.add, { ...saveiro, version: "G5" });
    await as.mutation(api.cars.update, {
      id: carId,
      make: "Toyota",
      model: "Corolla",
      year: 2020,
      isModified: true,
    });
    const car = await t.run((ctx) => ctx.db.get(carId));
    expect(car).toMatchObject({ make: "Toyota", model: "Corolla", year: 2020, isModified: true });
    // Sin `version` en el update se borra: el formulario siempre manda el estado completo.
    expect(car?.version).toBeUndefined();
  });

  test("otro usuario → FORBIDDEN", async () => {
    const t = setup();
    const ana = await makeUser(t, undefined, "Ana");
    const beto = await makeUser(t, undefined, "Beto");
    const carId = await ana.as.mutation(api.cars.add, saveiro);
    await expectCode(beto.as.mutation(api.cars.update, { id: carId, ...saveiro }), "FORBIDDEN");
  });

  test("datos inválidos → INVALID y no cambia nada", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const carId = await as.mutation(api.cars.add, saveiro);
    await expectCode(as.mutation(api.cars.update, { id: carId, ...saveiro, year: 1950 }), "INVALID");
    expect((await t.run((ctx) => ctx.db.get(carId)))?.year).toBe(2014);
  });
});

describe("cars.remove", () => {
  test("el dueño lo borra", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const carId = await as.mutation(api.cars.add, saveiro);
    await as.mutation(api.cars.remove, { id: carId });
    expect(await t.run((ctx) => ctx.db.get(carId))).toBeNull();
  });

  test("otro usuario → FORBIDDEN", async () => {
    const t = setup();
    const ana = await makeUser(t, undefined, "Ana");
    const beto = await makeUser(t, undefined, "Beto");
    const carId = await ana.as.mutation(api.cars.add, saveiro);
    await expectCode(beto.as.mutation(api.cars.remove, { id: carId }), "FORBIDDEN");
  });

  test("auto ya borrado → NOT_FOUND", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const carId = await as.mutation(api.cars.add, saveiro);
    await as.mutation(api.cars.remove, { id: carId });
    await expectCode(as.mutation(api.cars.remove, { id: carId }), "NOT_FOUND");
  });
});
