import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_AVATAR } from '@/components/attendees-preview';
import { Text } from '@/components/text';
import { IconButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { Id } from '@/lib/convex';
import { attendeeCar, useAttendees } from '@/services/attendance';
import { useCurrentUser } from '@/services/user';
import { makeStyles, useTheme } from '@/theme';

// Lista completa de quiénes van a un evento. Sólo con sesión (el backend también lo exige).
export default function AttendeesScreen() {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isGuest } = useCurrentUser();
  const { attendees } = useAttendees(id as Id<'events'>);

  if (isGuest) return <Redirect href="/login" />;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton icon="back" label="Volver" onPress={() => router.back()} />
        <Text variant="title">{attendees ? `Van ${attendees.length}` : 'Quiénes van'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {attendees === undefined ? (
        <ActivityIndicator color={c.accentText} style={styles.loading} />
      ) : (
        <FlatList
          data={attendees}
          keyExtractor={(person) => person._id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xl }]}
          ListEmptyComponent={
            <Text tone="secondary" style={styles.empty}>
              Todavía no se anotó nadie.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Image
                source={item.image ? { uri: item.image } : DEFAULT_AVATAR}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <Text variant="heading" numberOfLines={1}>
                  {item.name ?? 'Sin nombre'}
                </Text>
                {item.car && (
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {attendeeCar(item.car)}
                  </Text>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.canvas },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loading: { marginTop: Spacing.xxl },
  list: { paddingHorizontal: Spacing.lg },
  empty: { textAlign: 'center', marginTop: Spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
}));
