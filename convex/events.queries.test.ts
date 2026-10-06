import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { DAY, HOUR, expectCode, insertEvent, makeUser, setup } from "./test.helpers";

const page = { numItems: 50, cursor: null };

describe("events.listUpcoming", () => {
  test("sólo publicados que no terminaron, ordenados por fecha", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    const now = Date.now();
    await insertEvent(t, id, { title: "Después", startsAt: now + 3 * DAY, endsAt: now + 3 * DAY + HOUR });
    await insertEvent(t, id, { title: "Antes", startsAt: now + DAY, endsAt: now + DAY + HOUR });
    await insertEvent(t, id, { title: "En curso", startsAt: now - HOUR, endsAt: now + HOUR });
    await insertEvent(t, id, { title: "Terminado", startsAt: now - 5 * HOUR, endsAt: now - HOUR });
    await insertEvent(t, id, { title: "Cancelado", status: "cancelled" });
    await insertEvent(t, id, { title: "Oculto", status: "hidden" });

    const result = await t.query(api.events.listUpcoming, { paginationOpts: page });
    expect(result.page.map((e) => e.title)).toEqual(["En curso", "Antes", "Después"]);
    expect(result.page[0].organizer?._id).toBe(id);
    expect(result.page[0].imageUrl).toBeNull();
  });

  test("filtra por kind", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    await insertEvent(t, id, { kind: "jdm", title: "JDM" });
    await insertEvent(t, id, { kind: "motos", title: "Motos" });
    const result = await t.query(api.events.listUpcoming, { paginationOpts: page, kind: "motos" });
    expect(result.page.map((e) => e.title)).toEqual(["Motos"]);
  });

  test("resuelve imageUrl", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["img"])));
    await insertEvent(t, id, { imageId });
    const result = await t.query(api.events.listUpcoming, { paginationOpts: page });
    expect(result.page[0].imageUrl).toBeTypeOf("string");
  });
});

describe("events.listInBounds", () => {
  const montevideo = { minLat: -35.0, maxLat: -34.7, minLon: -56.4, maxLon: -55.9 };

  test("devuelve los publicados dentro del bbox y del rango", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    const now = Date.now();
    await insertEvent(t, id, { title: "Pocitos", lat: -34.91, lon: -56.15 });
    await insertEvent(t, id, { title: "Salto", lat: -31.38, lon: -57.96 });
    await insertEvent(t, id, { title: "Lejos en el tiempo", startsAt: now + 60 * DAY, endsAt: now + 60 * DAY + HOUR });
    await insertEvent(t, id, { title: "Cancelado", status: "cancelled" });

    const result = await t.query(api.events.listInBounds, {
      ...montevideo,
      from: now,
      to: now + 30 * DAY,
    });
    expect(result.map((e) => e.title)).toEqual(["Pocitos"]);
  });

  test("máximo 200 resultados", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    for (let i = 0; i < 205; i++) await insertEvent(t, id);
    const now = Date.now();
    const result = await t.query(api.events.listInBounds, { ...montevideo, from: now, to: now + 7 * DAY });
    expect(result).toHaveLength(200);
  });

  test.each([
    ["bbox invertido", { minLat: -34.7, maxLat: -35.0 }],
    ["lon invertida", { minLon: -55.9, maxLon: -56.4 }],
    ["to antes de from", { from: Date.now() + DAY, to: Date.now() }],
    ["ventana de más de 90 días", { from: Date.now(), to: Date.now() + 91 * DAY }],
  ])("%s → INVALID", async (_name, patch) => {
    const t = setup();
    await expectCode(
      t.query(api.events.listInBounds, {
        ...montevideo,
        from: Date.now(),
        to: Date.now() + DAY,
        ...patch,
      }),
      "INVALID",
    );
  });
});

describe("events.getBySlug", () => {
  test("devuelve publicados y cancelados", async () => {
    const t = setup();
    const { id } = await makeUser(t, "publisher");
    await insertEvent(t, id, { slug: "pub" });
    await insertEvent(t, id, { slug: "can", status: "cancelled" });
    expect((await t.query(api.events.getBySlug, { slug: "pub" }))?.slug).toBe("pub");
    expect((await t.query(api.events.getBySlug, { slug: "can" }))?.status).toBe("cancelled");
    expect(await t.query(api.events.getBySlug, { slug: "nope" })).toBeNull();
  });

  test("un oculto sólo lo ven el organizador y los admins", async () => {
    const t = setup();
    const owner = await makeUser(t, "publisher", "Owner");
    const admin = await makeUser(t, "admin", "Admin");
    const stranger = await makeUser(t, "user", "Stranger");
    await insertEvent(t, owner.id, { slug: "oculto", status: "hidden" });
    expect(await t.query(api.events.getBySlug, { slug: "oculto" })).toBeNull();
    expect(await stranger.as.query(api.events.getBySlug, { slug: "oculto" })).toBeNull();
    expect(await owner.as.query(api.events.getBySlug, { slug: "oculto" })).not.toBeNull();
    expect(await admin.as.query(api.events.getBySlug, { slug: "oculto" })).not.toBeNull();
  });
});

describe("events.listMine", () => {
  test("todos los eventos del organizador, sin importar estado, los más recientes primero", async () => {
    const t = setup();
    const me = await makeUser(t, "publisher", "Me");
    const other = await makeUser(t, "publisher", "Other");
    const now = Date.now();
    await insertEvent(t, me.id, { title: "Viejo", startsAt: now - 10 * DAY, endsAt: now - 10 * DAY + HOUR });
    await insertEvent(t, me.id, { title: "Nuevo", startsAt: now + 5 * DAY, endsAt: now + 5 * DAY + HOUR });
    await insertEvent(t, me.id, { title: "Oculto", status: "hidden" });
    await insertEvent(t, other.id, { title: "Ajeno" });
    const mine = await me.as.query(api.events.listMine, {});
    expect(mine.map((e) => e.title)).toEqual(["Nuevo", "Oculto", "Viejo"]);
  });

  test("un user común → FORBIDDEN", async () => {
    const t = setup();
    const { as } = await makeUser(t, "user");
    await expectCode(as.query(api.events.listMine, {}), "FORBIDDEN");
  });
});
