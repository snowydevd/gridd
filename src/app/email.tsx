import { Text } from '@/components/text';
import { Button, IconButton } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { authErrorMessage, validateCredentials, type PasswordFlow } from '@/lib/auth-errors';
import { wait, withTimeout } from '@/lib/with-timeout';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/////////// @CONVEX ///////////
import { useAuthActions } from '@convex-dev/auth/react';

// Los flujos del provider Password de convex/auth.ts.
type Mode = PasswordFlow;

const COPY: Record<Mode, { title: string; subtitle: string; submit: string; busy: string }> = {
  signIn: { title: 'Entrar', subtitle: 'Con tu email y contraseña.', submit: 'Entrar', busy: 'Entrando…' },
  signUp: {
    title: 'Crear cuenta',
    subtitle: 'Te lleva menos de un minuto.',
    submit: 'Crear cuenta',
    busy: 'Creando tu cuenta…',
  },
  reset: {
    title: 'Recuperar contraseña',
    subtitle: 'Te mandamos un código de 8 dígitos a tu email.',
    submit: 'Mandar código',
    busy: 'Mandando código…',
  },
  'reset-verification': {
    title: 'Nueva contraseña',
    subtitle: 'Poné el código que te llegó y elegí una contraseña nueva.',
    submit: 'Cambiar contraseña',
    busy: 'Cambiando contraseña…',
  },
};

export default function EmailScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthActions();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'signUp' ? 'signUp' : 'signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
    setCode('');
  };

  // Al escribir se borra el error anterior, así no queda un mensaje viejo en pantalla.
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (error) setError(null);
  };

  // Cierra email + login y vuelve a la app.
  const done = () => (router.canDismiss() ? router.dismissAll() : router.replace('/'));

  const submit = async () => {
    if (busy) return;
    // Lo que se puede revisar acá no viaja al servidor.
    const invalid = validateCredentials(mode, { name, email, password, code });
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const trimmed = email.trim();
      if (mode === 'signIn') {
        await withTimeout(signIn('password', { flow: 'signIn', email: trimmed, password }));
      } else if (mode === 'signUp') {
        await withTimeout(signIn('password', { flow: 'signUp', email: trimmed, password, name: name.trim() }));
      } else if (mode === 'reset') {
        // Mandar el mail puede tardar más que un login.
        await withTimeout(signIn('password', { flow: 'reset', email: trimmed }), 25_000);
        switchMode('reset-verification');
        setNotice(`Te mandamos un código a ${trimmed}. Puede tardar un minuto en llegar.`);
        return;
      } else {
        await withTimeout(
          signIn('password', { flow: 'reset-verification', email: trimmed, code: code.trim(), newPassword: password }),
        );
      }
      // Un instante de "¡Listo!" antes de cerrar, para que se note que funcionó.
      setSuccess(true);
      await wait(700);
      done();
    } catch (e) {
      // Error esperado (credenciales, código, red): se muestra en pantalla, no en LogBox.
      setError(authErrorMessage(e, mode));
      if (mode === 'signIn' || mode === 'reset-verification') setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const ready =
    email.trim().length > 0 &&
    (mode === 'reset' || password.length > 0) &&
    (mode !== 'signUp' || name.trim().length > 0) &&
    (mode !== 'reset-verification' || code.trim().length > 0);

  const copy = COPY[mode];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton icon="back" label="Volver" onPress={() => router.back()} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.lg }]}
        keyboardShouldPersistTaps="handled">
        <Text variant="display">{copy.title}</Text>
        <Text tone="secondary" style={styles.subtitle}>
          {copy.subtitle}
        </Text>

        <View style={styles.fields} pointerEvents={busy ? 'none' : 'auto'}>
          {mode === 'signUp' && (
            <Field label="Nombre" value={name} onChangeText={edit(setName)} autoComplete="name" textContentType="name" maxLength={50} />
          )}
          <Field
            label="Email"
            value={email}
            onChangeText={edit(setEmail)}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={mode !== 'reset-verification'}
          />
          {mode === 'reset-verification' && (
            <Field
              label="Código"
              value={code}
              onChangeText={edit(setCode)}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              keyboardType="number-pad"
              maxLength={8}
            />
          )}
          {mode !== 'reset' && (
            <Field
              label={mode === 'reset-verification' ? 'Contraseña nueva' : 'Contraseña'}
              value={password}
              onChangeText={edit(setPassword)}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
              onSubmitEditing={ready ? submit : undefined}
            />
          )}
          {(mode === 'signUp' || mode === 'reset-verification') && (
            <Text variant="caption" tone="secondary">
              Al menos 8 caracteres, con letras y números.
            </Text>
          )}
        </View>

        {notice && (
          <Text variant="label" tone="accent" style={styles.error}>
            {notice}
          </Text>
        )}
        {error && (
          <Text variant="label" tone="error" style={styles.error}>
            {error}
          </Text>
        )}

        <Button
          label={success ? '¡Listo!' : busy ? copy.busy : copy.submit}
          icon={success ? 'check' : undefined}
          onPress={submit}
          loading={busy && !success}
          disabled={!ready || success}
          style={styles.submit}
        />

        {mode === 'signIn' && (
          <>
            <Link label="Me olvidé la contraseña" onPress={() => switchMode('reset')} />
            <Link label="¿No tenés cuenta? Creá una" onPress={() => switchMode('signUp')} />
          </>
        )}
        {mode === 'signUp' && <Link label="¿Ya tenés cuenta? Entrá" onPress={() => switchMode('signIn')} />}
        {mode === 'reset-verification' && <Link label="Reenviar código" onPress={() => switchMode('reset')} />}
        {(mode === 'reset' || mode === 'reset-verification') && (
          <Link label="Volver a entrar" onPress={() => switchMode('signIn')} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text variant="overline" tone="secondary">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={Colors.textDisabled}
        style={[styles.input, input.editable === false && styles.inputDisabled]}
        selectionColor={Colors.accent}
        {...input}
      />
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.link}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  header: { paddingHorizontal: Spacing.lg },
  body: { padding: Spacing.lg, paddingTop: Spacing.xl },
  subtitle: { marginTop: Spacing.sm },
  fields: { gap: Spacing.lg, marginTop: Spacing.xl },
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
  inputDisabled: { color: Colors.textSecondary },
  error: { marginTop: Spacing.lg },
  submit: { marginTop: Spacing.xl },
  link: { alignItems: 'center', paddingVertical: Spacing.md },
});
