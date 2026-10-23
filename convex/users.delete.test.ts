import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DAY, HOUR, expectCode, insertEvent, makeUser, setup, type T } from "./test.helpers";

const storeImage = (t: T) => t.run((ctx) => ctx.storage.store(new Blob(["img"])));

/** Crea cuenta, sesión, refresh token y código de verificación como los deja Convex Auth. */
async function insertAuth(t: T, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const accountId = await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: `${userId}@test.uy`,
    });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + DAY });
    const refreshId = await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + DAY });
    const codeId = await ctx.db.insert("authVerificationCodes", {
      accountId,
      provider: "password",
      code: "12345678",
      expirationTime: Date.now() + HOUR,
    });
    const verifierId = await ctx.db.insert("authVerifiers", { sessionId });
    return { accountId, sessionId, refreshId, codeId, verifierId };
  });
}

describe("users.deleteAccount", () => {
  test("anónimo → UNAUTHENTICATED", async () => {
    const t = setup();
    await expectCode(t.mutation(api.users.deleteAccount, {}), "UNAUTHENTICATED");
  });

  test("borra el usuario, su foto, autos, guardados, solicitudes y login", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "user");
    const avatarId = await storeImage(t);
    const auth = await insertAuth(t, userId);
    const { id: organizerId } = await makeUser(t, "publisher", "Org");
    const eventId = await insertEvent(t, organizerId);
    const ids = await t.run(async (ctx) => {
      await ctx.db.patch(userId, { avatarId });
      return {
        car: await ctx.db.insert("cars", { userId, make: "Subaru", model: "Impreza" }),
        save: await ctx.db.insert("saves", { userId, eventId }),
        request: await ctx.db.insert("publisherRequests", { userId, message: "Organizo meets", status: "pending" }),
      };
    });

    await as.mutation(api.users.deleteAccount, {});

    await t.run(async (ctx) => {
      expect(await ctx.db.get(userId)).toBeNull();
      expect(await ctx.db.system.get(avatarId)).toBeNull();
      for (const id of [ids.car, ids.save, ids.request]) expect(await ctx.db.get(id)).toBeNull();
      for (const id of Object.values(auth)) expect(await ctx.db.get(id)).toBeNull();
      // El evento ajeno sigue en pie.
      expect(await ctx.db.get(eventId)).not.toBeNull();
    });
  });

  test("saca sus anotaciones y descuenta el contador del evento", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "user");
    const { id: organizerId } = await makeUser(t, "publisher", "Org");
    const eventId = await insertEvent(t, organizerId, { attendeeCount: 5 });
    const attendanceId = await t.run((ctx) => ctx.db.insert("attendances", { userId, eventId }));

    await as.mutation(api.users.deleteAccount, {});

    await t.run(async (ctx) => {
      expect(await ctx.db.get(attendanceId)).toBeNull();
      expect((await ctx.db.get(eventId))?.attendeeCount).toBe(4);
    });
  });

  test("con eventos próximos publicados → CONFLICT y no borra nada", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    const eventId = await insertEvent(t, userId);

    await expectCode(as.mutation(api.users.deleteAccount, {}), "CONFLICT");

    await t.run(async (ctx) => {
      expect(await ctx.db.get(userId)).not.toBeNull();
      expect(await ctx.db.get(eventId)).not.toBeNull();
    });
  });

  test("un evento que está pasando ahora también bloquea", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    await insertEvent(t, userId, { startsAt: Date.now() - HOUR, endsAt: Date.now() + HOUR });
    await expectCode(as.mutation(api.users.deleteAccount, {}), "CONFLICT");
  });

  test("borra sus eventos pasados y cancelados, con portada, anotaciones y guardados de otros", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    const { id: otherId } = await makeUser(t, "user", "Beto");
    const imageId = await storeImage(t);
    const past = await insertEvent(t, userId, {
      startsAt: Date.now() - 2 * DAY,
      endsAt: Date.now() - 2 * DAY + 3 * HOUR,
      imageId,
    });
    const cancelled = await insertEvent(t, userId, { status: "cancelled" });
    const others = await t.run(async (ctx) => ({
      attendance: await ctx.db.insert("attendances", { userId: otherId, eventId: past }),
      save: await ctx.db.insert("saves", { userId: otherId, eventId: cancelled }),
    }));

    await as.mutation(api.users.deleteAccount, {});

    await t.run(async (ctx) => {
      for (const id of [past, cancelled]) expect(await ctx.db.get(id)).toBeNull();
      expect(await ctx.db.system.get(imageId)).toBeNull();
      expect(await ctx.db.get(others.attendance)).toBeNull();
      expect(await ctx.db.get(others.save)).toBeNull();
      expect(await ctx.db.get(otherId)).not.toBeNull();
    });
  });

  test("un admin que revisó solicitudes: quedan sin revisor", async () => {
    const t = setup();
    const { id: adminId, as } = await makeUser(t, "admin");
    const { id: otherId } = await makeUser(t, "user", "Beto");
    const requestId = await t.run((ctx) =>
      ctx.db.insert("publisherRequests", {
        userId: otherId,
        message: "Organizo meets",
        status: "approved",
        reviewedBy: adminId,
        reviewedAt: Date.now(),
      }),
    );

    await as.mutation(api.users.deleteAccount, {});

    const request = await t.run((ctx) => ctx.db.get(requestId));
    expect(request).toMatchObject({ status: "approved" });
    expect(request?.reviewedBy).toBeUndefined();
  });

  test("borra a quién seguía y quiénes lo seguían", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    const { id: otherId } = await makeUser(t, "publisher", "Beto");
    const ids = await t.run(async (ctx) => ({
      following: await ctx.db.insert("follows", { followerId: userId, organizerId: otherId }),
      follower: await ctx.db.insert("follows", { followerId: otherId, organizerId: userId }),
    }));

    await as.mutation(api.users.deleteAccount, {});

    await t.run(async (ctx) => {
      expect(await ctx.db.get(ids.following)).toBeNull();
      expect(await ctx.db.get(ids.follower)).toBeNull();
    });
  });

  test("borra sus reportes y los que recibieron sus eventos; los que resolvió quedan sin resolvedor", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "admin");
    const { id: otherId } = await makeUser(t, "publisher", "Beto");
    const own = await insertEvent(t, userId, { status: "cancelled" });
    const others = await insertEvent(t, otherId);
    const ids = await t.run(async (ctx) => ({
      byUser: await ctx.db.insert("reports", { reporterId: userId, eventId: others, reason: "spam", status: "pending" }),
      aboutUser: await ctx.db.insert("reports", {
        reporterId: otherId,
        reportedUserId: userId,
        reason: "spam",
        status: "pending",
      }),
      onOwn: await ctx.db.insert("reports", { reporterId: otherId, eventId: own, reason: "fake", status: "pending" }),
      resolved: await ctx.db.insert("reports", {
        reporterId: otherId,
        eventId: others,
        reason: "other",
        status: "resolved",
        resolvedBy: userId,
        resolvedAt: Date.now(),
      }),
    }));

    await as.mutation(api.users.deleteAccount, {});

    await t.run(async (ctx) => {
      expect(await ctx.db.get(ids.byUser)).toBeNull();
      expect(await ctx.db.get(ids.onOwn)).toBeNull();
      expect(await ctx.db.get(ids.aboutUser)).toBeNull();
      const resolved = await ctx.db.get(ids.resolved);
      expect(resolved).toMatchObject({ status: "resolved" });
      expect(resolved?.resolvedBy).toBeUndefined();
    });
  });
});
