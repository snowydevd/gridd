import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import {
  darkPalette,
  lightPalette,
  parsePreference,
  resolveScheme,
  type Palette,
  type Scheme,
  type ThemePreference,
} from './palettes';

export {
  darkPalette,
  lightPalette,
  THEME_PREFERENCES,
  themePreferenceLabel,
  withAlpha,
  type Palette,
  type Scheme,
  type ThemePreference,
} from './palettes';

// Preferencia del dispositivo (no de la cuenta): funciona para invitados y cada teléfono tiene la suya.
const STORAGE_KEY = 'gridd.themePreference';

type Theme = {
  colors: Palette;
  scheme: Scheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** `false` hasta leer la preferencia guardada: la raíz no oculta el splash antes. */
  ready: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => setPreferenceState(parsePreference(raw)))
      .catch((error) => {
        if (__DEV__) console.log('[theme] no se pudo leer la preferencia:', error);
      })
      .finally(() => setReady(true));
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch((error) => {
      if (__DEV__) console.log('[theme] no se pudo guardar la preferencia:', error);
    });
  };

  const scheme = resolveScheme(preference, system === 'light' || system === 'dark' ? system : null);
  const colors = scheme === 'light' ? lightPalette : darkPalette;

  return (
    <ThemeContext.Provider value={{ colors, scheme, preference, setPreference, ready }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme necesita un ThemeProvider arriba');
  return theme;
}

/**
 * Fuerza el tema oscuro en una parte de la pantalla: tarjetas con texto sobre una foto oscurecida
 * (destacado de Inicio, vista previa de publicar, login), que se ven igual en los dos temas.
 */
export function DarkScope({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ThemeContext.Provider value={{ ...theme, colors: darkPalette, scheme: 'dark' }}>{children}</ThemeContext.Provider>
  );
}

/**
 * Estilos que dependen del tema. Se arman las dos hojas una sola vez y el hook devuelve la del
 * tema activo, así cambiar de tema no recalcula nada:
 *
 *   const useStyles = makeStyles((c) => ({ screen: { backgroundColor: c.canvas } }));
 *   const styles = useStyles();
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: Palette) => T) {
  const sheets = { dark: StyleSheet.create(factory(darkPalette)), light: StyleSheet.create(factory(lightPalette)) };
  return function useStyles() {
    return sheets[useTheme().scheme];
  };
}
