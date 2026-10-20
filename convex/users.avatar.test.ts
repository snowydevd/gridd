import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { AVATAR_MAX_BYTES } from "./lib/avatar";
import { expectCode, insertEvent, makeUser, setup, type T } from "./test.helpers";

/**
 * Sube un archivo como lo haría la app. convex-test no guarda el Content-Type del blob
 * (Convex sí, desde el header del POST), así que se completa a mano.
 */
async function upload(t: T, contentType = "image/jpeg", size = 3) {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob([new Uint8Array(size)], { type: contentType }));
    await (ctx.db as unknown as { patch: (id: Id<"_storage">, v: object) => Promise<void> }).patch(id, { contentType });
    return id;
  });
}

const urlOf = (t: T, id: Id<"_storage">) => t.run((ctx) => ctx.storage.getUrl(id));
const exists = (t: T, id: Id<"_storage">) => t.run(async (ctx) => (await ctx.db.system.get(id)) !== null);

describe("files.generateAvatarUploadUrl", () => {
  test("anónimo no puede", async () => {
    const t = setup();
    await expectCode(t.mutation(api.files.generateAvatarUploadUrl, {}), "UNAUTHENTICATED");
  });

  test("cualquier usuario logueado recibe una URL", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    expect(await as.mutation(api.files.generateAvatarUploadUrl, {})).toBeTypeOf("string");
  });
});

describe("users.setAvatar", () => {
  test("guarda la foto y users.me la muestra", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const storageId = await upload(t);
    await as.mutation(api.users.setAvatar, { storageId });
    const me = await as.query(api.users.me, {});
    expect(me?.hasAvatar).toBe(true);
    expect(me?.image).toBe(await urlOf(t, storageId));
  });

  test("la foto subida tiene prioridad sobre la del login social, y al quitarla vuelve esa", async () => {
    const t = setup();
    const { id, as } = await makeUser(t);
    await t.run((ctx) => ctx.db.patch(id, { image: "https://google.com/foto.jpg" }));
    const storageId = await upload(t);
    await as.mutation(api.users.setAvatar, { storageId });
    expect((await as.query(api.users.me, {}))?.image).toBe(await urlOf(t, storageId));

    await as.mutation(api.users.removeAvatar, {});
    const me = await as.query(api.users.me, {});
    expect(me?.image).toBe("https://google.com/foto.jpg");
    expect(me?.hasAvatar).toBe(false);
    expect(await exists(t, storageId)).toBe(false);
  });

  test("reemplazar la foto borra la anterior", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const first = await upload(t);
    const second = await upload(t, "image/png");
    await as.mutation(api.users.setAvatar, { storageId: first });
    await as.mutation(api.users.setAvatar, { storageId: second });
    expect(await exists(t, first)).toBe(false);
    expect(await exists(t, second)).toBe(true);
  });

  test("volver a guardar la misma foto no la borra", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const storageId = await upload(t);
    await as.mutation(api.users.setAvatar, { storageId });
    await as.mutation(api.users.setAvatar, { storageId });
    expect(await exists(t, storageId)).toBe(true);
  });

  test("tipo inválido → INVALID y no cambia la foto", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const storageId = await upload(t, "text/plain");
    await expectCode(as.mutation(api.users.setAvatar, { storageId }), "INVALID");
    expect((await as.query(api.users.me, {}))?.hasAvatar).toBe(false);
  });

  test("más de 2 MB → INVALID", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const storageId = await upload(t, "image/jpeg", AVATAR_MAX_BYTES + 1);
    await expectCode(as.mutation(api.users.setAvatar, { storageId }), "INVALID");
  });

  test("2 MB justos se aceptan", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const storageId = await upload(t, "image/webp", AVATAR_MAX_BYTES);
    await as.mutation(api.users.setAvatar, { storageId });
    expect((await as.query(api.users.me, {}))?.hasAvatar).toBe(true);
  });

  test("archivo inexistente → INVALID", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    const storageId = await upload(t);
    await t.run((ctx) => ctx.storage.delete(storageId));
    await expectCode(as.mutation(api.users.setAvatar, { storageId }), "INVALID");
  });

  test("no puede tomar la foto de otro usuario, y la del otro no se borra", async () => {
    const t = setup();
    const ana = await makeUser(t, undefined, "Ana");
    const beto = await makeUser(t, undefined, "Beto");
    const storageId = await upload(t);
    await ana.as.mutation(api.users.setAvatar, { storageId });
    await expectCode(beto.as.mutation(api.users.setAvatar, { storageId }), "FORBIDDEN");
    expect(await exists(t, storageId)).toBe(true);
  });

  test("no puede tomar un archivo ajeno aunque sea inválido: no lo borra", async () => {
    const t = setup();
    const { id: organizerId } = await makeUser(t, "publisher", "Org");
    const { as } = await makeUser(t);
    const imageId = await upload(t, "image/gif");
    await insertEvent(t, organizerId, { imageId });
    await expectCode(as.mutation(api.users.setAvatar, { storageId: imageId }), "FORBIDDEN");
    expect(await exists(t, imageId)).toBe(true);
  });

  test("anónimo no puede", async () => {
    const t = setup();
    const storageId = await upload(t);
    await expectCode(t.mutation(api.users.setAvatar, { storageId }), "UNAUTHENTICATED");
  });
});

describe("users.removeAvatar", () => {
  test("sin foto propia no hace nada", async () => {
    const t = setup();
    const { as } = await makeUser(t);
    await as.mutation(api.users.removeAvatar, {});
    expect((await as.query(api.users.me, {}))?.hasAvatar).toBe(false);
  });

  test("anónimo no puede", async () => {
    const t = setup();
    await expectCode(t.mutation(api.users.removeAvatar, {}), "UNAUTHENTICATED");
  });
});

describe("eventos", () => {
  test("el organizador se muestra con su foto subida", async () => {
    const t = setup();
    const org = await makeUser(t, "publisher", "Org");
    const storageId = await upload(t);
    await org.as.mutation(api.users.setAvatar, { storageId });
    const eventId = await insertEvent(t, org.id);
    const slug = (await t.run((ctx) => ctx.db.get(eventId)))!.slug;
    const event = await t.query(api.events.getBySlug, { slug });
    expect(event?.organizer?.image).toBe(await urlOf(t, storageId));
  });
});
