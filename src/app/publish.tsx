import { Image, type ImageSource } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { StylizedMap } from '@/components/stylized-map';
import { Text } from '@/components/text';
import { Button, Chip, Fade, IconButton, Tag } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { categories, type Category } from '@/data/events';

const STEPS = ['Evento', 'Cuándo', 'Dónde', 'Portada'] as const;
const REVIEW = STEPS.length;

const times = ['18:00', '19:00', '20:00', '20:30', '21:00', '22:00'];

const places = [
  { id: 'kibon', name: 'Explanada de Kibón', area: 'Pocitos', x: 0.56, y: 0.6 },
  { id: 'virgilio', name: 'Plaza Virgilio', area: 'Punta Gorda', x: 0.84, y: 0.68 },
  { id: 'pinar', name: 'Autódromo El Pinar', area: 'Canelones', x: 0.22, y: 0.3 },
];

const covers: ImageSource[] = [
  require('@/assets/images/meets/midnight-rambla.jpg'),
  require('@/assets/images/meets/jdm-garage.jpg'),
  require('@/assets/images/meets/gtr-neon.jpg'),
];

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

export default function PublishScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cover, setCover] = useState<number | null>(null);
  const [description, setDescription] = useState('');

  const days = nextDays(14);
  const place = places.find((p) => p.id === placeId);

  const canContinue = [
    name.trim().length >= 3 && !!category,
    dayIndex !== null && !!time,
    !!place,
    cover !== null,
    true,
  ][step];

  const next = () => {
    if (step < REVIEW) {
      setStep(step + 1);
      return;
    }
    Alert.alert('¡Publicado!', 'Tu evento ya aparece en Inicio y en el mapa.');
    router.back();
  };

  const back = () => (step === 0 ? router.back() : setStep(step - 1));

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              {categories.map((c) => (
                <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
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
            <View style={styles.wrap}>
              {times.map((t) => (
                <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <StepTitle title="¿Dónde?" />
            <View style={styles.search}>
              <Icon name="search" size={18} color={Colors.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar lugar o dirección"
                placeholderTextColor={Colors.textDisabled}
                style={styles.searchInput}
              />
            </View>
            <StylizedMap
              style={styles.map}
              pins={places.map((p) => ({ id: p.id, x: p.x, y: p.y, label: p.name }))}
              selectedId={placeId ?? undefined}
              onSelect={setPlaceId}
            />
            {places
              .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
              .map((p) => {
                const selected = p.id === placeId;
                return (
                  <Pressable key={p.id} onPress={() => setPlaceId(p.id)} style={styles.placeRow}>
                    <Icon name="pin" size={20} color={selected ? Colors.accent : Colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text variant="heading">{p.name}</Text>
                      <Text variant="caption" tone="secondary">
                        {p.area}
                      </Text>
                    </View>
                    {selected && <Icon name="check" size={20} color={Colors.accent} />}
                  </Pressable>
                );
              })}
          </>
        )}

        {step === 3 && (
          <>
            <StepTitle title="Elegí una portada" />
            <View style={styles.covers}>
              {covers.map((src, i) => (
                <Pressable
                  key={i}
                  onPress={() => setCover(i)}
                  accessibilityLabel={`Portada ${i + 1}`}
                  style={[styles.cover, cover === i && styles.coverSelected]}>
                  <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" />
                </Pressable>
              ))}
              <Pressable style={[styles.cover, styles.coverUpload]} accessibilityLabel="Subir foto">
                <Icon name="camera" size={22} color={Colors.textSecondary} />
                <Text variant="caption" tone="secondary">
                  Subir
                </Text>
              </Pressable>
            </View>
            <Text variant="overline" tone="secondary" style={styles.fieldLabel}>
              Descripción (opcional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
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
              {cover !== null && <Image source={covers[cover]} style={StyleSheet.absoluteFill} contentFit="cover" />}
              <Fade style={{ top: '30%' }} to="rgba(11,11,12,0.95)" />
              <View style={styles.previewBody}>
                {category && <Tag label={category} />}
                <Text variant="title" numberOfLines={2}>
                  {name}
                </Text>
                <Text variant="label" tone="secondary">
                  {dayIndex !== null && formatDay(days[dayIndex])} · {time} hs
                </Text>
                <Text variant="label" tone="secondary">
                  {place?.name}, {place?.area}
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
    height: 180,
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
  covers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cover: {
    width: '48.5%',
    aspectRatio: 16 / 10,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  coverSelected: { borderColor: Colors.accent },
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
