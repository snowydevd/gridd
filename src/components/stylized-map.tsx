import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { Colors } from '@/constants/theme';

export type MapPin = {
  id: string;
  x: number;
  y: number;
  label?: string;
};

type Props = {
  pins: MapPin[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

// Fixed "street" layout — a dark telemetry-style placeholder until a real map SDK is wired in.
const streets: ViewStyle[] = [
  { top: '22%', left: '-10%', width: '120%', height: 2, transform: [{ rotate: '-8deg' }] },
  { top: '48%', left: '-10%', width: '120%', height: 3, transform: [{ rotate: '6deg' }] },
  { top: '74%', left: '-10%', width: '120%', height: 2, transform: [{ rotate: '-3deg' }] },
  { left: '18%', top: '-10%', height: '120%', width: 2, transform: [{ rotate: '10deg' }] },
  { left: '46%', top: '-10%', height: '120%', width: 3, transform: [{ rotate: '-6deg' }] },
  { left: '72%', top: '-10%', height: '120%', width: 2, transform: [{ rotate: '4deg' }] },
];

export function StylizedMap({ pins, selectedId, onSelect, style }: Props) {
  return (
    <View style={[styles.map, style]}>
      {/* River / coast */}
      <View style={styles.water} />
      {streets.map((s, i) => (
        <View key={i} style={[styles.street, s]} />
      ))}
      {pins.map((pin) => {
        const selected = pin.id === selectedId;
        return (
          <Pressable
            key={pin.id}
            accessibilityRole="button"
            accessibilityLabel={pin.label}
            hitSlop={12}
            onPress={() => onSelect?.(pin.id)}
            style={[styles.pinWrap, { left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }]}>
            {selected && pin.label && (
              <View style={styles.pinLabelWrap}>
                <View style={styles.pinLabel}>
                  <Text variant="overline" numberOfLines={1}>
                    {pin.label}
                  </Text>
                </View>
              </View>
            )}
            <View style={[styles.pinHalo, selected && styles.pinHaloSelected]}>
              <View style={[styles.pin, selected && styles.pinSelected]} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    backgroundColor: '#111214',
    overflow: 'hidden',
  },
  water: {
    position: 'absolute',
    left: '-20%',
    right: '-20%',
    bottom: '-55%',
    height: '70%',
    borderRadius: 9999,
    backgroundColor: '#0D0F12',
    borderTopWidth: 2,
    borderColor: '#1E2024',
  },
  street: {
    position: 'absolute',
    backgroundColor: '#1F2125',
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
  },
  pinHalo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHaloSelected: { backgroundColor: 'rgba(226,255,59,0.22)', width: 40, height: 40, borderRadius: 20 },
  pin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.text,
    borderWidth: 2,
    borderColor: Colors.canvas,
  },
  pinSelected: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.accent },
  pinLabelWrap: {
    position: 'absolute',
    bottom: '100%',
    width: 200,
    alignItems: 'center',
  },
  pinLabel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.raised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
