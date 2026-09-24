import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/src/hooks';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = () => {
    setError(null);
    setNotice(null);

    if (!email.trim()) return setError('Enter your work email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    signUp.mutate(
      { email: email.trim(), password },
      {
        onError: (e: any) => setError(e?.message ?? 'Sign up failed. Try again.'),
        onSuccess: () => {
          // Supabase may require email confirmation before the session is usable.
          // Show a clear next-step instead of a silent dead end.
          setNotice(
            'Account created. Check your inbox to confirm your email, then sign in here.'
          );
        },
      }
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text className="text-xs font-semibold tracking-widest text-primary uppercase">VisaFlow</Text>
          <Text className="mt-2 text-3xl font-bold tracking-tight text-foreground">Create staff account</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Set up your login to manage client onboarding.
          </Text>

          {error && (
            <View className="mt-4 rounded-xl bg-destructive/10 p-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          )}
          {notice && (
            <View className="mt-4 rounded-xl bg-primary/10 p-3">
              <Text className="text-sm text-primary">{notice}</Text>
            </View>
          )}

          <View className="mt-6 gap-3">
            <TextInput
              className="bg-card rounded-xl px-4 py-3.5 border border-border text-foreground"
              placeholder="Work email"
              placeholderTextColor="#8d9d9e"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              className="bg-card rounded-xl px-4 py-3.5 border border-border text-foreground"
              placeholder="Password (8+ characters)"
              placeholderTextColor="#8d9d9e"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              className="bg-card rounded-xl px-4 py-3.5 border border-border text-foreground"
              placeholder="Confirm password"
              placeholderTextColor="#8d9d9e"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={signUp.isPending}
            className="mt-5 items-center justify-center rounded-2xl bg-primary py-4 active:scale-[0.98]"
          >
            {signUp.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">Create account</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/login')} className="mt-4 items-center py-2">
            <Text className="text-sm text-muted-foreground">
              Already have an account? <Text className="text-primary font-semibold">Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
