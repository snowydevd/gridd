import { describe, expect, test, vi } from "vitest";
import type { Angle } from "./angles";
import { type LlmClient, generatePost } from "./llm";

const angle: Angle = {
  id: "cerca-tuyo",
  title: "Meets cerca tuyo",
  goal: "Mostrar el filtro por distancia",
  templates: ["headline"],
  facts: ["La sección Cerca tuyo filtra por 10, 25, 50, 100, 200 o 500 km"],
};

const caption = `Encontrá meets a 25 km de tu casa.

Bajate Gridd 👉 gridd.app

#carmeetsuruguay #autosuruguay #fierreros`;

const good = { caption, data: { headline: "Meets *cerca tuyo*", subline: "Elegí hasta dónde ir." } };

function client(...outputs: unknown[]) {
  const parse = vi.fn(async () => {
    const next = outputs.shift();
    if (next === "refusal") return { stop_reason: "refusal", stop_details: { category: "x" }, parsed_output: null };
    return { stop_reason: "end_turn", parsed_output: next };
  });
  return { client: { messages: { parse } } as unknown as LlmClient, parse };
}

describe("generatePost", () => {
  test("devuelve caption y datos de plantilla validados", async () => {
    const { client: c, parse } = client(good);
    const post = await generatePost(c, { angle, template: "headline", recentCaptions: [], model: "m" });
    expect(post).toEqual({ angle: "cerca-tuyo", caption, template: "headline", data: good.data });
    const req = (parse.mock.calls[0] as unknown[])[0] as { model: string; messages: { content: string }[] };
    expect(req.model).toBe("m");
    expect(req.messages[0].content).toContain("10, 25, 50, 100, 200 o 500 km");
  });

  test("si la primera respuesta no valida, reintenta una vez con los errores", async () => {
    const bad = { ...good, caption: caption.replace("25 km", "3000 km") };
    const { client: c, parse } = client(bad, good);
    const post = await generatePost(c, { angle, template: "headline", recentCaptions: [], model: "m" });
    expect(post.caption).toBe(caption);
    const retry = (parse.mock.calls[1] as unknown[])[0] as { messages: { content: string }[] };
    expect(retry.messages[0].content).toMatch(/3000/);
  });

  test("si falla dos veces, lanza con los errores", async () => {
    const bad = { ...good, data: { headline: " ", subline: "x" } };
    const { client: c } = client(bad, bad);
    await expect(
      generatePost(c, { angle, template: "headline", recentCaptions: [], model: "m" }),
    ).rejects.toThrow(/headline/);
  });

  test("un rechazo del modelo se reporta", async () => {
    const { client: c } = client("refusal", "refusal");
    await expect(
      generatePost(c, { angle, template: "headline", recentCaptions: [], model: "m" }),
    ).rejects.toThrow(/rechaz/i);
  });
});
