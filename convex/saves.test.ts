import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { DAY, HOUR, expectCode, insertEvent, makeUser, setup } from "./test.helpers";

describe("saves.toggle", () => {
  test("guardar y quitar", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const eventId = await insertEvent(t, org.id);

    expect(await fan.as.mutation(api.saves.toggle, { eventId })).toEqual({ saved: true });
    expect(await fan.as.query(api.saves.isSaved, { eventId })).toBe(true);

    expect(await fan.as.mutation(api.saves.toggle, { eventId })).toEqual({ saved: false });
    expect(await fan.as.query(api.saves.isSaved, { eventId })).toBe(false);
  });

  test("cada usuario tiene sus propios guardados", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const a = await makeUser(t, "user", "A");
    const b = await makeUser(t, "user", "B");
    const eventId = await insertEvent(t, org.id);
    await a.as.mutation(api.saves.toggle, { eventId });
    expect(await a.as.query(api.saves.isSaved, { eventId })).toBe(true);
    expect(await b.as.query(api.saves.isSaved, { eventId })).toBe(false);
  });

  test("se puede guardar un evento cancelado o terminado, pero no uno oculto", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const now = Date.now();
    const cancelled = await insertEvent(t, org.id, { status: "cancelled" });
    const past = await insertEvent(t, org.id, { startsAt: now - DAY, endsAt: now - DAY + HOUR });
    const hidden = await insertEvent(t, org.id, { status: "hidden" });
    expect(await fan.as.mutation(api.saves.toggle, { eventId: cancelled })).toEqual({ saved: true });
    expect(await fan.as.mutation(api.saves.toggle, { eventId: past })).toEqual({ saved: true });
    await expectCode(fan.as.mutation(api.saves.toggle, { eventId: hidden }), "NOT_FOUND");
  });

  test("quitar un guardado de un evento que después se ocultó funciona", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const eventId = await insertEvent(t, org.id);
    await fan.as.mutation(api.saves.toggle, { eventId });
    await t.run((ctx) => ctx.db.patch(eventId, { status: "hidden" }));
    expect(await fan.as.mutation(api.saves.toggle, { eventId })).toEqual({ saved: false });
  });

  test("anónimo → UNAUTHENTICATED; evento inexistente → NOT_FOUND", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const eventId = await insertEvent(t, org.id);
    await expectCode(t.mutation(api.saves.toggle, { eventId }), "UNAUTHENTICATED");
    await t.run((ctx) => ctx.db.delete(eventId));
    await expectCode(fan.as.mutation(api.saves.toggle, { eventId }), "NOT_FOUND");
  });
});

describe("saves.isSaved", () => {
  test("anónimo recibe false", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const eventId = await insertEvent(t, org.id);
    expect(await t.query(api.saves.isSaved, { eventId })).toBe(false);
  });
});

describe("saves.mySaved", () => {
  test("mis guardados, sin ocultos, ordenados por fecha", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");
    const other = await makeUser(t, "user", "Otro");
    const now = Date.now();
    const later = await insertEvent(t, org.id, { title: "Después", startsAt: now + 3 * DAY, endsAt: now + 3 * DAY + HOUR });
    const sooner = await insertEvent(t, org.id, { title: "Antes", startsAt: now + DAY, endsAt: now + DAY + HOUR });
    const willHide = await insertEvent(t, org.id, { title: "Se oculta" });
    const notMine = await insertEvent(t, org.id, { title: "De otro" });
    for (const eventId of [later, sooner, willHide]) {
      await fan.as.mutation(api.saves.toggle, { eventId });
    }
    await other.as.mutation(api.saves.toggle, { eventId: notMine });
    await t.run((ctx) => ctx.db.patch(willHide, { status: "hidden" }));

    const mine = await fan.as.query(api.saves.mySaved, {});
    expect(mine.map((e) => e.title)).toEqual(["Antes", "Después"]);
    expect(mine[0].organizer?.name).toBe("Org");
  });

  test("anónimo recibe una lista vacía", async () => {
    const t = setup();
    expect(await t.query(api.saves.mySaved, {})).toEqual([]);
  });
});
