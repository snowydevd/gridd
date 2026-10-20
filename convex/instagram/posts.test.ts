import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { HOUR, type T, expectCode, makeUser, setup } from "../test.helpers";
import { MAX_ATTEMPTS, RETRY_DELAY } from "./posts";

async function draft(t: T, overrides: { scheduledAt?: number; batchId?: string } = {}) {
  const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["jpeg"])));
  return await t.mutation(internal.instagram.posts.createDraft, {
    caption: "Encontrá todos los car meets de Uruguay en Gridd.",
    angle: "descubrir-meets",
    images: [imageId],
    ...overrides,
  });
}

async function approved(t: T, scheduledAt = Date.now() - 1000) {
  const postId = await draft(t, { scheduledAt });
  await t.run((ctx) => ctx.db.patch(postId, { status: "approved" }));
  return postId;
}

const get = (t: T, postId: Id<"igPosts">) => t.run((ctx) => ctx.db.get(postId));

describe("igPosts internos", () => {
  test("createDraft arranca en draft con 0 intentos", async () => {
    const t = setup();
    const postId = await draft(t, { batchId: "b1" });
    expect(await get(t, postId)).toMatchObject({ status: "draft", attempts: 0, batchId: "b1" });
  });

  test("createDraft rechaza 0 u 11 imágenes", async () => {
    const t = setup();
    const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["jpeg"])));
    const base = { caption: "x", angle: "a" };
    await expectCode(t.mutation(internal.instagram.posts.createDraft, { ...base, images: [] }), "INVALID");
    await expectCode(
      t.mutation(internal.instagram.posts.createDraft, { ...base, images: Array(11).fill(imageId) }),
      "INVALID",
    );
  });

  test("markPublishing sólo toma posts approved, una sola vez", async () => {
    const t = setup();
    const postId = await approved(t);
    const [a, b] = await Promise.all([
      t.mutation(internal.instagram.posts.markPublishing, { postId }),
      t.mutation(internal.instagram.posts.markPublishing, { postId }),
    ]);
    expect([a, b].filter((x) => x !== null)).toHaveLength(1);
    expect((await get(t, postId))?.status).toBe("publishing");

    const draftId = await draft(t, { scheduledAt: Date.now() - 1000 });
    expect(await t.mutation(internal.instagram.posts.markPublishing, { postId: draftId })).toBeNull();
    expect((await get(t, draftId))?.status).toBe("draft");
  });

  test("markPublished guarda IDs, permalink y publishedAt", async () => {
    const t = setup();
    const postId = await approved(t);
    await t.mutation(internal.instagram.posts.markPublishing, { postId });
    await t.mutation(internal.instagram.posts.markPublished, {
      postId,
      igMediaId: "m1",
      permalink: "https://instagram.com/p/x",
    });
    const post = await get(t, postId);
    expect(post).toMatchObject({ status: "published", igMediaId: "m1", permalink: "https://instagram.com/p/x" });
    expect(post?.publishedAt).toBeTypeOf("number");
  });

  test("markFailed reintenta en 30 min hasta MAX_ATTEMPTS y después queda failed", async () => {
    const t = setup();
    const postId = await approved(t);
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      await t.mutation(internal.instagram.posts.markPublishing, { postId });
      const before = Date.now();
      await t.mutation(internal.instagram.posts.markFailed, { postId, error: `Meta dijo ${i}` });
      const post = await get(t, postId);
      expect(post).toMatchObject({ attempts: i, lastError: `Meta dijo ${i}` });
      if (i < MAX_ATTEMPTS) {
        expect(post?.status).toBe("approved");
        expect(post!.scheduledAt!).toBeGreaterThanOrEqual(before + RETRY_DELAY);
        // Lo dejamos vencido para el siguiente intento.
        await t.run((ctx) => ctx.db.patch(postId, { scheduledAt: Date.now() - 1 }));
      } else {
        expect(post?.status).toBe("failed");
      }
    }
  });

  test("dueApproved devuelve sólo approved vencidos", async () => {
    const t = setup();
    const due = await approved(t, Date.now() - HOUR);
    await approved(t, Date.now() + HOUR);
    await draft(t, { scheduledAt: Date.now() - HOUR });
    const rows = await t.query(internal.instagram.posts.dueApproved, {});
    expect(rows.map((p) => p._id)).toEqual([due]);
  });
});

describe("igPosts admin", () => {
  test("sólo un admin puede listar, aprobar, rechazar, reprogramar y editar", async () => {
    const t = setup();
    const postId = await draft(t);
    const pub = await makeUser(t, "publisher");
    await expectCode(pub.as.query(api.instagram.posts.listByStatus, { status: "draft" }), "FORBIDDEN");
    await expectCode(
      pub.as.mutation(api.instagram.posts.approve, { postId, scheduledAt: Date.now() + HOUR }),
      "FORBIDDEN",
    );
    await expectCode(pub.as.mutation(api.instagram.posts.reject, { postId }), "FORBIDDEN");
    await expectCode(
      pub.as.mutation(api.instagram.posts.reschedule, { postId, scheduledAt: Date.now() }),
      "FORBIDDEN",
    );
    await expectCode(pub.as.mutation(api.instagram.posts.updateCaption, { postId, caption: "hola" }), "FORBIDDEN");
    await expectCode(t.query(api.instagram.posts.listByStatus, { status: "draft" }), "UNAUTHENTICATED");
  });

  test("listByStatus devuelve el post con URLs de imagen y sin campos de credenciales", async () => {
    const t = setup();
    const postId = await draft(t);
    const admin = await makeUser(t, "admin", "Admin");
    const rows = await admin.as.query(api.instagram.posts.listByStatus, { status: "draft" });
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(postId);
    expect(rows[0].imageUrls).toHaveLength(1);
    expect(rows[0].imageUrls[0]).toMatch(/^https?:\/\//);
    expect(JSON.stringify(rows)).not.toMatch(/accessToken/);
  });

  test("approve pasa draft → approved con fecha; sin fecha → INVALID", async () => {
    const t = setup();
    const admin = await makeUser(t, "admin", "Admin");
    const noDate = await draft(t);
    await expectCode(admin.as.mutation(api.instagram.posts.approve, { postId: noDate }), "INVALID");

    const postId = await draft(t, { scheduledAt: Date.now() + HOUR });
    await admin.as.mutation(api.instagram.posts.approve, { postId });
    expect((await get(t, postId))?.status).toBe("approved");

    const other = await draft(t);
    const when = Date.now() + 2 * HOUR;
    await admin.as.mutation(api.instagram.posts.approve, { postId: other, scheduledAt: when });
    expect(await get(t, other)).toMatchObject({ status: "approved", scheduledAt: when });
  });

  test("approve de un failed resetea intentos y error", async () => {
    const t = setup();
    const admin = await makeUser(t, "admin", "Admin");
    const postId = await draft(t, { scheduledAt: Date.now() });
    await t.run((ctx) => ctx.db.patch(postId, { status: "failed", attempts: 3, lastError: "boom" }));
    await admin.as.mutation(api.instagram.posts.approve, { postId });
    const post = await get(t, postId);
    expect(post).toMatchObject({ status: "approved", attempts: 0 });
    expect(post?.lastError).toBeUndefined();
  });

  test("no se puede tocar un post publicando o publicado", async () => {
    const t = setup();
    const admin = await makeUser(t, "admin", "Admin");
    const postId = await draft(t, { scheduledAt: Date.now() });
    for (const status of ["publishing", "published"] as const) {
      await t.run((ctx) => ctx.db.patch(postId, { status }));
      await expectCode(admin.as.mutation(api.instagram.posts.approve, { postId }), "CONFLICT");
      await expectCode(admin.as.mutation(api.instagram.posts.reject, { postId }), "CONFLICT");
      await expectCode(
        admin.as.mutation(api.instagram.posts.reschedule, { postId, scheduledAt: Date.now() }),
        "CONFLICT",
      );
      await expectCode(
        admin.as.mutation(api.instagram.posts.updateCaption, { postId, caption: "nuevo" }),
        "CONFLICT",
      );
    }
  });

  test("reject, reschedule y updateCaption", async () => {
    const t = setup();
    const admin = await makeUser(t, "admin", "Admin");
    const postId = await draft(t);
    const when = Date.now() + 3 * HOUR;
    await admin.as.mutation(api.instagram.posts.reschedule, { postId, scheduledAt: when });
    await admin.as.mutation(api.instagram.posts.updateCaption, { postId, caption: "  Nuevo copy  " });
    expect(await get(t, postId)).toMatchObject({ scheduledAt: when, caption: "Nuevo copy" });
    await expectCode(admin.as.mutation(api.instagram.posts.updateCaption, { postId, caption: " " }), "INVALID");
    await admin.as.mutation(api.instagram.posts.reject, { postId });
    expect((await get(t, postId))?.status).toBe("rejected");
  });
});
