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
