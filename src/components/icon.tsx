import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

type SymbolName = Exclude<SymbolViewProps['name'], string>;

/** Semantic icon names mapped to SF Symbols (iOS) and Material Symbols (Android/web). */
const icons = {
  home: { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' },
  map: { ios: 'map', android: 'map', web: 'map' },
  bookmark: { ios: 'bookmark', android: 'bookmark', web: 'bookmark' },
  bookmarkFill: { ios: 'bookmark.fill', android: 'bookmark_added', web: 'bookmark_added' },
  person: { ios: 'person', android: 'person', web: 'person' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  back: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  arrow: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  car: { ios: 'car', android: 'directions_car', web: 'directions_car' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  navigate: { ios: 'location.fill', android: 'near_me', web: 'near_me' },
  locate: { ios: 'location.circle', android: 'my_location', web: 'my_location' },
  logout: {
    ios: 'rectangle.portrait.and.arrow.right',
    android: 'logout',
    web: 'logout',
  },
  mail: { ios: 'envelope', android: 'mail', web: 'mail' },
  group: { ios: 'person.2', android: 'group', web: 'group' },
  verified: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof icons;

type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 22, color = Colors.text, style }: IconProps) {
  return <SymbolView name={icons[name]} size={size} tintColor={color} style={style} />;
}
