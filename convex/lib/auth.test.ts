import { describe, expect, test } from "vitest";
import { expectCode, makeUser, setup } from "../test.helpers";
import { requireAdmin, requirePublisher, requireUser, roleOf } from "./auth";

describe("guards", () => {
  test("anónimo no pasa requireUser", async () => {
    const t = setup();
    await expectCode(t.run((ctx) => requireUser(ctx)), "UNAUTHENTICATED");
  });

  test("role vacío se trata como user", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const user = await as.run((ctx) => requireUser(ctx));
    expect(roleOf(user)).toBe("user");
    await expectCode(as.run((ctx) => requirePublisher(ctx)), "FORBIDDEN");
  });

  test("publisher pasa requirePublisher pero no requireAdmin", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    await as.run((ctx) => requirePublisher(ctx));
    await expectCode(as.run((ctx) => requireAdmin(ctx)), "FORBIDDEN");
  });

  test("admin pasa todo", async () => {
    const t = setup();
    const { as } = await makeUser(t, "admin");
    await as.run((ctx) => requirePublisher(ctx));
    await as.run((ctx) => requireAdmin(ctx));
  });
});
