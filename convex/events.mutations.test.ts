import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { DAY, HOUR, expectCode, insertEvent, makeUser, setup, type T } from "./test.helpers";

function validInput() {
  const startsAt = Date.now() + 2 * DAY;
  return {
    title: "Cars & Coffee Carrasco",
    description: "Café y fierros",
    kind: "cars_and_coffee" as const,
    startsAt,
    endsAt: startsAt + 3 * HOUR,
    placeName: "Rambla de Carrasco",
    lat: -34.88,
    lon: -56.05,
  };
}

const storeImage = (t: T) => t.run((ctx) => ctx.storage.store(new Blob(["img"])));

describe("events.create", () => {
  test("un publisher crea un evento publicado con slug", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    const { id, slug } = await as.mutation(api.events.create, validInput());
    expect(slug).toMatch(/^cars-coffee-carrasco-\d{4}-\d{2}-\d{2}$/);
    const event = await t.run((ctx) => ctx.db.get(id));
    expect(event).toMatchObject({
      status: "published",
      attendeeCount: 0,
      organizerId: userId,
    });
  });

  test("dos eventos con el mismo título y fecha tienen slugs distintos", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const input = validInput();
    const a = await as.mutation(api.events.create, input);
    const b = await as.mutation(api.events.create, input);
    expect(b.slug).toBe(`${a.slug}-2`);
  });

  test("un user común no puede publicar", async () => {
    const t = setup();
    const { as } = await makeUser(t, "user");
    await expectCode(as.mutation(api.events.create, validInput()), "FORBIDDEN");
  });

  test("anónimo no puede publicar", async () => {
    const t = setup();
    await expectCode(t.mutation(api.events.create, validInput()), "UNAUTHENTICATED");
  });

  test("valida el input", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    await expectCode(as.mutation(api.events.create, { ...validInput(), lat: 10 }), "INVALID");
  });

  test("imageId de un archivo inexistente → INVALID", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const imageId = await storeImage(t);
    await t.run((ctx) => ctx.storage.delete(imageId));
    await expectCode(as.mutation(api.events.create, { ...validInput(), imageId }), "INVALID");
  });
});

describe("events.update", () => {
  test("el organizador edita y el slug no cambia", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const { id, slug } = await as.mutation(api.events.create, validInput());
    await as.mutation(api.events.update, { id, title: "Otro título" });
    const event = await t.run((ctx) => ctx.db.get(id));
    expect(event?.title).toBe("Otro título");
    expect(event?.slug).toBe(slug);
  });

  test("otro publisher no puede editar", async () => {
    const t = setup();
    const owner = await makeUser(t, "publisher", "Owner");
    const other = await makeUser(t, "publisher", "Other");
    const { id } = await owner.as.mutation(api.events.create, validInput());
    await expectCode(other.as.mutation(api.events.update, { id, title: "Hack" }), "FORBIDDEN");
  });

  test("se puede editar el título de un evento que ya empezó", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    const id = await insertEvent(t, userId, {
      startsAt: Date.now() - HOUR,
      endsAt: Date.now() + 2 * HOUR,
    });
    await as.mutation(api.events.update, { id, title: "Seguimos acá" });
    expect((await t.run((ctx) => ctx.db.get(id)))?.title).toBe("Seguimos acá");
  });

  test("mover la fecha al pasado → INVALID", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const { id } = await as.mutation(api.events.create, validInput());
    await expectCode(
      as.mutation(api.events.update, {
        id,
        startsAt: Date.now() - DAY,
        endsAt: Date.now() - DAY + HOUR,
      }),
      "INVALID",
    );
  });

  test("no se edita un evento cancelado", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const { id } = await as.mutation(api.events.create, validInput());
    await as.mutation(api.events.cancel, { id });
    await expectCode(as.mutation(api.events.update, { id, title: "Vuelve" }), "INVALID");
  });

  test("un update sin imagen no borra la imagen actual", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const imageId = await storeImage(t);
    const { id } = await as.mutation(api.events.create, { ...validInput(), imageId });
    await as.mutation(api.events.update, { id, title: "Nuevo título" });
    expect(await t.run((ctx) => ctx.db.system.get(imageId))).not.toBeNull();
    expect((await t.run((ctx) => ctx.db.get(id)))?.imageId).toBe(imageId);
  });

  test("reemplazar la imagen borra la anterior", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const oldImage = await storeImage(t);
    const newImage = await storeImage(t);
    const { id } = await as.mutation(api.events.create, { ...validInput(), imageId: oldImage });
    await as.mutation(api.events.update, { id, imageId: newImage });
    expect(await t.run((ctx) => ctx.db.system.get(oldImage))).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(id)))?.imageId).toBe(newImage);
  });

  test("removeImage saca y borra la imagen", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const imageId = await storeImage(t);
    const { id } = await as.mutation(api.events.create, { ...validInput(), imageId });
    await as.mutation(api.events.update, { id, removeImage: true });
    expect(await t.run((ctx) => ctx.db.system.get(imageId))).toBeNull();
    expect((await t.run((ctx) => ctx.db.get(id)))?.imageId).toBeUndefined();
  });
});

describe("events.cancel / hide / unhide", () => {
  test("el organizador cancela; cancelar dos veces → INVALID", async () => {
    const t = setup();
    const { as } = await makeUser(t, "publisher");
    const { id } = await as.mutation(api.events.create, validInput());
    await as.mutation(api.events.cancel, { id });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("cancelled");
    await expectCode(as.mutation(api.events.cancel, { id }), "INVALID");
  });

  test("evento inexistente → NOT_FOUND", async () => {
    const t = setup();
    const { id: userId, as } = await makeUser(t, "publisher");
    const id = await insertEvent(t, userId);
    await t.run((ctx) => ctx.db.delete(id));
    await expectCode(as.mutation(api.events.cancel, { id }), "NOT_FOUND");
  });

  test("sólo admin oculta y vuelve a mostrar", async () => {
    const t = setup();
    const pub = await makeUser(t, "publisher");
    const admin = await makeUser(t, "admin", "Admin");
    const { id } = await pub.as.mutation(api.events.create, validInput());
    await expectCode(pub.as.mutation(api.events.hide, { id }), "FORBIDDEN");
    await admin.as.mutation(api.events.hide, { id });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("hidden");
    await expectCode(pub.as.mutation(api.events.update, { id, title: "x y z" }), "INVALID");
    await admin.as.mutation(api.events.unhide, { id });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("published");
  });
});

describe("files.generateUploadUrl", () => {
  test("sólo publishers", async () => {
    const t = setup();
    const user = await makeUser(t, "user");
    const pub = await makeUser(t, "publisher", "Pub");
    await expectCode(user.as.mutation(api.files.generateUploadUrl, {}), "FORBIDDEN");
    expect(await pub.as.mutation(api.files.generateUploadUrl, {})).toBeTypeOf("string");
  });
});
