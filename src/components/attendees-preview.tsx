import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Spacing } from '@/constants/theme';
import type { Id } from '@/lib/convex';
import { useAttendees } from '@/services/attendance';
import { useCurrentUser } from '@/services/user';
import { makeStyles, useTheme } from '@/theme';

const MAX_FACES = 5;
const FACE = 28;
export const DEFAULT_AVATAR = require('@/assets/images/meets/avatar.jpg');

/** "N van" con las fotos de los primeros anotados. Un invitado ve sólo el número. */
export function AttendeesPreview({ eventId, going }: { eventId?: Id<'events'>; going: number }) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const { isSignedIn, isGuest } = useCurrentUser();
  const { attendees } = useAttendees(eventId);
  const faces = attendees?.slice(0, MAX_FACES) ?? [];
  const canOpen = isSignedIn && !!eventId && (attendees?.length ?? 0) > 0;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!canOpen && !(isGuest && going > 0)}
      onPress={() =>
        canOpen ? router.push({ pathname: '/attendees/[id]', params: { id: eventId! } }) : router.push('/login')
      }
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      {faces.length > 0 ? (
        <View style={[styles.faces, { width: FACE + (faces.length - 1) * (FACE - 10) }]}>
          {faces.map((person, i) => (
            <Image
              key={person._id}
              source={person.image ? { uri: person.image } : DEFAULT_AVATAR}
              style={[styles.face, { left: i * (FACE - 10), zIndex: MAX_FACES - i }]}
              contentFit="cover"
            />
          ))}
        </View>
      ) : (
        <Icon name="group" size={16} color={c.textSecondary} />
      )}
      <Text variant="label" tone="secondary" style={{ flexShrink: 1 }}>
        {going} van
        {isGuest && going > 0 ? ' · Iniciá sesión para ver quiénes' : ''}
      </Text>
      {canOpen && (
        <Text variant="label" tone="accent">
          Ver todos
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  faces: { height: FACE },
  face: {
    position: 'absolute',
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    borderWidth: 2,
    borderColor: c.canvas,
  },
}));
