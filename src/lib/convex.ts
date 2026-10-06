import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export { api } from '../../convex/_generated/api';
export type { Doc, Id } from '../../convex/_generated/dataModel';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) throw new Error('Falta EXPO_PUBLIC_CONVEX_URL (ver .env.example).');

export const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });

/** Tokens de Convex Auth: Keychain/Keystore en el teléfono, localStorage en web. */
export const authStorage =
  Platform.OS === 'web'
    ? undefined
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };
