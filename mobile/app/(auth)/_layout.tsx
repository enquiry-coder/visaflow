import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/src/hooks';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const isDesigner = (process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE === 'designer' || process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE === 'staging');

  if (!isLoading && isAuthenticated && !isDesigner) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
