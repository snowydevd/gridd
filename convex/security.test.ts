import { expect, test } from "vitest";
import { api } from "./_generated/api";
import { DAY, HOUR, expectCode, makeUser, setup } from "./test.helpers";

const input = () => {
  const startsAt = Date.now() + 2 * DAY;
  return { title: "Junada", description: "", kind: "junada" as const, startsAt, endsAt: startsAt + HOUR, placeName: "Pocitos", lat: -34.91, lon: -56.15 };
};

test("no se puede usar la imagen de un evento ajeno", async () => {
  const t = setup();
  const a = await makeUser(t, "publisher", "A");
  const b = await makeUser(t, "publisher", "B");
  const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["img"])));
  await a.as.mutation(api.events.create, { ...input(), imageId });
  await expectCode(b.as.mutation(api.events.create, { ...input(), imageId }), "FORBIDDEN");
  const { id } = await b.as.mutation(api.events.create, input());
  await expectCode(b.as.mutation(api.events.update, { id, imageId }), "FORBIDDEN");
});

test("aprobar una solicitud vieja no le baja el rol a un admin", async () => {
  const t = setup();
  const user = await makeUser(t, "user", "U");
  const admin = await makeUser(t, "admin", "Admin");
  const requestId = await user.as.mutation(api.publisherRequests.submit, { message: "Organizo junadas en Pocitos" });
  await t.run((ctx) => ctx.db.patch(user.id, { role: "admin" }));
  await admin.as.mutation(api.publisherRequests.approve, { requestId });
  expect((await t.run((ctx) => ctx.db.get(user.id)))?.role).toBe("admin");
});
