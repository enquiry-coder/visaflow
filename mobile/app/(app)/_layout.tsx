import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/src/hooks';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const isDesigner = (process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE === 'designer' || process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE === 'staging');

  if (!isLoading && !isAuthenticated && !isDesigner) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="client/[clientId]" />
    </Stack>
  );
}
