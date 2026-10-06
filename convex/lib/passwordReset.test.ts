import { expect, test } from "vitest";
import { generateResetCode, resetEmailText } from "./passwordReset";

test("el código de reset son 8 dígitos y varía", () => {
  const a = generateResetCode();
  const b = generateResetCode();
  expect(a).toMatch(/^\d{8}$/);
  expect(b).toMatch(/^\d{8}$/);
  expect(a === b && generateResetCode() === a).toBe(false);
});

test("el mail incluye el código y el vencimiento", () => {
  const text = resetEmailText("12345678");
  expect(text).toContain("12345678");
  expect(text).toContain("15 minutos");
});
