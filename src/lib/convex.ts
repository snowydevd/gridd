import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export { api } from '../../convex/_generated/api';
export type { Doc, Id } from '../../convex/_generated/dataModel';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) throw new Error('Falta EXPO_PUBLIC_CONVEX_URL (ver .env.example).');

type Logger = NonNullable<Exclude<NonNullable<ConstructorParameters<typeof ConvexReactClient>[1]>['logger'], boolean>>;

/**
 * El cliente de Convex hace console.error de toda acción que falla. Los fallos de `auth:signIn`
 * (contraseña incorrecta, email ya registrado…) son esperados y la UI ya los muestra, así que
 * los bajamos a console.log para que LogBox no los muestre como errores rojos.
 */
const logger: Logger = {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  logVerbose: () => {},
  error: (...args) => {
    const first = String(args[0] ?? '');
    if (first.startsWith('[CONVEX A(auth:signIn)]')) {
      if (__DEV__) console.log('[auth] intento fallido:', ...args);
      return;
    }
    console.error(...args);
  },
};

export const convex = new ConvexReactClient(url, { unsavedChangesWarning: false, logger });

/** Tokens de Convex Auth: Keychain/Keystore en el teléfono, localStorage en web. */
export const authStorage =
  Platform.OS === 'web'
    ? undefined
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };
