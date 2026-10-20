import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DAY, type T, setup } from "../test.helpers";

type Route = { method: string; match: RegExp; body: unknown; status?: number };

/** Mockea fetch con rutas de Meta; deja registradas las llamadas. */
function fakeMeta(routes: Route[]) {
  const calls: { method: string; url: string; body?: string }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body as string | undefined });
    const route = routes.find((r) => r.method === method && r.match.test(url));
    if (!route) return new Response(JSON.stringify({ error: { message: `sin ruta ${url}` } }), { status: 404 });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

async function approvedPost(t: T, images = 1, overrides: Record<string, unknown> = {}) {
  const ids = await t.run(async (ctx) => {
    const out: Id<"_storage">[] = [];
    for (let i = 0; i < images; i++) out.push(await ctx.storage.store(new Blob([`jpeg${i}`])));
    return out;
  });
  return await t.run((ctx) =>
    ctx.db.insert("igPosts", {
      caption: "Todos los car meets de Uruguay en un lugar. Descargá Gridd.",
      angle: "descubrir-meets",
      images: ids,
      status: "approved",
      scheduledAt: Date.now() - 1000,
      attempts: 0,
      ...overrides,
    }),
  );
}

const get = (t: T, postId: Id<"igPosts">) => t.run((ctx) => ctx.db.get(postId));

beforeEach(() => {
  vi.stubEnv("IG_GRAPH_VERSION", "v99.0");
  vi.stubEnv("IG_ACCESS_TOKEN", "SEED");
  vi.stubEnv("IG_USER_ID", "123");
  vi.stubEnv("IG_DRY_RUN", "false");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("credenciales", () => {
  test("getCredentials hace el seed desde env una sola vez", async () => {
    const t = setup();
    const first = await t.action(internal.instagram.client.getCredentials, {});
    expect(first).toMatchObject({ accessToken: "SEED", igUserId: "123" });
    vi.stubEnv("IG_ACCESS_TOKEN", "OTRO");
    const second = await t.action(internal.instagram.client.getCredentials, {});
    expect(second.accessToken).toBe("SEED");
    expect(await t.run((ctx) => ctx.db.query("igCredentials").collect())).toHaveLength(1);
  });

  test("sin env y sin dry-run, getCredentials falla con un mensaje claro", async () => {
    const t = setup();
    vi.stubEnv("IG_ACCESS_TOKEN", "");
    await expect(t.action(internal.instagram.client.getCredentials, {})).rejects.toThrow(/IG_ACCESS_TOKEN/);
  });

  test("refreshToken guarda el token nuevo y su vencimiento", async () => {
    const t = setup();
    const calls = fakeMeta([
      { method: "GET", match: /refresh_access_token/, body: { access_token: "NUEVO", expires_in: 60 * 86400 } },
    ]);
    await t.action(internal.instagram.client.refreshToken, {});
    const [row] = await t.run((ctx) => ctx.db.query("igCredentials").collect());
    expect(row.accessToken).toBe("NUEVO");
    expect(row.expiresAt).toBeGreaterThan(Date.now() + 59 * DAY);
    expect(calls[0].url).toMatch(/access_token=SEED/);
  });
});

describe("publishPost", () => {
  test("dry-run: approved vencido → published con IDs falsos y logs", async () => {
    const t = setup();
    vi.stubEnv("IG_DRY_RUN", "true");
    const fetchSpy = fakeMeta([]);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const postId = await approvedPost(t);
    await t.action(internal.instagram.client.publishPost, { postId });
    const post = await get(t, postId);
    expect(post).toMatchObject({ status: "published", attempts: 0 });
    expect(post?.igMediaId).toMatch(/^dry-/);
    expect(post?.containerId).toMatch(/^dry-/);
    expect(post?.permalink).toMatch(/^https:\/\/www\.instagram\.com\/p\//);
    expect(fetchSpy).toHaveLength(0);
    expect(log.mock.calls.flat().join("\n")).toMatch(/DRY RUN/);
  });

  test("carrusel real: items, contenedor CAROUSEL, espera y publica", async () => {
    const t = setup();
    let n = 0;
    const calls = fakeMeta([
      { method: "POST", match: /\/123\/media_publish$/, body: { id: "MEDIA" } },
      { method: "POST", match: /\/123\/media$/, get body() { return { id: `C${++n}` }; } },
      { method: "GET", match: /status_code/, body: { status_code: "FINISHED" } },
      { method: "GET", match: /fields=permalink/, body: { permalink: "https://www.instagram.com/p/xyz/" } },
    ]);
    const postId = await approvedPost(t, 3);
    await t.action(internal.instagram.client.publishPost, { postId });
    expect(await get(t, postId)).toMatchObject({
      status: "published",
      containerId: "C4",
      igMediaId: "MEDIA",
      permalink: "https://www.instagram.com/p/xyz/",
    });
    const carousel = calls.find((c) => c.body?.includes("CAROUSEL"));
    expect(JSON.parse(carousel!.body!)).toMatchObject({ children: "C1,C2,C3" });
    expect(calls.filter((c) => c.url.endsWith("media_publish"))).toHaveLength(1);
  });

  test("error de Meta: guarda el mensaje real y vuelve a approved para reintentar", async () => {
    const t = setup();
    fakeMeta([
      {
        method: "POST",
        match: /\/media$/,
        status: 400,
        body: { error: { message: "Only photo or video can be accepted as media type.", code: 9004, type: "OAuthException" } },
      },
    ]);
    const postId = await approvedPost(t);
    await t.action(internal.instagram.client.publishPost, { postId });
    const post = await get(t, postId);
    expect(post).toMatchObject({ status: "approved", attempts: 1 });
    expect(post?.lastError).toMatch(/9004.*Only photo or video/);
  });

  test("si falla el permalink, el post igual queda published", async () => {
    const t = setup();
    fakeMeta([
      { method: "POST", match: /media_publish$/, body: { id: "MEDIA" } },
      { method: "POST", match: /\/media$/, body: { id: "C1" } },
      { method: "GET", match: /status_code/, body: { status_code: "FINISHED" } },
    ]);
    const postId = await approvedPost(t);
    await t.action(internal.instagram.client.publishPost, { postId });
    const post = await get(t, postId);
    expect(post).toMatchObject({ status: "published", igMediaId: "MEDIA" });
    expect(post?.permalink).toBeUndefined();
  });

  test("si ya tiene igMediaId no republica", async () => {
    const t = setup();
    const calls = fakeMeta([]);
    const postId = await approvedPost(t, 1, { containerId: "C1", igMediaId: "YA" });
    await t.action(internal.instagram.client.publishPost, { postId });
    expect(await get(t, postId)).toMatchObject({ status: "published", igMediaId: "YA" });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  test("contenedor guardado que ya figura PUBLISHED: falla sin reintento ni republicar", async () => {
    const t = setup();
    const calls = fakeMeta([{ method: "GET", match: /status_code/, body: { status_code: "PUBLISHED" } }]);
    const postId = await approvedPost(t, 1, { containerId: "C1" });
    await t.action(internal.instagram.client.publishPost, { postId });
    const post = await get(t, postId);
    expect(post?.status).toBe("failed");
    expect(post?.lastError).toMatch(/revis/i);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  test("contenedor guardado FINISHED se reutiliza", async () => {
    const t = setup();
    const calls = fakeMeta([
      { method: "GET", match: /status_code/, body: { status_code: "FINISHED" } },
      { method: "POST", match: /media_publish$/, body: { id: "MEDIA" } },
      { method: "GET", match: /fields=permalink/, body: { permalink: "https://www.instagram.com/p/a/" } },
    ]);
    const postId = await approvedPost(t, 1, { containerId: "C1" });
    await t.action(internal.instagram.client.publishPost, { postId });
    expect((await get(t, postId))?.status).toBe("published");
    expect(calls.filter((c) => /\/media$/.test(c.url))).toHaveLength(0);
  });

  test("un draft nunca se publica, ni siquiera con publishTest", async () => {
    const t = setup();
    vi.stubEnv("IG_DRY_RUN", "true");
    const postId = await approvedPost(t, 1, { status: "draft" });
    const res = await t.action(internal.instagram.client.publishTest, { postId });
    expect(res.status).toBe("draft");
    expect((await get(t, postId))?.status).toBe("draft");
  });

  test("publishTest publica un approved aunque su fecha sea futura", async () => {
    const t = setup();
    vi.stubEnv("IG_DRY_RUN", "true");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const postId = await approvedPost(t, 1, { scheduledAt: Date.now() + DAY });
    const res = await t.action(internal.instagram.client.publishTest, { postId });
    expect(res.status).toBe("published");
  });
});
