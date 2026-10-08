import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Image, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, type EdgePadding, type LatLng, type Region } from 'react-native-maps';

import { darkMapStyle } from '@/constants/map-style';

export type EventMapPin = {
  id: string;
  label: string;
  coordinate: LatLng;
  /** Posición en el mapa estilizado de web (0–1). */
  x: number;
  y: number;
};

export type EventMapHandle = {
  /** Mueve la cámara a un punto manteniendo el zoom actual si no se pasa `delta`. */
  focus: (coordinate: LatLng, delta?: number) => void;
};

type Props = {
  ref?: Ref<EventMapHandle>;
  pins: EventMapPin[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  initialRegion: Region;
  /** Espacio ocupado por la UI encima del mapa, para que el logo y el centro queden visibles. */
  padding?: EdgePadding;
  showsUserLocation?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function EventMap({ ref, pins, selectedId, onSelect, initialRegion, padding, showsUserLocation, style }: Props) {
  const map = useRef<MapView>(null);
  const region = useRef(initialRegion);

  useImperativeHandle(ref, () => ({
    focus: (coordinate, delta) => {
      const { latitudeDelta, longitudeDelta } = region.current;
      map.current?.animateToRegion(
        { ...coordinate, latitudeDelta: delta ?? latitudeDelta, longitudeDelta: delta ?? longitudeDelta },
        350,
      );
    },
  }));

  return (
    <MapView
      ref={map}
      style={style}
      initialRegion={initialRegion}
      onRegionChangeComplete={(r) => (region.current = r)}
      mapPadding={padding}
      // Android: Google Maps con estilo propio. iOS: Apple Maps en modo oscuro.
      customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
      userInterfaceStyle="dark"
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      showsCompass={false}
      toolbarEnabled={false}
      pitchEnabled={false}>
      {pins.map((pin) => {
        const selected = pin.id === selectedId;
        return (
          <PinMarker
            // Remontar al cambiar la selección: el pin pasa de chico a grande.
            key={`${pin.id}-${selected}`}
            pin={pin}
            selected={selected}
            onPress={() => onSelect?.(pin.id)}
          />
        );
      })}
    </MapView>
  );
}

const PIN = {
  small: require('@/assets/brand/gridd-pin-map-small.png'),
  large: require('@/assets/brand/gridd-pin-map-large.png'),
};

function PinMarker({ pin, selected, onPress }: { pin: EventMapPin; selected: boolean; onPress: () => void }) {
  // El mapa saca una "foto" del pin; hay que dejarla actualizarse hasta que cargue la imagen,
  // si no en Android puede quedar vacío. Después se congela para no redibujar en cada frame.
  const [loaded, setLoaded] = useState(false);
  return (
    <Marker
      identifier={pin.id}
      coordinate={pin.coordinate}
      title={pin.label}
      // La punta del globo está abajo al centro (≈96% de la altura de la imagen).
      anchor={{ x: 0.5, y: 0.96 }}
      tracksViewChanges={!loaded}
      zIndex={selected ? 1 : 0}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}>
      <Image
        source={selected ? PIN.large : PIN.small}
        style={selected ? styles.pinLarge : styles.pinSmall}
        onLoad={() => setLoaded(true)}
        fadeDuration={0}
      />
    </Marker>
  );
}

const styles = StyleSheet.create({
  pinSmall: { width: 30, height: 30 },
  pinLarge: { width: 46, height: 46 },
});
