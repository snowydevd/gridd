import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { DAY, expectCode, insertEvent, makeUser, setup } from "./test.helpers";

describe("reports", () => {
  test("flujo completo: submit → listPending muestra evento, organizador y quién reportó", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const user = await makeUser(t, "user", "Lauti");
    const admin = await makeUser(t, "admin", "Admin");
    const eventId = await insertEvent(t, org.id);

    const reportId = await user.as.mutation(api.reports.submit, {
      eventId,
      reason: "fake",
      note: "  Esto no existe  ",
    });
    const pending = await admin.as.query(api.reports.listPending, {});
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      _id: reportId,
      reason: "fake",
      note: "Esto no existe",
      event: { _id: eventId, title: "Junada en la rambla", status: "published" },
      organizer: { name: "Org" },
      reporter: { name: "Lauti" },
    });
  });

  test("anónimo → UNAUTHENTICATED", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const eventId = await insertEvent(t, org.id);
    await expectCode(t.mutation(api.reports.submit, { eventId, reason: "spam" }), "UNAUTHENTICATED");
  });

  test("no podés reportar tu propio evento", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const eventId = await insertEvent(t, org.id);
    await expectCode(org.as.mutation(api.reports.submit, { eventId, reason: "spam" }), "INVALID");
  });

  test("un segundo reporte pendiente del mismo usuario al mismo evento → CONFLICT", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const user = await makeUser(t, "user");
    const eventId = await insertEvent(t, org.id);
    await user.as.mutation(api.reports.submit, { eventId, reason: "spam" });
    await expectCode(user.as.mutation(api.reports.submit, { eventId, reason: "offensive" }), "CONFLICT");
  });

  test("nota de más de 500 caracteres → INVALID", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const user = await makeUser(t, "user");
    const eventId = await insertEvent(t, org.id);
    await expectCode(
      user.as.mutation(api.reports.submit, { eventId, reason: "other", note: "x".repeat(501) }),
      "INVALID",
    );
  });

  test("listPending y resolve son sólo para admin", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const user = await makeUser(t, "user");
    const eventId = await insertEvent(t, org.id);
    const reportId = await user.as.mutation(api.reports.submit, { eventId, reason: "spam" });
    await expectCode(user.as.query(api.reports.listPending, {}), "FORBIDDEN");
    await expectCode(user.as.mutation(api.reports.resolve, { reportId, action: "dismiss" }), "FORBIDDEN");
  });

  test("resolver sin ocultar descarta todos los reportes pendientes del evento", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const a = await makeUser(t, "user", "A");
    const b = await makeUser(t, "user", "B");
    const admin = await makeUser(t, "admin", "Admin");
    const eventId = await insertEvent(t, org.id);
    const reportId = await a.as.mutation(api.reports.submit, { eventId, reason: "spam" });
    await b.as.mutation(api.reports.submit, { eventId, reason: "fake" });

    await admin.as.mutation(api.reports.resolve, { reportId, action: "dismiss" });
    expect(await admin.as.query(api.reports.listPending, {})).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(eventId)))?.status).toBe("published");
  });

  test("resolver ocultando el evento lo pasa a hidden", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const eventId = await insertEvent(t, org.id);
    const reportId = await user.as.mutation(api.reports.submit, { eventId, reason: "offensive" });

    await admin.as.mutation(api.reports.resolve, { reportId, action: "hide_event" });
    expect((await t.run((ctx) => ctx.db.get(eventId)))?.status).toBe("hidden");
    const report = await t.run((ctx) => ctx.db.get(reportId));
    expect(report).toMatchObject({ status: "resolved", resolvedBy: admin.id });
  });

  test("resolver algo ya resuelto → CONFLICT", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const eventId = await insertEvent(t, org.id);
    const reportId = await user.as.mutation(api.reports.submit, { eventId, reason: "spam" });
    await admin.as.mutation(api.reports.resolve, { reportId, action: "dismiss" });
    await expectCode(admin.as.mutation(api.reports.resolve, { reportId, action: "dismiss" }), "CONFLICT");
  });

  test("ya resuelto, el mismo usuario puede volver a reportar", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const eventId = await insertEvent(t, org.id);
    const reportId = await user.as.mutation(api.reports.submit, { eventId, reason: "spam" });
    await admin.as.mutation(api.reports.resolve, { reportId, action: "dismiss" });
    await user.as.mutation(api.reports.submit, { eventId, reason: "spam" });
    expect(await admin.as.query(api.reports.listPending, {})).toHaveLength(1);
  });
});

describe("reports de usuarios", () => {
  test("submitUser → listPending muestra al usuario reportado", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const user = await makeUser(t, "user", "Lauti");
    const admin = await makeUser(t, "admin", "Admin");

    const reportId = await user.as.mutation(api.reports.submitUser, { userId: org.id, reason: "fake" });
    const pending = await admin.as.query(api.reports.listPending, {});
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      _id: reportId,
      reason: "fake",
      event: null,
      reportedUser: { _id: org.id, name: "Org", role: "publisher" },
      reporter: { name: "Lauti" },
    });
  });

  test("no te podés reportar a vos mismo", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    await expectCode(user.as.mutation(api.reports.submitUser, { userId: user.id, reason: "spam" }), "INVALID");
  });

  test("un segundo reporte pendiente al mismo usuario → CONFLICT", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const user = await makeUser(t, "user");
    await user.as.mutation(api.reports.submitUser, { userId: org.id, reason: "spam" });
    await expectCode(user.as.mutation(api.reports.submitUser, { userId: org.id, reason: "fake" }), "CONFLICT");
  });

  test("revoke_publisher le saca el rol y oculta sus eventos próximos, no los pasados", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const upcoming = await insertEvent(t, org.id);
    const past = await insertEvent(t, org.id, { startsAt: Date.now() - 2 * DAY, endsAt: Date.now() - DAY });
    const reportId = await user.as.mutation(api.reports.submitUser, { userId: org.id, reason: "offensive" });

    await admin.as.mutation(api.reports.resolve, { reportId, action: "revoke_publisher" });
    await t.run(async (ctx) => {
      expect((await ctx.db.get(org.id))?.role).toBe("user");
      expect((await ctx.db.get(upcoming))?.status).toBe("hidden");
      expect((await ctx.db.get(past))?.status).toBe("published");
      expect((await ctx.db.get(reportId))?.status).toBe("resolved");
    });
  });

  test("revoke_publisher a un admin → INVALID", async () => {
    const t = setup();
    const other = await makeUser(t, "admin", "Otro");
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const reportId = await user.as.mutation(api.reports.submitUser, { userId: other.id, reason: "spam" });
    await expectCode(admin.as.mutation(api.reports.resolve, { reportId, action: "revoke_publisher" }), "INVALID");
  });

  test("hide_event en un reporte de usuario → INVALID; revoke_publisher en uno de evento también", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const user = await makeUser(t, "user");
    const admin = await makeUser(t, "admin", "Admin");
    const eventId = await insertEvent(t, org.id);
    const userReport = await user.as.mutation(api.reports.submitUser, { userId: org.id, reason: "spam" });
    const eventReport = await user.as.mutation(api.reports.submit, { eventId, reason: "spam" });
    await expectCode(admin.as.mutation(api.reports.resolve, { reportId: userReport, action: "hide_event" }), "INVALID");
    await expectCode(
      admin.as.mutation(api.reports.resolve, { reportId: eventReport, action: "revoke_publisher" }),
      "INVALID",
    );
  });

  test("descartar resuelve todos los pendientes sobre ese usuario", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher");
    const a = await makeUser(t, "user", "A");
    const b = await makeUser(t, "user", "B");
    const admin = await makeUser(t, "admin", "Admin");
    const reportId = await a.as.mutation(api.reports.submitUser, { userId: org.id, reason: "spam" });
    await b.as.mutation(api.reports.submitUser, { userId: org.id, reason: "fake" });
    await admin.as.mutation(api.reports.resolve, { reportId, action: "dismiss" });
    expect(await admin.as.query(api.reports.listPending, {})).toHaveLength(0);
  });
});
