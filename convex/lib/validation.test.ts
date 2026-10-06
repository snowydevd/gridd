import { describe, expect, test } from "vitest";
import { passwordProfile, validateName, validatePassword } from "./validation";

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  return "OK";
};

describe("validateName", () => {
  test("hace trim y acepta 2-50", () => {
    expect(validateName("  Lauti ")).toBe("Lauti");
  });
  test("rechaza muy corto o muy largo", () => {
    expect(codeOf(() => validateName(" a "))).toBe("INVALID");
    expect(codeOf(() => validateName("x".repeat(51)))).toBe("INVALID");
  });
});

describe("validatePassword", () => {
  test("acepta 8+ con letra y número", () => {
    expect(codeOf(() => validatePassword("fierro123"))).toBe("OK");
  });
  test.each(["corta1", "solamenteletras", "1234567890"])("rechaza %s", (pw) => {
    expect(codeOf(() => validatePassword(pw))).toBe("INVALID");
  });
});

describe("passwordProfile", () => {
  test("normaliza el email y guarda el nombre en signUp", () => {
    expect(
      passwordProfile({ email: "  Foo@Gridd.UY ", name: " Foo ", flow: "signUp" }),
    ).toEqual({ email: "foo@gridd.uy", name: "Foo" });
  });
  test("en signIn sólo devuelve el email normalizado", () => {
    expect(passwordProfile({ email: "FOO@gridd.uy", flow: "signIn" })).toEqual({
      email: "foo@gridd.uy",
    });
  });
  test("rechaza email inválido", () => {
    expect(codeOf(() => passwordProfile({ email: "no-es-mail", flow: "signIn" }))).toBe(
      "INVALID",
    );
  });
  test("signUp sin nombre válido falla", () => {
    expect(
      codeOf(() => passwordProfile({ email: "a@b.uy", name: "", flow: "signUp" })),
    ).toBe("INVALID");
  });
});
