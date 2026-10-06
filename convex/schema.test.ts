import { expect, test } from "vitest";
import { insertEvent, makeUser, setup } from "./test.helpers";

test("el harness inserta usuarios y eventos", async () => {
  const t = setup();
  const { id } = await makeUser(t, "publisher");
  const eventId = await insertEvent(t, id);
  const event = await t.run((ctx) => ctx.db.get(eventId));
  expect(event?.organizerId).toBe(id);
});
