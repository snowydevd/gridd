import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { Colors, TabBarHeight } from '@/constants/theme';
import { useCurrentUser } from '@/services/user';

const tabs: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Inicio', icon: 'home' },
  map: { label: 'Mapa', icon: 'map' },
  saved: { label: 'Guardados', icon: 'bookmark' },
  profile: { label: 'Perfil', icon: 'person' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { isPublisher } = useCurrentUser();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TabBarHeight + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = tabs[route.name];
        if (!tab) return null;
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Fragment key={route.key}>
            {/* The publish action sits in the middle of the four tabs; only admins and publishers see it. */}
            {index === 2 && isPublisher && <PublishButton />}
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={onPress}
              style={styles.tab}>
              <Icon name={tab.icon} size={22} color={focused ? Colors.text : Colors.textSecondary} />
              <Text variant="caption" style={[styles.label, { color: focused ? Colors.text : Colors.textSecondary }]}>
                {tab.label}
              </Text>
              {focused && <View style={styles.indicator} />}
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

function PublishButton() {
  return (
    <View style={styles.tab}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Publicar evento"
        onPress={() => router.push('/publish')}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}>
        <Icon name="plus" size={26} color={Colors.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.canvas,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontSize: 11 },
  indicator: {
    position: 'absolute',
    top: -1,
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.accent,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
