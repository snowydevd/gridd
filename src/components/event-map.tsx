import { useFocusEffect } from 'expo-router';
import { useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Image, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, type EdgePadding, type LatLng, type Region } from 'react-native-maps';

import { darkMapStyle, lightMapStyle } from '@/constants/map-style';
import { useTheme, type Scheme } from '@/theme';

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
  /** `false` congela la cámara (sin arrastrar ni zoom), para mapas chicos dentro de un scroll. */
  interactive?: boolean;
  /** Toque en el mapa, fuera de los pines, con el punto tocado. */
  onPress?: (coordinate: LatLng) => void;
  style?: StyleProp<ViewStyle>;
};

export function EventMap({
  ref,
  pins,
  selectedId,
  onSelect,
  initialRegion,
  padding,
  showsUserLocation,
  interactive = true,
  onPress,
  style,
}: Props) {
  const { scheme } = useTheme();
  const map = useRef<MapView>(null);
  const region = useRef(initialRegion);

  // Los pines son una "foto" congelada (ver PinMarker). Al volver a esta pantalla desde otra, Android
  // pierde esas fotos y los pines quedan invisibles: se remontan para que se vuelvan a dibujar.
  const [generation, setGeneration] = useState(0);
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) setGeneration((g) => g + 1);
      focusedBefore.current = true;
    }, []),
  );

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
      // Android: Google Maps con estilo propio. iOS: Apple Maps en el modo del tema.
      customMapStyle={Platform.OS === 'android' ? (scheme === 'dark' ? darkMapStyle : lightMapStyle) : undefined}
      userInterfaceStyle={scheme}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      showsCompass={false}
      toolbarEnabled={false}
      pitchEnabled={false}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      onPress={(e) => onPress?.(e.nativeEvent.coordinate)}>
      {pins.map((pin) => {
        const selected = pin.id === selectedId;
        return (
          <PinMarker
            // Remontar al cambiar la selección (el pin pasa de chico a grande), el tema o al volver a la pantalla.
            key={`${pin.id}-${selected}-${generation}-${scheme}`}
            pin={pin}
            selected={selected}
            scheme={scheme}
            onPress={() => onSelect?.(pin.id)}
          />
        );
      })}
    </MapView>
  );
}

// En el mapa claro el lima no se distingue del fondo: esos pines llevan contorno oscuro.
const PINS = {
  dark: {
    small: require('@/assets/brand/gridd-pin-map-small.png'),
    large: require('@/assets/brand/gridd-pin-map-large.png'),
  },
  light: {
    small: require('@/assets/brand/gridd-pin-map-small-light.png'),
    large: require('@/assets/brand/gridd-pin-map-large-light.png'),
  },
};

function PinMarker({ pin, selected, scheme, onPress }: { pin: EventMapPin; selected: boolean; scheme: Scheme; onPress: () => void }) {
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
        source={selected ? PINS[scheme].large : PINS[scheme].small}
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
