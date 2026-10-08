import { api, type Doc, type Id } from "@/lib/convex";
import { useMutation, useQuery } from "convex/react";

export type Car = Doc<"cars">;
export type CarInput = { make: string; model: string; year: number; version?: string; isModified?: boolean };

/** Autos del usuario logueado (vacío si es invitado). `isLoading` mientras llega la primera respuesta. */
export function useMyCars() {
    const cars = useQuery(api.cars.listMine);
    return { cars: cars ?? [], isLoading: cars === undefined };
}

export function useCar(id: Id<"cars"> | undefined) {
    const { cars, isLoading } = useMyCars();
    return { car: id ? cars.find((c) => c._id === id) ?? null : null, isLoading };
}

export function useCarActions() {
    const add = useMutation(api.cars.add);
    const update = useMutation(api.cars.update);
    const remove = useMutation(api.cars.remove);
    return {
        addCar: (car: CarInput) => add(car),
        updateCar: (id: Id<"cars">, car: CarInput) => update({ id, ...car }),
        removeCar: (id: Id<"cars">) => remove({ id }),
    };
}

/** "Volkswagen Saveiro G5 · 2014" */
export function carTitle(car: Pick<Car, "make" | "model" | "version">) {
    return [car.make, car.model, car.version].filter(Boolean).join(" ");
}

/** Mensaje de un ConvexError del backend, o el genérico si no trae. */
export function carErrorMessage(error: unknown, fallback: string) {
    const data = (error as { data?: { message?: unknown } } | null)?.data;
    return typeof data?.message === "string" ? data.message : fallback;
}

// El mismo catálogo que valida el backend, para armar los selectores.
export { findModel, modelYears, VEHICLE_CATALOG } from "../../convex/lib/vehicleCatalog";
