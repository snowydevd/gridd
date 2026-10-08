import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptionPicker } from '@/components/option-picker';
import { Text } from '@/components/text';
import { Button, Card, IconButton } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { Id } from '@/lib/convex';
import { withTimeout } from '@/lib/with-timeout';
import {
  carErrorMessage,
  findModel,
  modelYears,
  useCar,
  useCarActions,
  VEHICLE_CATALOG,
  type Car,
} from '@/services/cars';

const MAKES = VEHICLE_CATALOG.map((m) => m.name);
const CURRENT_YEAR = new Date().getFullYear();

/** `/garage/new` agrega un auto; `/garage/<id>` edita uno existente. */
export default function CarFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { car, isLoading } = useCar(isNew ? undefined : (id as Id<'cars'>));

  if (!isNew && isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }
  if (!isNew && !car) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text tone="secondary">Este auto ya no está en tu garage.</Text>
        <Button label="Volver" variant="secondary" onPress={() => router.back()} style={{ marginTop: Spacing.lg }} />
      </View>
    );
  }
  // `key` reinicia el formulario si cambia el auto.
  return <CarForm key={car?._id ?? 'new'} car={car} />;
}

function CarForm({ car }: { car: Car | null }) {
  const insets = useSafeAreaInsets();
  const { addCar, updateCar, removeCar } = useCarActions();
  const [make, setMake] = useState<string | null>(car?.make ?? null);
  const [model, setModel] = useState<string | null>(car?.model ?? null);
  const [year, setYear] = useState<number | null>(car?.year ?? null);
  const [version, setVersion] = useState(car?.version ?? '');
  const [isModified, setIsModified] = useState(car?.isModified ?? false);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const models = VEHICLE_CATALOG.find((m) => m.name === make)?.models.map((m) => m.name) ?? [];
  const catalogModel = make && model ? findModel(make, model) : undefined;
  const years = catalogModel ? modelYears(catalogModel, CURRENT_YEAR) : [];
  const ready = !!make && !!model && !!year;

  // Al cambiar la marca o el modelo, lo que dependía de eso puede dejar de ser válido.
  const pickMake = (value: string) => {
    if (value === make) return;
    setMake(value);
    setModel(null);
    setYear(null);
    setError(null);
  };
  const pickModel = (value: string) => {
    setModel(value);
    const found = make ? findModel(make, value) : undefined;
    if (year && found && !modelYears(found, CURRENT_YEAR).includes(year)) setYear(null);
    setError(null);
  };

  const save = async () => {
    if (!make || !model || !year || busy) return;
    setBusy('save');
    setError(null);
    try {
      const input = { make, model, year, version: version.trim() || undefined, isModified };
      await withTimeout(car ? updateCar(car._id, input) : addCar(input));
      router.back();
    } catch (e) {
      setError(carErrorMessage(e, 'No pudimos guardar el auto. Probá de nuevo.'));
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    if (!car) return;
    Alert.alert('Eliminar auto', `¿Sacar el ${car.make} ${car.model} de tu garage?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          setError(null);
          try {
            await withTimeout(removeCar(car._id));
            router.back();
          } catch (e) {
            setError(carErrorMessage(e, 'No pudimos eliminar el auto. Probá de nuevo.'));
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton icon="close" label="Cerrar" onPress={() => router.back()} />
        <Text variant="title">{car ? 'Editar auto' : 'Nuevo auto'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.fields} pointerEvents={busy ? 'none' : 'auto'}>
          <OptionPicker label="Marca" value={make} options={MAKES} onChange={pickMake} searchable />
          <OptionPicker
            label="Modelo"
            value={model}
            options={models}
            onChange={pickModel}
            placeholder={make ? 'Elegir' : 'Elegí la marca primero'}
            disabled={!make}
            searchable
          />
          <OptionPicker
            label="Año"
            value={year}
            options={years}
            onChange={setYear}
            placeholder={model ? 'Elegir' : 'Elegí el modelo primero'}
            disabled={!model}
          />

          <View style={styles.field}>
            <Text variant="overline" tone="secondary">
              Versión (opcional)
            </Text>
            <TextInput
              value={version}
              onChangeText={setVersion}
              placeholder="Ej: G5 1.6, GTI, Type R"
              placeholderTextColor={Colors.textDisabled}
              selectionColor={Colors.accent}
              maxLength={40}
              style={styles.input}
            />
          </View>

          <Card style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text variant="heading">Modificado</Text>
              <Text variant="caption" tone="secondary">
                Tuning, stance, motor, escape…
              </Text>
            </View>
            <Switch
              value={isModified}
              onValueChange={setIsModified}
              trackColor={{ true: Colors.accent, false: Colors.raised }}
              thumbColor={isModified ? Colors.onAccent : Colors.textSecondary}
            />
          </Card>
        </View>

        {error && (
          <Text variant="label" tone="error" style={styles.error}>
            {error}
          </Text>
        )}

        <Button
          label={busy === 'save' ? 'Guardando…' : car ? 'Guardar cambios' : 'Agregar al garage'}
          onPress={save}
          loading={busy === 'save'}
          disabled={!ready || busy === 'delete'}
          style={styles.submit}
        />
        {car && (
          <Button
            label={busy === 'delete' ? 'Eliminando…' : 'Eliminar auto'}
            variant="ghost"
            onPress={confirmDelete}
            loading={busy === 'delete'}
            disabled={busy === 'save'}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  centered: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: { padding: Spacing.lg },
  fields: { gap: Spacing.lg },
  field: { gap: Spacing.sm },
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  error: { marginTop: Spacing.lg },
  submit: { marginTop: Spacing.xl },
});
