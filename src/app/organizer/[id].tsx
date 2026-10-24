import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showDialog } from '@/components/dialog';
import { EventRow } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button, IconButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { carErrorMessage } from '@/services/cars';
import { toCardEvent } from '@/services/events';
import { useLastKnownLocation } from '@/services/location';
import { useFollowToggle, useOrganizer } from '@/services/organizers';
import { useCurrentUser } from '@/services/user';
import { makeStyles, useTheme } from '@/theme';

const DEFAULT_AVATAR = require('@/assets/images/meets/avatar.jpg');

export default function OrganizerScreen() {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const profile = useOrganizer(id);
  const location = useLastKnownLocation();
  const { isSignedIn, user } = useCurrentUser();
  const toggleFollow = useFollowToggle();

  const isMe = !!profile && user?._id === profile._id;

  const share = (name: string) => {
    const upcoming = profile?.upcoming.length ?? 0;
    void Share.share({
      message:
        upcoming > 0
          ? `Mirá los encuentros de ${name} en Gridd: tiene ${upcoming === 1 ? '1 próximo' : `${upcoming} próximos`}.`
          : `Seguí a ${name} en Gridd para enterarte de sus próximos encuentros.`,
    });
  };

  const openMore = () => {
    if (!profile) return;
    const name = profile.name ?? 'Organizador';
    showDialog(name, undefined, [
      { text: 'Compartir perfil', onPress: () => share(name) },
      ...(isMe
        ? []
        : [
            {
              text: 'Reportar usuario',
              style: 'destructive' as const,
              // Un invitado primero tiene que iniciar sesión.
              onPress: () =>
                isSignedIn
                  ? router.push({ pathname: '/report', params: { userId: profile._id, title: name } })
                  : router.push('/login'),
            },
          ]),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      <IconButton icon="back" label="Volver" onPress={() => router.back()} />
      {profile && <IconButton icon="more" label="Más opciones" onPress={openMore} />}
    </View>
  );

  if (profile === undefined) {
    return (
      <View style={styles.screen}>
        {header}
        <ActivityIndicator color={c.accentText} style={styles.loading} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.missing}>
          <Text tone="secondary">Este organizador ya no existe.</Text>
        </View>
      </View>
    );
  }

  const published = profile.upcoming.length + profile.past.length;
  const stats = [
    { value: profile.followerCount, label: profile.followerCount === 1 ? 'Seguidor' : 'Seguidores' },
    { value: published, label: published === 1 ? 'Evento' : 'Eventos' },
  ];
  const sections = [
    { label: 'Próximos', events: profile.upcoming, dimmed: false },
    { label: 'Anteriores', events: profile.past, dimmed: true },
  ];

  const follow = async () => {
    // Un invitado no puede seguir: primero tiene que iniciar sesión.
    if (!isSignedIn) return router.push('/login');
    try {
      await toggleFollow({ organizerId: profile._id });
    } catch (error) {
      if (__DEV__) console.log('[organizer] seguir falló:', error);
      showDialog('No pudimos actualizar', carErrorMessage(error, 'Revisá tu conexión y probá de nuevo.'));
    }
  };

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}>
        <View style={styles.identity}>
          <Image source={profile.image ? { uri: profile.image } : DEFAULT_AVATAR} style={styles.avatar} contentFit="cover" />
          <View style={styles.nameRow}>
            <Text variant="title">{profile.name ?? 'Organizador'}</Text>
            {profile.verified && <Icon name="verified" size={18} color={c.accentText} />}
          </View>
        </View>

        <View style={styles.stats}>
          {stats.map((s, i) => (
            <View key={s.label} style={[styles.stat, i > 0 && styles.statDivider]}>
              <Text variant="title">{s.value}</Text>
              <Text variant="caption" tone="secondary">
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {!isMe && (
          <Button
            label={profile.isFollowing ? 'Siguiendo' : 'Seguir'}
            icon={profile.isFollowing ? 'check' : 'plus'}
            variant={profile.isFollowing ? 'secondary' : 'primary'}
            onPress={() => void follow()}
          />
        )}

        {published === 0 ? (
          <Text tone="secondary" style={styles.empty}>
            Todavía no publicó eventos.
          </Text>
        ) : (
          sections.map(
            (section) =>
              section.events.length > 0 && (
                <View key={section.label} style={styles.section}>
                  <Text variant="overline" tone="secondary">
                    {section.label}
                  </Text>
                  {section.events.map((e) => (
                    <EventRow key={e._id} event={toCardEvent(e, location)} dimmed={section.dimmed} />
                  ))}
                </View>
              ),
          )
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.canvas },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loading: { marginTop: Spacing.xxl },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.xl },
  identity: { alignItems: 'center', gap: Spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: c.border },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: c.border },
  empty: { textAlign: 'center' },
  section: { gap: Spacing.md },
}));
