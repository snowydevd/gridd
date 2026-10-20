// Cliente HTTP de la Instagram API with Instagram Login (graph.instagram.com).
// No toca la base: recibe el token y el ID de cuenta ya resueltos.

const HOST = "https://graph.instagram.com";
const WAIT_TIMEOUT = 2 * 60 * 1000;
const FIRST_POLL = 2000;
const MAX_POLL = 30_000;

export class IgApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IgApiError";
  }
}

export type GraphClientOptions = {
  accessToken: string;
  igUserId: string;
  version: string;
  dryRun: boolean;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
};

export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

export function createGraphClient(opts: GraphClientOptions) {
  const fetchFn = opts.fetchFn ?? ((url, init) => fetch(url, init));
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const log = opts.log ?? ((m) => console.log(m));
  const base = `${HOST}/${opts.version}`;
  let fakeId = 0;

  async function request<R>(method: "GET" | "POST", path: string, body?: object): Promise<R> {
    const url = `${base}/${path}`;
    const res = await fetchFn(url, {
      method,
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        ...(body && { "Content-Type": "application/json" }),
      },
      body: body && JSON.stringify(body),
    });
    return await parse<R>(res, `${method} ${path}`).catch(redact);
  }

  // Por si Meta devuelve el token en el cuerpo de un error: nunca lo dejamos en un mensaje.
  function redact(e: unknown): never {
    const message = e instanceof Error ? e.message : String(e);
    throw new IgApiError(message.split(opts.accessToken).join("***"));
  }

  function dry(method: string, path: string, body?: object) {
    log(`[instagram] DRY RUN ${method} ${base}/${path} ${body ? JSON.stringify(body) : ""}`.trim());
    return `dry-${Date.now()}-${++fakeId}`;
  }

  async function createImageContainer(args: {
    imageUrl: string;
    caption?: string;
    isCarouselItem?: boolean;
  }): Promise<string> {
    const body = {
      image_url: args.imageUrl,
      ...(args.caption !== undefined && { caption: args.caption }),
      ...(args.isCarouselItem && { is_carousel_item: true }),
    };
    const path = `${opts.igUserId}/media`;
    if (opts.dryRun) return dry("POST", path, body);
    return (await request<{ id: string }>("POST", path, body)).id;
  }

  async function createCarouselContainer(args: { children: string[]; caption: string }) {
    const body = { media_type: "CAROUSEL", children: args.children.join(","), caption: args.caption };
    const path = `${opts.igUserId}/media`;
    if (opts.dryRun) return dry("POST", path, body);
    return (await request<{ id: string }>("POST", path, body)).id;
  }

  async function getContainerStatus(containerId: string) {
    const path = `${containerId}?${new URLSearchParams({ fields: "status_code,status" })}`;
    if (opts.dryRun) {
      dry("GET", path);
      return { statusCode: "FINISHED" as ContainerStatus, status: undefined };
    }
    const res = await request<{ status_code: ContainerStatus; status?: string }>("GET", path);
    return { statusCode: res.status_code, status: res.status };
  }

  /** Espera a que el contenedor esté FINISHED. Lanza con el texto de Meta si falla o vence. */
  async function waitForContainer(containerId: string) {
    let waited = 0;
    let delay = FIRST_POLL;
    for (;;) {
      const { statusCode, status } = await getContainerStatus(containerId);
      if (statusCode === "FINISHED") return;
      if (statusCode === "ERROR" || statusCode === "EXPIRED" || statusCode === "PUBLISHED") {
        throw new IgApiError(`Contenedor ${containerId} en ${statusCode}: ${status ?? "sin detalle"}`);
      }
      if (waited >= WAIT_TIMEOUT) {
        throw new IgApiError(`Timeout esperando el contenedor ${containerId} (último estado ${statusCode})`);
      }
      await sleep(delay);
      waited += delay;
      delay = Math.min(delay * 2, MAX_POLL);
    }
  }

  async function publishContainer(containerId: string): Promise<string> {
    const path = `${opts.igUserId}/media_publish`;
    const body = { creation_id: containerId };
    if (opts.dryRun) return dry("POST", path, body);
    return (await request<{ id: string }>("POST", path, body)).id;
  }

  async function getPermalink(igMediaId: string): Promise<string> {
    const path = `${igMediaId}?fields=permalink`;
    if (opts.dryRun) {
      dry("GET", path);
      return `https://www.instagram.com/p/${igMediaId}/`;
    }
    return (await request<{ permalink: string }>("GET", path)).permalink;
  }

  async function getPublishingLimit() {
    const path = `${opts.igUserId}/content_publishing_limit?fields=quota_usage,config`;
    if (opts.dryRun) {
      dry("GET", path);
      return { quotaUsage: 0, quotaTotal: 100 };
    }
    const res = await request<{ data: { quota_usage: number; config?: { quota_total?: number } }[] }>(
      "GET",
      path,
    );
    return { quotaUsage: res.data[0]?.quota_usage ?? 0, quotaTotal: res.data[0]?.config?.quota_total };
  }

  /** El token tiene que tener más de 24 h. El endpoint no lleva versión. */
  async function refreshToken() {
    if (opts.dryRun) {
      dry("GET", "refresh_access_token");
      return { accessToken: opts.accessToken, expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000 };
    }
    const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: opts.accessToken });
    const res = await fetchFn(`${HOST}/refresh_access_token?${params}`, { method: "GET" });
    const body = await parse<{ access_token: string; expires_in: number }>(
      res,
      "GET refresh_access_token",
    ).catch(redact);
    return { accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  }

  return {
    createImageContainer,
    createCarouselContainer,
    getContainerStatus,
    waitForContainer,
    publishContainer,
    getPermalink,
    getPublishingLimit,
    refreshToken,
  };
}

export type GraphClient = ReturnType<typeof createGraphClient>;

/** Lee la respuesta; si Meta devuelve error, lo convierte en IgApiError con su mensaje. */
async function parse<R>(res: Response, label: string): Promise<R> {
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  const error = (body as { error?: MetaError } | undefined)?.error;
  if (!res.ok || error) {
    const detail = error
      ? `${error.code ?? "?"}${error.error_subcode ? `/${error.error_subcode}` : ""} ${error.type ?? ""}: ${error.message ?? ""}${error.error_user_msg ? ` (${error.error_user_msg})` : ""}`
      : `HTTP ${res.status}: ${text.slice(0, 300)}`;
    throw new IgApiError(`Meta ${label} → ${detail}`.replace(/\s+/g, " ").trim());
  }
  return body as R;
}

type MetaError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
};
