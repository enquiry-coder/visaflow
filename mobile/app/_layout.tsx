import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useOffline } from '../src/hooks';
import '@/global.css';
import { type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, persistOptions } from '@/src/lib/queryClient'
import { ThemeProvider } from '@/src/providers/ThemeProvider'
import { AppProvider } from '@/src/providers/AppProvider'


function RootLayoutNav() {
  // Initialize offline monitoring
  useOffline();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="portal/[regNo]" />
      </Stack>
    </KeyboardAvoidingView>
  );
}

// Preview = the RapidNative editor ('designer') or a staging deployment.
// Exported apps and production builds run in neither mode.
const isPreview =
  process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE === 'designer' ||
  process.env.EXPO_PUBLIC_RAPIDNATIVE_MODE === 'staging';

function QueryProvider({ children }: { children: ReactNode }) {
  if (isPreview) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  )
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryProvider>
          <AppProvider>
            <RootLayoutNav />
          </AppProvider>
        </QueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
