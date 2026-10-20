import { describe, expect, test, vi } from "vitest";
import { IgApiError, createGraphClient } from "./graph";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function client(responses: Response[]) {
  const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift()!);
  const sleep = vi.fn(async (_ms: number) => {});
  const c = createGraphClient({
    accessToken: "SECRET",
    igUserId: "123",
    version: "v99.0",
    dryRun: false,
    fetchFn,
    sleep,
    log: () => {},
  });
  return { c, fetchFn, sleep };
}

describe("graph client", () => {
  test("createImageContainer manda JSON con Bearer al endpoint de media", async () => {
    const { c, fetchFn } = client([json({ id: "c1" })]);
    expect(await c.createImageContainer({ imageUrl: "https://x/a.jpg", caption: "hola" })).toBe("c1");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://graph.instagram.com/v99.0/123/media");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer SECRET");
    expect(JSON.parse(init?.body as string)).toEqual({ image_url: "https://x/a.jpg", caption: "hola" });
  });

  test("carrusel: items con is_carousel_item y children separados por coma", async () => {
    const { c, fetchFn } = client([json({ id: "i1" }), json({ id: "car" })]);
    await c.createImageContainer({ imageUrl: "https://x/a.jpg", isCarouselItem: true });
    expect(await c.createCarouselContainer({ children: ["i1", "i2"], caption: "cap" })).toBe("car");
    expect(JSON.parse(fetchFn.mock.calls[0][1]?.body as string)).toEqual({
      image_url: "https://x/a.jpg",
      is_carousel_item: true,
    });
    expect(JSON.parse(fetchFn.mock.calls[1][1]?.body as string)).toEqual({
      media_type: "CAROUSEL",
      children: "i1,i2",
      caption: "cap",
    });
  });

  test("waitForContainer hace polling con backoff hasta FINISHED", async () => {
    const { c, fetchFn, sleep } = client([
      json({ status_code: "IN_PROGRESS" }),
      json({ status_code: "IN_PROGRESS" }),
      json({ status_code: "FINISHED" }),
    ]);
    await c.waitForContainer("c1");
    expect(fetchFn.mock.calls[0][0]).toBe("https://graph.instagram.com/v99.0/c1?fields=status_code%2Cstatus");
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls[1][0]).toBeGreaterThan(sleep.mock.calls[0][0]);
  });

  test("waitForContainer con ERROR lanza el texto de Meta", async () => {
    const { c } = client([json({ status_code: "ERROR", status: "Error: 2207026 imagen inválida" })]);
    await expect(c.waitForContainer("c1")).rejects.toThrow(/ERROR.*2207026 imagen inválida/);
  });

  test("waitForContainer corta por timeout", async () => {
    const { c } = client(Array.from({ length: 50 }, () => json({ status_code: "IN_PROGRESS" })));
    await expect(c.waitForContainer("c1")).rejects.toThrow(/timeout/i);
  });

  test("un error HTTP de Meta se convierte en IgApiError con el mensaje real y sin el token", async () => {
    const { c } = client([
      json({ error: { message: "Invalid OAuth access token", type: "OAuthException", code: 190 } }, 400),
    ]);
    const err = await c.publishContainer("c1").catch((e) => e);
    expect(err).toBeInstanceOf(IgApiError);
    expect(err.message).toMatch(/190.*Invalid OAuth access token/);
    expect(err.message).not.toMatch(/SECRET/);
  });

  test("si Meta devuelve el token en el error, se tapa", async () => {
    const { c } = client([new Response("bad token SECRET", { status: 500 })]);
    const err = await c.publishContainer("c1").catch((e) => e);
    expect(err.message).toMatch(/HTTP 500: bad token \*\*\*/);
  });

  test("publishContainer, getPermalink y getPublishingLimit", async () => {
    const { c, fetchFn } = client([
      json({ id: "m1" }),
      json({ permalink: "https://www.instagram.com/p/abc/" }),
      json({ data: [{ quota_usage: 2, config: { quota_total: 100 } }] }),
    ]);
    expect(await c.publishContainer("c1")).toBe("m1");
    expect(JSON.parse(fetchFn.mock.calls[0][1]?.body as string)).toEqual({ creation_id: "c1" });
    expect(await c.getPermalink("m1")).toBe("https://www.instagram.com/p/abc/");
    expect(await c.getPublishingLimit()).toEqual({ quotaUsage: 2, quotaTotal: 100 });
  });

  test("refreshToken usa el endpoint sin versión y devuelve el vencimiento", async () => {
    const { c, fetchFn } = client([json({ access_token: "NEW", token_type: "bearer", expires_in: 5183944 })]);
    const before = Date.now();
    const res = await c.refreshToken();
    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=SECRET",
    );
    expect(res.accessToken).toBe("NEW");
    expect(res.expiresAt).toBeGreaterThanOrEqual(before + 5183944 * 1000);
  });

  test("dry-run no llama a fetch y devuelve IDs falsos", async () => {
    const fetchFn = vi.fn();
    const logs: string[] = [];
    const c = createGraphClient({
      accessToken: "SECRET",
      igUserId: "123",
      version: "v99.0",
      dryRun: true,
      fetchFn,
      sleep: async () => {},
      log: (m) => logs.push(m),
    });
    const container = await c.createImageContainer({ imageUrl: "https://x/a.jpg" });
    await c.waitForContainer(container);
    const media = await c.publishContainer(container);
    expect(container).toMatch(/^dry-/);
    expect(media).toMatch(/^dry-/);
    expect(await c.getPermalink(media)).toMatch(/^https:\/\//);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(logs.join("\n")).toMatch(/DRY RUN.*POST.*\/media/);
    expect(logs.join("\n")).not.toMatch(/SECRET/);
  });
});
