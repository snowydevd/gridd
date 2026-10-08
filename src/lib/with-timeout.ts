export class TimeoutError extends Error {
  constructor() {
    super('La operación tardó demasiado.');
    this.name = 'TimeoutError';
  }
}

/** Rechaza con `TimeoutError` si `promise` no termina en `ms`. No cancela la operación original. */
export function withTimeout<T>(promise: Promise<T>, ms = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Pausa corta para que el usuario alcance a ver un estado (ej. "¡Listo!") antes de navegar. */
export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
