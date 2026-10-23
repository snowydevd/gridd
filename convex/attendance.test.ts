import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DAY, HOUR, expectCode, insertEvent, makeUser, setup, type T } from "./test.helpers";

const countOf = async (t: T, id: Id<"events">) =>
  (await t.run((ctx) => ctx.db.get(id)))?.attendeeCount;

describe("attendance.toggle", () => {
  test("marcar y desmarcar ajusta el contador", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const eventId = await insertEvent(t, org.id);

    expect(await fan.as.mutation(api.attendance.toggle, { eventId })).toEqual({ attending: true });
    expect(await countOf(t, eventId)).toBe(1);
    expect(await fan.as.query(api.attendance.isAttending, { eventId })).toBe(true);

    expect(await fan.as.mutation(api.attendance.toggle, { eventId })).toEqual({ attending: false });
    expect(await countOf(t, eventId)).toBe(0);
    expect(await fan.as.query(api.attendance.isAttending, { eventId })).toBe(false);
  });

  test("dos usuarios suman 2", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const a = await makeUser(t, "user", "A");
    const b = await makeUser(t, "user", "B");
    const eventId = await insertEvent(t, org.id);
    await a.as.mutation(api.attendance.toggle, { eventId });
    await b.as.mutation(api.attendance.toggle, { eventId });
    expect(await countOf(t, eventId)).toBe(2);
  });

  test("no se puede marcar un evento cancelado, oculto o terminado", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const now = Date.now();
    const cancelled = await insertEvent(t, org.id, { status: "cancelled" });
    const hidden = await insertEvent(t, org.id, { status: "hidden" });
    const past = await insertEvent(t, org.id, { startsAt: now - DAY, endsAt: now - DAY + HOUR });
    for (const eventId of [cancelled, hidden, past]) {
      await expectCode(fan.as.mutation(api.attendance.toggle, { eventId }), "INVALID");
    }
  });

  test("desmarcar un evento que después se canceló funciona y no deja negativo", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const eventId = await insertEvent(t, org.id);
    await fan.as.mutation(api.attendance.toggle, { eventId });
    // Simula un contador desincronizado en 0 para verificar el piso.
    await t.run((ctx) => ctx.db.patch(eventId, { status: "cancelled", attendeeCount: 0 }));
    expect(await fan.as.mutation(api.attendance.toggle, { eventId })).toEqual({ attending: false });
    expect(await countOf(t, eventId)).toBe(0);
  });

  test("anónimo → UNAUTHENTICATED; evento inexistente → NOT_FOUND", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const eventId = await insertEvent(t, org.id);
    await expectCode(t.mutation(api.attendance.toggle, { eventId }), "UNAUTHENTICATED");
    await t.run((ctx) => ctx.db.delete(eventId));
    await expectCode(fan.as.mutation(api.attendance.toggle, { eventId }), "NOT_FOUND");
  });
});

describe("attendance.isAttending", () => {
  test("anónimo recibe false", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const eventId = await insertEvent(t, org.id);
    expect(await t.query(api.attendance.isAttending, { eventId })).toBe(false);
  });
});

describe("attendance.myEvents", () => {
  test("eventos a los que voy, sin ocultos, ordenados por fecha", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const now = Date.now();
    const later = await insertEvent(t, org.id, { title: "Después", startsAt: now + 3 * DAY, endsAt: now + 3 * DAY + HOUR });
    const sooner = await insertEvent(t, org.id, { title: "Antes", startsAt: now + DAY, endsAt: now + DAY + HOUR });
    const willHide = await insertEvent(t, org.id, { title: "Se oculta" });
    for (const eventId of [later, sooner, willHide]) {
      await fan.as.mutation(api.attendance.toggle, { eventId });
    }
    await t.run((ctx) => ctx.db.patch(willHide, { status: "hidden" }));
    const mine = await fan.as.query(api.attendance.myEvents, {});
    expect(mine.map((e) => e.title)).toEqual(["Antes", "Después"]);
  });
});

describe("attendance.list", () => {
  test("devuelve foto, nombre y primer auto de cada anotado, sin email ni el organizador", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const ana = await makeUser(t, "user", "Ana");
    const beto = await makeUser(t, "user", "Beto");
    const eventId = await insertEvent(t, org.id);
    await t.run(async (ctx) => {
      await ctx.db.insert("cars", { userId: ana.id, make: "Subaru", model: "WRX STI", year: 2008 });
      await ctx.db.insert("cars", { userId: ana.id, make: "Toyota", model: "Corolla" });
    });
    for (const u of [ana, beto, org]) await u.as.mutation(api.attendance.toggle, { eventId });

    const list = await beto.as.query(api.attendance.list, { eventId });
    expect(list).toEqual([
      { _id: ana.id, name: "Ana", image: null, car: { make: "Subaru", model: "WRX STI", version: null, year: 2008 } },
      { _id: beto.id, name: "Beto", image: null, car: null },
    ]);
    expect(JSON.stringify(list)).not.toContain("@test.uy");
  });

  test("ordena por momento de anotación, no por id", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const users = [];
    for (const name of ["A", "B", "C", "D", "E"]) users.push(await makeUser(t, "user", name));
    const eventId = await insertEvent(t, org.id);
    const order = [users[3], users[0], users[4], users[2], users[1]];
    for (const u of order) await u.as.mutation(api.attendance.toggle, { eventId });

    const list = await org.as.query(api.attendance.list, { eventId });
    expect(list.map((p) => p._id)).toEqual(order.map((u) => u.id));
  });

  test("sin sesión → UNAUTHENTICATED", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const eventId = await insertEvent(t, org.id);
    await expectCode(t.query(api.attendance.list, { eventId }), "UNAUTHENTICATED");
  });

  test("evento oculto → NOT_FOUND para quien no es admin ni organizador", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const fan = await makeUser(t, "user");
    const eventId = await insertEvent(t, org.id, { status: "hidden" });
    await expectCode(fan.as.query(api.attendance.list, { eventId }), "NOT_FOUND");
  });
});
