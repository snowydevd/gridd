import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extiende app.json con lo que depende de variables de entorno, para no commitear secretos.
 * GOOGLE_MAPS_ANDROID_API_KEY: key de "Maps SDK for Android" (restringida al package + SHA-1).
 * En iOS se usa Apple Maps, que no necesita key.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }],
  ],
});
