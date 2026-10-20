import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showDialog } from '@/components/dialog';
import { EventMap, type EventMapHandle } from '@/components/event-map';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button, Chip, Fade, IconButton, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { carErrorMessage } from '@/services/cars';
import { EVENT_KINDS, KIND_LABELS, usePublishEvent, type EventKind } from '@/services/events';
import { useLastKnownLocation, type LatLng } from '@/services/location';
import { useCurrentUser } from '@/services/user';
import { UY_BOUNDS } from '../../convex/lib/validation';

const STEPS = ['Evento', 'Cuándo', 'Dónde', 'Portada'] as const;
const REVIEW = STEPS.length;

const times = ['18:00', '19:00', '20:00', '20:30', '21:00', '22:00'];
const durations = [2, 3, 4, 6];

// Montevideo; el mapa arranca acá si no se conoce la ubicación del organizador.
const INITIAL_REGION = { latitude: -34.88, longitude: -56.16, latitudeDelta: 0.15, longitudeDelta: 0.15 };
const PLACE_DELTA = 0.01;
// La misma que usa la app cuando un evento no tiene portada.
const DEFAULT_COVER = require('@/assets/images/meets/midnight-rambla.jpg');

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function nextDays(count: number) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

function formatDay(d: Date) {
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
}

/** Día elegido + "HH:MM", en la hora local del teléfono. */
function startOf(day: Date, time: string) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function inUruguay({ latitude, longitude }: LatLng) {
  return (
    latitude >= UY_BOUNDS.minLat &&
    latitude <= UY_BOUNDS.maxLat &&
    longitude >= UY_BOUNDS.minLon &&
    longitude <= UY_BOUNDS.maxLon
  );
}

// Sólo admins y publishers pueden publicar (el backend lo exige en events.create);
// esto cubre a quien llegue por deep link.
export default function PublishScreen() {
  const { isLoading, isPublisher } = useCurrentUser();
  if (isLoading) return null;
  if (!isPublisher) return <Redirect href="/" />;
  return <PublishForm />;
}

function PublishForm() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const location = useLastKnownLocation();
  const publish = usePublishEvent();
  const map = useRef<EventMapHandle>(null);
  const scroll = useRef<ScrollView>(null);
  const writingDescription = useRef(false);
  // La hora se toma una vez al montar: llamar a Date.now() en cada render rompe la pureza del React Compiler.
  const [now] = useState(Date.now);
  const [days] = useState(() => nextDays(14));

  const [name, setName] = useState('');
  const [kind, setKind] = useState<EventKind | null>(null);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(3);
  const [placeName, setPlaceName] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Hoy sólo se ofrecen los horarios que todavía no pasaron.
  const availableTimes = dayIndex === null ? times : times.filter((t) => startOf(days[dayIndex], t) > now);
  const startsAt = dayIndex !== null && time && availableTimes.includes(time) ? startOf(days[dayIndex], time) : null;
  const outsideUruguay = coords !== null && !inUruguay(coords);

  const canContinue = [
    name.trim().length >= 3 && !!kind,
    startsAt !== null,
    placeName.trim().length >= 2 && coords !== null && !outsideUruguay,
    true,
    true,
  ][step];

  const searchPlace = async () => {
    const address = query.trim();
    if (!address || searching) return;
    setSearching(true);
    try {
      // En Android el geocoder del sistema exige permiso de ubicación.
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showDialog('Sin acceso a tu ubicación', 'Activalo para buscar direcciones, o tocá el mapa para marcar el lugar.');
        return;
      }
      const [found] = await Location.geocodeAsync(`${address}, Uruguay`);
      if (!found) {
        showDialog('No encontramos esa dirección', 'Probá escribirla de otra forma o tocá el mapa para marcar el lugar.');
        return;
      }
      const point = { latitude: found.latitude, longitude: found.longitude };
      setCoords(point);
      if (!placeName.trim()) setPlaceName(address);
      map.current?.focus(point, PLACE_DELTA);
    } catch (error) {
      if (__DEV__) console.log('[publish] geocode falló:', error);
      showDialog('No pudimos buscar la dirección', 'Tocá el mapa para marcar el lugar.');
    } finally {
      setSearching(false);
    }
  };

  const pickCover = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 1, // Se comprime una sola vez, al subirla.
    });
    if (!picked.canceled) setCoverUri(picked.assets[0].uri);
  };

  const submit = async () => {
    if (!kind || startsAt === null || !coords) return;
    setPublishing(true);
    try {
      const slug = await publish(
        {
          title: name,
          description,
          kind,
          startsAt,
          endsAt: startsAt + duration * 60 * 60 * 1000,
          placeName,
          lat: coords.latitude,
          lon: coords.longitude,
        },
        coverUri ?? undefined,
      );
      router.replace({ pathname: '/event/[id]', params: { id: slug } });
      showDialog('¡Publicado!', 'Tu evento ya aparece en Inicio y en el mapa.');
    } catch (error) {
      if (__DEV__) console.log('[publish] falló:', error);
      showDialog('No pudimos publicar', carErrorMessage(error, 'Revisá tu conexión y probá de nuevo.'));
      setPublishing(false);
    }
  };

  const next = () => (step < REVIEW ? setStep(step + 1) : void submit());

  // La descripción está al final del paso: cuando aparece el teclado (o el texto crece) se baja hasta
  // ella para que se vea lo que se escribe.
  const revealDescription = () => {
    if (writingDescription.current) scroll.current?.scrollToEnd({ animated: true });
  };
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', revealDescription);
    return () => sub.remove();
  }, []);

  const back = () => {
    if (publishing) return;
    if (step === 0) router.back();
    else setStep(step - 1);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // Con edge-to-edge (obligatorio en Android desde SDK 53) el sistema ya no achica la pantalla al
      // abrir el teclado: en las dos plataformas hay que hacerle lugar acá.
      behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerRow}>
          <IconButton icon={step === 0 ? 'close' : 'back'} label={step === 0 ? 'Cerrar' : 'Atrás'} onPress={back} />
          <Text variant="overline" tone="secondary">
            {step < REVIEW ? `Paso ${step + 1} de ${STEPS.length}` : 'Revisión'}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.progress}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.progressSeg, i <= step && styles.progressSegActive]} />
          ))}
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <StepTitle title="¿Cómo se llama?" />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej: Juntada Nocturna Pocitos"
              placeholderTextColor={Colors.textDisabled}
              style={styles.input}
              maxLength={60}
              autoFocus
            />
            <Text variant="overline" tone="secondary" style={styles.fieldLabel}>
              Tipo
            </Text>
            <View style={styles.wrap}>
              {EVENT_KINDS.map((k) => (
                <Chip key={k} label={KIND_LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <StepTitle title="¿Cuándo es?" />
            <Text variant="overline" tone="secondary" style={styles.fieldLabel}>
              Día
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.days}>
              {days.map((d, i) => {
                const selected = dayIndex === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setDayIndex(i)}
                    style={[styles.day, selected && styles.daySelected]}>
                    <Text variant="caption" style={{ color: selected ? Colors.onAccent : Colors.textSecondary }}>
                      {i === 0 ? 'Hoy' : dayNames[d.getDay()]}
                    </Text>
                    <Text variant="title" style={{ color: selected ? Colors.onAccent : Colors.text }}>
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text variant="overline" tone="secondary" style={styles.fieldLabel}>
              Hora de inicio
            </Text>
            {availableTimes.length > 0 ? (
              <View style={styles.wrap}>
                {availableTimes.map((t) => (
                  <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
                ))}
              </View>
            ) : (
              <Text tone="secondary">Ya no quedan horarios para hoy. Elegí otro día.</Text>
            )}
            <Text variant="overline" tone="secondary" style={styles.fieldLabel}>
              Duración
            </Text>
            <View style={styles.wrap}>
              {durations.map((h) => (
                <Chip key={h} label={`${h} h`} selected={duration === h} onPress={() => setDuration(h)} />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <StepTitle title="¿Dónde?" />
            <TextInput
              value={placeName}
              onChangeText={setPlaceName}
              placeholder="Nombre del lugar, ej: Explanada de Kibón"
              placeholderTextColor={Colors.textDisabled}
              style={styles.input}
              maxLength={120}
            />
            <View style={[styles.search, { marginTop: Spacing.md }]}>
              <Icon name="search" size={18} color={Colors.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={searchPlace}
                placeholder="Buscar dirección"
                placeholderTextColor={Colors.textDisabled}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {searching && <ActivityIndicator size="small" color={Colors.accent} />}
            </View>
            <EventMap
              ref={map}
              style={styles.map}
              initialRegion={
                location ? { ...location, latitudeDelta: 0.05, longitudeDelta: 0.05 } : INITIAL_REGION
              }
              showsUserLocation={!!location}
              pins={
                coords
                  ? [{ id: 'place', label: placeName.trim() || 'Lugar del evento', coordinate: coords, x: 0.5, y: 0.5 }]
                  : []
              }
              selectedId="place"
              // En web el mapa es estilizado y no devuelve coordenadas.
              onPress={(point) => point && setCoords(point)}
            />
            <Text variant="caption" tone={outsideUruguay ? undefined : 'secondary'} style={outsideUruguay && styles.error}>
              {outsideUruguay
                ? 'El lugar tiene que estar en Uruguay.'
                : coords
                  ? 'Tocá el mapa para mover el punto.'
                  : 'Buscá la dirección o tocá el mapa para marcar el punto exacto.'}
            </Text>
          </>
        )}

        {step === 3 && (
          <>
            <StepTitle title="Elegí una portada" />
            <Pressable
              onPress={pickCover}
              accessibilityRole="button"
              accessibilityLabel={coverUri ? 'Cambiar portada' : 'Subir portada'}
              style={[styles.cover, !coverUri && styles.coverUpload]}>
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <>
                  <Icon name="camera" size={26} color={Colors.textSecondary} />
                  <Text variant="label" tone="secondary">
                    Subir foto (opcional)
                  </Text>
                </>
              )}
            </Pressable>
            {coverUri ? (
              <View style={styles.coverActions}>
                <Button label="Cambiar" variant="secondary" icon="photo" onPress={pickCover} style={{ flex: 1 }} />
                <Button label="Quitar" variant="ghost" onPress={() => setCoverUri(null)} style={{ flex: 1 }} />
              </View>
            ) : (
              <Text variant="caption" tone="secondary" style={styles.coverHint}>
                Si no subís una, el evento usa la portada de Gridd.
              </Text>
            )}
            <Text variant="overline" tone="secondary" style={styles.fieldLabel}>
              Descripción (opcional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              onFocus={() => (writingDescription.current = true)}
              onBlur={() => (writingDescription.current = false)}
              onContentSizeChange={revealDescription}
              placeholder="Algo que la gente tenga que saber"
              placeholderTextColor={Colors.textDisabled}
              style={[styles.input, styles.textarea]}
              multiline
              maxLength={300}
            />
          </>
        )}

        {step === REVIEW && (
          <>
            <StepTitle title="Revisá tu evento" />
            <View style={styles.preview}>
              <Image source={coverUri ? { uri: coverUri } : DEFAULT_COVER} style={StyleSheet.absoluteFill} contentFit="cover" />
              <Fade style={{ top: '30%' }} to="rgba(11,11,12,0.95)" />
              <View style={styles.previewBody}>
                {kind && <Tag label={KIND_LABELS[kind]} />}
                <Text variant="title" numberOfLines={2}>
                  {name}
                </Text>
                <Text variant="label" tone="secondary">
                  {dayIndex !== null && formatDay(days[dayIndex])} · {time} hs · {duration} h
                </Text>
                <Text variant="label" tone="secondary" numberOfLines={1}>
                  {placeName}
                </Text>
              </View>
            </View>
            <View style={styles.editRow}>
              {STEPS.map((s, i) => (
                <Pressable key={s} onPress={() => setStep(i)} style={styles.editChip}>
                  <Icon name="edit" size={14} color={Colors.textSecondary} />
                  <Text variant="caption" tone="secondary">
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Button
          label={step === REVIEW ? 'Publicar evento' : 'Siguiente'}
          icon={step === REVIEW ? 'check' : 'arrow'}
          iconPosition={step === REVIEW ? 'start' : 'end'}
          disabled={!canContinue}
          loading={publishing}
          onPress={next}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function StepTitle({ title }: { title: string }) {
  return (
    <Text variant="display" style={styles.stepTitle}>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  header: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { flexDirection: 'row', gap: 6 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.border },
  progressSegActive: { backgroundColor: Colors.accent },
  body: { padding: Spacing.lg, paddingTop: Spacing.xl },
  stepTitle: { marginBottom: Spacing.xl },
  fieldLabel: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  input: {
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 17,
  },
  textarea: { minHeight: 110, paddingTop: Spacing.md, textAlignVertical: 'top', fontSize: 15 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  bleed: { marginHorizontal: -Spacing.lg },
  days: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  day: {
    width: 60,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  daySelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontFamily: Fonts.body, fontSize: 15, height: '100%' },
  map: {
    height: 240,
    marginVertical: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  coverActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  coverHint: { marginTop: Spacing.sm },
  error: { color: Colors.error },
  coverUpload: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  preview: {
    height: 300,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    justifyContent: 'flex-end',
  },
  previewBody: { padding: Spacing.lg, gap: Spacing.xs },
  editRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
