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

describe("users.setSearchRadius", () => {
  test("por defecto el rango es 25 km", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    expect((await as.query(api.users.me, {}))?.searchRadius).toBe(25);
  });

  test("guarda un rango en km o todo el país", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    await as.mutation(api.users.setSearchRadius, { radius: 100 });
    expect((await as.query(api.users.me, {}))?.searchRadius).toBe(100);
    await as.mutation(api.users.setSearchRadius, { radius: "all" });
    expect((await as.query(api.users.me, {}))?.searchRadius).toBe("all");
  });

  test("rechaza rangos que no están en la lista", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    // @ts-expect-error 7 km no es una opción válida
    await expect(as.mutation(api.users.setSearchRadius, { radius: 7 })).rejects.toThrow();
  });

  test("anónimo no puede", async () => {
    const t = setup();
    await expectCode(t.mutation(api.users.setSearchRadius, { radius: 10 }), "UNAUTHENTICATED");
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
