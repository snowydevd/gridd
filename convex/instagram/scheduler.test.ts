import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DAY, HOUR, type T, setup } from "../test.helpers";
import { MAX_ATTEMPTS } from "./posts";

/** Meta falso: cuenta publicaciones y refreshes; `fail` hace fallar la creación de contenedores. */
function fakeMeta(opts: { fail?: boolean; refreshFails?: boolean } = {}) {
  const counts = { publish: 0, refresh: 0 };
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const ok = (body: unknown) => new Response(JSON.stringify(body));
      const err = (message: string) =>
        new Response(JSON.stringify({ error: { message, code: 1 } }), { status: 400 });
      if (url.includes("refresh_access_token")) {
        counts.refresh++;
        return opts.refreshFails ? err("refresh roto") : ok({ access_token: "NUEVO", expires_in: 60 * 86400 });
      }
      if (url.endsWith("/media_publish")) {
        counts.publish++;
        return ok({ id: `M${counts.publish}` });
      }
      if (url.endsWith("/media") && init?.method === "POST") {
        return opts.fail ? err("Meta caído") : ok({ id: `C${++n}` });
      }
      if (url.includes("status_code")) return ok({ status_code: "FINISHED" });
      if (url.includes("fields=permalink")) return ok({ permalink: "https://www.instagram.com/p/x/" });
      return err(`sin ruta ${url}`);
    }),
  );
  return counts;
}

async function post(t: T, status: "approved" | "draft", scheduledAt: number) {
  const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["jpeg"])));
  return await t.run((ctx) =>
    ctx.db.insert("igPosts", {
      caption: "Descargá Gridd.",
      angle: "a",
      images: [imageId],
      status,
      scheduledAt,
      attempts: 0,
    }),
  );
}

async function seedCredentials(t: T, expiresAt: number) {
  await t.run((ctx) =>
    ctx.db.insert("igCredentials", { accessToken: "VIEJO", igUserId: "123", expiresAt, refreshedAt: 0 }),
  );
}

const get = (t: T, id: Id<"igPosts">) => t.run((ctx) => ctx.db.get(id));

beforeEach(() => {
  vi.stubEnv("IG_GRAPH_VERSION", "v99.0");
  vi.stubEnv("IG_ACCESS_TOKEN", "SEED");
  vi.stubEnv("IG_USER_ID", "123");
  vi.stubEnv("IG_DRY_RUN", "false");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("publishDue", () => {
  test("publica los approved vencidos e ignora futuros y drafts", async () => {
    const t = setup();
    const counts = fakeMeta();
    const due = await post(t, "approved", Date.now() - HOUR);
    const future = await post(t, "approved", Date.now() + HOUR);
    const draft = await post(t, "draft", Date.now() - HOUR);
    await t.action(internal.instagram.scheduler.publishDue, {});
    expect((await get(t, due))?.status).toBe("published");
    expect((await get(t, future))?.status).toBe("approved");
    expect((await get(t, draft))?.status).toBe("draft");
    expect(counts.publish).toBe(1);
  });

  test("dry-run: approved vencido termina published con IDs falsos", async () => {
    const t = setup();
    vi.stubEnv("IG_DRY_RUN", "true");
    const counts = fakeMeta();
    const due = await post(t, "approved", Date.now() - HOUR);
    await t.action(internal.instagram.scheduler.publishDue, {});
    expect((await get(t, due))?.igMediaId).toMatch(/^dry-/);
    expect(counts.publish).toBe(0);
  });

  test("dos ejecuciones simultáneas no publican el mismo post dos veces", async () => {
    const t = setup();
    const counts = fakeMeta();
    const a = await post(t, "approved", Date.now() - HOUR);
    const b = await post(t, "approved", Date.now() - HOUR);
    await Promise.all([
      t.action(internal.instagram.scheduler.publishDue, {}),
      t.action(internal.instagram.scheduler.publishDue, {}),
    ]);
    expect(counts.publish).toBe(2);
    expect((await get(t, a))?.status).toBe("published");
    expect((await get(t, b))?.status).toBe("published");
  });

  test("con Meta caído reintenta hasta el máximo y queda failed", async () => {
    const t = setup();
    fakeMeta({ fail: true });
    const id = await post(t, "approved", Date.now() - HOUR);
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) {
      await t.action(internal.instagram.scheduler.publishDue, {});
      // Adelantamos el reintento para no esperar 30 minutos.
      await t.run(async (ctx) => {
        const p = await ctx.db.get(id);
        if (p?.status === "approved") await ctx.db.patch(id, { scheduledAt: Date.now() - 1 });
      });
    }
    const p = await get(t, id);
    expect(p).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    expect(p?.lastError).toMatch(/Meta caído/);
  });

  test("refresca el token si vence en menos de 10 días", async () => {
    const t = setup();
    const counts = fakeMeta();
    await seedCredentials(t, Date.now() + 5 * DAY);
    await t.action(internal.instagram.scheduler.publishDue, {});
    expect(counts.refresh).toBe(1);
    const [row] = await t.run((ctx) => ctx.db.query("igCredentials").take(1));
    expect(row.accessToken).toBe("NUEVO");
  });

  test("no refresca si falta más de 10 días ni si no hay credenciales guardadas", async () => {
    const t = setup();
    const counts = fakeMeta();
    await t.action(internal.instagram.scheduler.publishDue, {});
    await seedCredentials(t, Date.now() + 30 * DAY);
    await t.action(internal.instagram.scheduler.publishDue, {});
    expect(counts.refresh).toBe(0);
  });

  test("si el refresh falla, igual publica", async () => {
    const t = setup();
    fakeMeta({ refreshFails: true });
    await seedCredentials(t, Date.now() + 2 * DAY);
    const due = await post(t, "approved", Date.now() - HOUR);
    await t.action(internal.instagram.scheduler.publishDue, {});
    expect((await get(t, due))?.status).toBe("published");
  });
});
