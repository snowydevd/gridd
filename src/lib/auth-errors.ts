import { TimeoutError } from '@/lib/with-timeout';

export type PasswordFlow = 'signIn' | 'signUp' | 'reset' | 'reset-verification';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mismas reglas que convex/lib/validation.ts, para avisar antes de ir al servidor. */
export function validateCredentials(
  flow: PasswordFlow,
  { name, email, password, code }: { name: string; email: string; password: string; code: string },
): string | null {
  if (!EMAIL_RE.test(email.trim())) return 'Revisá el email, parece que está mal escrito.';
  if (flow === 'signUp') {
    const n = name.trim().length;
    if (n < 2 || n > 50) return 'El nombre tiene que tener entre 2 y 50 caracteres.';
  }
  if (flow === 'reset-verification' && !/^\d{8}$/.test(code.trim())) {
    return 'El código tiene 8 números.';
  }
  if (flow === 'signUp' || flow === 'reset-verification') {
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return 'La contraseña tiene que tener al menos 8 caracteres, con letras y números.';
    }
  }
  return null;
}

// Convex Auth tira `Error`s comunes con estos textos. En desarrollo llegan tal cual;
// en producción Convex los tapa con "Server Error" y caemos en FALLBACK.
const KNOWN: { match: RegExp; message: (flow: PasswordFlow) => string }[] = [
  { match: /TooManyFailedAttempts/, message: () => 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' },
  { match: /already exists/, message: () => 'Ya existe una cuenta con ese email. Probá entrar.' },
  {
    match: /InvalidAccountId|InvalidSecret|Invalid credentials/,
    message: (flow) =>
      flow === 'reset' ? 'No encontramos una cuenta con ese email.' : 'Email o contraseña incorrectos.',
  },
  { match: /Invalid code|Could not verify code|Invalid verification code/i, message: () => 'El código no es válido o ya venció.' },
  { match: /recuperación|Resend|API key/i, message: () => 'No pudimos mandar el mail. Probá de nuevo en un rato.' },
  { match: /Network|fetch|connection/i, message: () => 'Sin conexión. Revisá tu internet y probá de nuevo.' },
];

const FALLBACK: Record<PasswordFlow, string> = {
  signIn: 'Email o contraseña incorrectos.',
  signUp: 'No pudimos crear la cuenta. Puede que ya exista una con ese email.',
  reset: 'No pudimos mandar el código. Revisá el email.',
  'reset-verification': 'El código no es válido o ya venció.',
};

/** Convierte cualquier error de `signIn('password', …)` en un mensaje para mostrar. */
export function authErrorMessage(error: unknown, flow: PasswordFlow): string {
  if (error instanceof TimeoutError) return 'Está tardando demasiado. Revisá tu conexión y probá de nuevo.';
  // Errores nuestros (convex/lib/validation.ts): traen el mensaje listo.
  // Se chequea la forma y no `instanceof` por si hay más de una copia de `convex` en el bundle.
  const data = (error as { data?: { message?: unknown } } | null)?.data;
  if (typeof data?.message === 'string') return data.message;
  const text = error instanceof Error ? error.message : String(error);
  return KNOWN.find((k) => k.match.test(text))?.message(flow) ?? FALLBACK[flow];
}
