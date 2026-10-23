import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { insertEvent, makeUser, setup, type T } from "./test.helpers";

const PEOPLE = [
  { name: "Ana Seed", car: { make: "Subaru", model: "Impreza", year: 2008 } },
  { name: "Beto Seed" },
];

async function seedEvent(t: T, slug: string, attendeeCount = 530) {
  const org = await makeUser(t, "publisher", "Org");
  return await insertEvent(t, org.id, { slug, attendeeCount });
}

const count = (t: T, id: Awaited<ReturnType<typeof seedEvent>>) =>
  t.run(async (ctx) => (await ctx.db.get(id))?.attendeeCount);

describe("seed.insertPeople", () => {
  test("crea la gente con su auto, la anota y el contador queda igual a las anotaciones reales", async () => {
    const t = setup();
    const eventId = await seedEvent(t, "jdm-night");

    const result = await t.mutation(internal.seed.insertPeople, {
      people: PEOPLE,
      attendances: [{ slug: "jdm-night", names: ["Ana Seed", "Beto Seed"] }],
    });
    expect(result).toEqual({ people: 2, attendances: 2 });
    expect(await count(t, eventId)).toBe(2);

    await t.run(async (ctx) => {
      const ana = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "ana-seed@seed.gridd.local"))
        .first();
      expect(ana).toMatchObject({ name: "Ana Seed", role: "user" });
      const cars = await ctx.db.query("cars").withIndex("by_user", (q) => q.eq("userId", ana!._id)).collect();
      expect(cars).toHaveLength(1);
      expect(cars[0]).toMatchObject({ make: "Subaru", model: "Impreza", year: 2008 });
    });
  });

  test("correrlo dos veces no duplica gente, autos ni anotaciones", async () => {
    const t = setup();
    const eventId = await seedEvent(t, "jdm-night");
    const args = { people: PEOPLE, attendances: [{ slug: "jdm-night", names: ["Ana Seed", "Beto Seed"] }] };
    await t.mutation(internal.seed.insertPeople, args);
    expect(await t.mutation(internal.seed.insertPeople, args)).toEqual({ people: 0, attendances: 0 });
    expect(await count(t, eventId)).toBe(2);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("cars").collect()).toHaveLength(1);
      expect(await ctx.db.query("attendances").collect()).toHaveLength(2);
    });
  });

  test("un slug que no existe se saltea", async () => {
    const t = setup();
    expect(
      await t.mutation(internal.seed.insertPeople, {
        people: PEOPLE,
        attendances: [{ slug: "no-existe", names: ["Ana Seed"] }],
      }),
    ).toEqual({ people: 2, attendances: 0 });
  });

  test("un auto fuera del catálogo → error", async () => {
    const t = setup();
    await expect(
      t.mutation(internal.seed.insertPeople, {
        people: [{ name: "Ana Seed", car: { make: "Inventada", model: "X", year: 2000 } }],
        attendances: [],
      }),
    ).rejects.toThrow();
  });
});

describe("seed.clear con gente", () => {
  test("borra a la gente de prueba, sus autos y anotaciones, y descuenta en eventos que no se borran", async () => {
    const t = setup();
    const real = await makeUser(t, "publisher", "Real");
    const realEvent = await insertEvent(t, real.id, { slug: "evento-real", attendeeCount: 0 });
    await t.mutation(internal.seed.insertPeople, {
      people: PEOPLE,
      attendances: [{ slug: "evento-real", names: ["Ana Seed", "Beto Seed"] }],
    });
    expect(await count(t, realEvent)).toBe(2);

    const result = await t.mutation(internal.seed.clear, { organizerNames: [], personNames: ["Ana Seed", "Beto Seed"] });
    expect(result).toMatchObject({ people: 2 });
    expect(await count(t, realEvent)).toBe(0);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("cars").collect()).toHaveLength(0);
      expect(await ctx.db.query("attendances").collect()).toHaveLength(0);
      expect(await ctx.db.get(realEvent)).not.toBeNull();
    });
  });
});

describe("seed.insertEvents", () => {
  const base = {
    title: "JDM Night",
    description: "",
    kind: "jdm" as const,
    placeName: "Carrasco",
    lat: -34.87,
    lon: -56.05,
    attendeeCount: 0,
  };

  test("un evento sembrado que ya existe se actualiza con las fechas nuevas", async () => {
    const t = setup();
    const old = { ...base, slug: "jdm-night", startsAt: 1_000, endsAt: 2_000, organizerName: "Garage 20B" };
    await t.mutation(internal.seed.insertEvents, { events: [old] });

    const fresh = { ...old, startsAt: Date.now() + 3_600_000, endsAt: Date.now() + 7_200_000 };
    expect(await t.mutation(internal.seed.insertEvents, { events: [fresh] })).toEqual({
      inserted: 0,
      updated: 1,
      skipped: 0,
    });
    await t.run(async (ctx) => {
      const event = await ctx.db.query("events").withIndex("by_slug", (q) => q.eq("slug", "jdm-night")).first();
      expect(event).toMatchObject({ startsAt: fresh.startsAt, endsAt: fresh.endsAt });
    });
  });

  test("un evento real con el mismo slug no se toca", async () => {
    const t = setup();
    const real = await makeUser(t, "publisher", "Real");
    await insertEvent(t, real.id, { slug: "jdm-night", startsAt: 5_000, endsAt: 6_000 });
    const seeded = { ...base, slug: "jdm-night", startsAt: 9_000, endsAt: 9_500, organizerName: "Garage 20B" };
    expect(await t.mutation(internal.seed.insertEvents, { events: [seeded] })).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
    });
    await t.run(async (ctx) => {
      const event = await ctx.db.query("events").withIndex("by_slug", (q) => q.eq("slug", "jdm-night")).first();
      expect(event).toMatchObject({ startsAt: 5_000, organizerId: real.id });
    });
  });
});
