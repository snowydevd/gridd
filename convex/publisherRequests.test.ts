import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { expectCode, makeUser, setup } from "./test.helpers";

const MSG = "Organizo la junada de los jueves en Pocitos, @juntadapocitos";

describe("publisherRequests", () => {
  test("flujo completo: submit → listPending → approve cambia el rol", async () => {
    const t = setup();
    const user = await makeUser(t, "user", "Lauti");
    const admin = await makeUser(t, "admin", "Admin");

    const requestId = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    const pending = await admin.as.query(api.publisherRequests.listPending, {});
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ _id: requestId, user: { name: "Lauti" } });

    await admin.as.mutation(api.publisherRequests.approve, { requestId });
    expect((await user.as.query(api.users.me, {}))?.role).toBe("publisher");
    expect(await user.as.query(api.publisherRequests.mine, {})).toMatchObject({
      status: "approved",
      reviewedBy: admin.id,
    });
    expect(await admin.as.query(api.publisherRequests.listPending, {})).toHaveLength(0);
  });

  test("no se puede tener dos solicitudes pendientes", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    await expectCode(user.as.mutation(api.publisherRequests.submit, { message: MSG }), "CONFLICT");
  });

  test("un publisher no puede pedir otra vez", async () => {
    const t = setup();
    const pub = await makeUser(t, "publisher");
    await expectCode(pub.as.mutation(api.publisherRequests.submit, { message: MSG }), "CONFLICT");
  });

  test("rechazada se puede volver a pedir; mine devuelve la última", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const first = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    await admin.as.mutation(api.publisherRequests.reject, { requestId: first });
    expect((await user.as.query(api.users.me, {}))?.role).toBe("user");
    const second = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    expect((await user.as.query(api.publisherRequests.mine, {}))?._id).toBe(second);
  });

  test("aprobar o rechazar algo ya resuelto → CONFLICT", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const requestId = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    await admin.as.mutation(api.publisherRequests.approve, { requestId });
    await expectCode(admin.as.mutation(api.publisherRequests.reject, { requestId }), "CONFLICT");
    await expectCode(admin.as.mutation(api.publisherRequests.approve, { requestId }), "CONFLICT");
  });

  test("mensaje corto o largo → INVALID", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    await expectCode(user.as.mutation(api.publisherRequests.submit, { message: "  hola  " }), "INVALID");
    await expectCode(
      user.as.mutation(api.publisherRequests.submit, { message: "x".repeat(501) }),
      "INVALID",
    );
  });

  test("permisos: sólo admin lista, aprueba y rechaza; anónimo no pide", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    const requestId = await user.as.mutation(api.publisherRequests.submit, { message: MSG });
    await expectCode(user.as.query(api.publisherRequests.listPending, {}), "FORBIDDEN");
    await expectCode(user.as.mutation(api.publisherRequests.approve, { requestId }), "FORBIDDEN");
    await expectCode(user.as.mutation(api.publisherRequests.reject, { requestId }), "FORBIDDEN");
    await expectCode(t.mutation(api.publisherRequests.submit, { message: MSG }), "UNAUTHENTICATED");
  });

  test("mine sin solicitudes devuelve null", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    expect(await user.as.query(api.publisherRequests.mine, {})).toBeNull();
  });
});
