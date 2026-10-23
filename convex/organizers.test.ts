import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { DAY, HOUR, expectCode, insertEvent, makeUser, setup } from "./test.helpers";

describe("organizers.get", () => {
  test("devuelve nombre, foto, seguidores y sólo sus eventos publicados, próximos primero", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const past = await insertEvent(t, org.id, {
      title: "Pasado",
      startsAt: Date.now() - 2 * DAY,
      endsAt: Date.now() - 2 * DAY + 3 * HOUR,
    });
    const later = await insertEvent(t, org.id, { title: "Después", startsAt: Date.now() + 5 * DAY, endsAt: Date.now() + 5 * DAY + HOUR });
    const soon = await insertEvent(t, org.id, { title: "Pronto" });
    await insertEvent(t, org.id, { status: "cancelled" });
    await insertEvent(t, org.id, { status: "hidden" });

    const profile = await t.query(api.organizers.get, { userId: org.id });
    expect(profile).toMatchObject({ _id: org.id, name: "Org", image: null, verified: true, followerCount: 0, isFollowing: false });
    expect(profile?.upcoming.map((e) => e._id)).toEqual([soon, later]);
    expect(profile?.past.map((e) => e._id)).toEqual([past]);
  });

  test("un usuario común no tiene perfil público → null", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    expect(await t.query(api.organizers.get, { userId: user.id })).toBeNull();
  });

  test("usuario inexistente → null", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    await t.run((ctx) => ctx.db.delete(org.id));
    expect(await t.query(api.organizers.get, { userId: org.id })).toBeNull();
  });
});

describe("follows.toggle", () => {
  test("seguir y dejar de seguir actualiza seguidores e isFollowing", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const fan = await makeUser(t, "user", "Fan");

    expect(await fan.as.mutation(api.follows.toggle, { organizerId: org.id })).toEqual({ following: true });
    expect(await fan.as.query(api.organizers.get, { userId: org.id })).toMatchObject({
      followerCount: 1,
      isFollowing: true,
    });

    expect(await fan.as.mutation(api.follows.toggle, { organizerId: org.id })).toEqual({ following: false });
    expect(await fan.as.query(api.organizers.get, { userId: org.id })).toMatchObject({
      followerCount: 0,
      isFollowing: false,
    });
  });

  test("anónimo → UNAUTHENTICATED", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    await expectCode(t.mutation(api.follows.toggle, { organizerId: org.id }), "UNAUTHENTICATED");
  });

  test("no te podés seguir a vos mismo", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    await expectCode(org.as.mutation(api.follows.toggle, { organizerId: org.id }), "INVALID");
  });

  test("sólo se sigue a organizadores", async () => {
    const t = setup();
    const user = await makeUser(t, "user", "Comun");
    const fan = await makeUser(t, "user", "Fan");
    await expectCode(fan.as.mutation(api.follows.toggle, { organizerId: user.id }), "INVALID");
  });
});
