import Resend from "@auth/core/providers/resend";
import { type RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { Resend as ResendAPI } from "resend";

const random: RandomReader = {
  read(bytes) {
    crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
  },
};

export function generateResetCode(): string {
  return generateRandomString(random, "0123456789", 8);
}

export function resetEmailText(code: string): string {
  return [
    `Tu código para cambiar la contraseña de Gridd es: ${code}`,
    "",
    "Vence en 15 minutos. Si no lo pediste, ignorá este mail.",
  ].join("\n");
}

/** Manda el código de "olvidé mi contraseña" (flujos reset / reset-verification). */
export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15,
  async generateVerificationToken() {
    return generateResetCode();
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM ?? "Gridd <onboarding@resend.dev>",
      to: [email],
      subject: "Tu código para cambiar la contraseña de Gridd",
      text: resetEmailText(token),
    });
    if (error) throw new Error("No se pudo enviar el mail de recuperación.");
  },
});
