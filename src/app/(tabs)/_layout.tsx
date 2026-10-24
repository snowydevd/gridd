import { Tabs } from 'expo-router/tabs';

import { TabBar } from '@/components/tab-bar';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors: c } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.canvas } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
