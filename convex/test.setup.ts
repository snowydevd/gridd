/// <reference types="vite/client" />
// Todos los módulos de convex/ salvo los tests y los helpers de test.
export const modules = import.meta.glob([
  "./**/*.*s",
  "!./**/*.test.ts",
  "!./test.*.ts",
]);
