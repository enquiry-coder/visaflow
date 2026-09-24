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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/src/hooks';

export default function LoginScreen() {
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    setError(null);
    signIn.mutate(
      { email: email.trim(), password },
      {
        onError: (e: any) => setError(e?.message ?? 'Sign in failed'),
        onSuccess: () => {
          if ((process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE !== 'designer' && process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE !== 'staging') && user) {
            router.replace('/(app)');
          }
        },
      }
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/image.png')} style={{ width: 220, height: 66 }} resizeMode="contain" />
          <Text className="mt-3 text-xs font-semibold tracking-wide" style={{ color: '#6b7a2b' }}>via Probiz InsureProofID</Text>
          <Text className="mt-4 text-3xl font-bold tracking-tight text-foreground">Staff sign in</Text>
          <Text className="mt-1 text-sm text-muted-foreground">Manage your client onboarding pipeline.</Text>

          {error && (
            <View className="mt-4 rounded-xl bg-destructive/10 p-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          )}

          <View className="mt-6 gap-3">
            <TextInput
              className="bg-card rounded-xl px-4 py-3.5 border border-border text-foreground"
              placeholder="Email"
              placeholderTextColor="#8d9d9e"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              className="bg-card rounded-xl px-4 py-3.5 border border-border text-foreground"
              placeholder="Password"
              placeholderTextColor="#8d9d9e"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={signIn.isPending}
            className="mt-5 items-center justify-center rounded-2xl bg-primary py-4 active:scale-[0.98]"
          >
            {signIn.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">Sign in</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/signup')} className="mt-4 items-center py-2">
            <Text className="text-sm text-muted-foreground">
              No account? <Text className="text-primary font-semibold">Create one</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
