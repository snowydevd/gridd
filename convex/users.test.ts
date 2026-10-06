import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { initNewUser } from "./lib/newUser";
import { expectCode, makeUser, setup } from "./test.helpers";

describe("users.me", () => {
  test("anónimo recibe null", async () => {
    const t = setup();
    expect(await t.query(api.users.me, {})).toBeNull();
  });

  test("devuelve el perfil con role por defecto", async () => {
    const t = setup();
    const { id, as } = await makeUser(t, undefined, "Lauti");
    expect(await as.query(api.users.me, {})).toMatchObject({
      _id: id,
      name: "Lauti",
      image: null,
      role: "user",
    });
  });
});

describe("users.updateProfile", () => {
  test("cambia el nombre con trim", async () => {
    const t = setup();
    const { id, as } = await makeUser(t);
    await as.mutation(api.users.updateProfile, { name: "  Nuevo  " });
    const user = await t.run((ctx) => ctx.db.get(id));
    expect(user?.name).toBe("Nuevo");
    expect(user?.updatedAt).toBeTypeOf("number");
  });

  test("anónimo no puede", async () => {
    const t = setup();
    await expectCode(t.mutation(api.users.updateProfile, { name: "Nuevo" }), "UNAUTHENTICATED");
  });
});

describe("users.setRole (internal)", () => {
  test("cambia el rol buscando por email, sin importar mayúsculas", async () => {
    const t = setup();
    const id = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Admin", email: "admin@gridd.uy" }),
    );
    await t.mutation(internal.users.setRole, { email: "ADMIN@gridd.uy", role: "admin" });
    expect((await t.run((ctx) => ctx.db.get(id)))?.role).toBe("admin");
  });

  test("email inexistente → NOT_FOUND", async () => {
    const t = setup();
    await expectCode(
      t.mutation(internal.users.setRole, { email: "nadie@gridd.uy", role: "admin" }),
      "NOT_FOUND",
    );
  });
});

describe("initNewUser", () => {
  test("a un usuario nuevo le pone role user", async () => {
    const t = setup();
    const id = await t.run((ctx) => ctx.db.insert("users", { email: "x@gridd.uy" }));
    await t.run((ctx) => initNewUser(ctx, { userId: id, existingUserId: null }));
    expect((await t.run((ctx) => ctx.db.get(id)))?.role).toBe("user");
  });

  test("no toca el rol de un usuario existente que vuelve a loguearse", async () => {
    const t = setup();
    const id = await t.run((ctx) =>
      ctx.db.insert("users", { email: "x@gridd.uy", role: "publisher" }),
    );
    await t.run((ctx) => initNewUser(ctx, { userId: id, existingUserId: id }));
    expect((await t.run((ctx) => ctx.db.get(id)))?.role).toBe("publisher");
  });
});
