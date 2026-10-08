import type { MapStyleElement } from 'react-native-maps';

/**
 * Estilo oscuro de Google Maps (Android) alineado a los tokens de theme.ts: asfalto, bordes
 * de 1px y sin puntos de interés que compitan con los pines. iOS usa Apple Maps en modo oscuro.
 */
export const darkMapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#111214' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A8F98' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0B0C' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2A2C30' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#4A4E55' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#141714' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1F2125' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#17181B' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#26282D' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2E3036' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#A6ABB3' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D0F12' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4A4E55' }] },
];
