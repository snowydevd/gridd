import type { Ref } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { StylizedMap } from '@/components/stylized-map';

// react-native-maps no soporta web: ahí seguimos con el mapa estilizado.
// Los tipos se duplican a mano para no importar react-native-maps en el bundle web.

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

export type EventMapPin = { id: string; label: string; coordinate: LatLng; x: number; y: number };
export type EventMapHandle = { focus: (coordinate: LatLng, delta?: number) => void };

type Props = {
  ref?: Ref<EventMapHandle>;
  pins: EventMapPin[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  initialRegion: Region;
  padding?: { top: number; right: number; bottom: number; left: number };
  showsUserLocation?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function EventMap({ pins, selectedId, onSelect, style }: Props) {
  return <StylizedMap pins={pins} selectedId={selectedId} onSelect={onSelect} style={style} />;
}
