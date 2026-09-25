import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldUserIcon,
  UserPlusIcon,
  CheckCircle2Icon,
  BanIcon,
  RotateCcwIcon,
  MailCheckIcon,
  LogOutIcon,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useAuth, useTheme } from '@/src/hooks';

cssInterop(ShieldUserIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(UserPlusIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle2Icon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(BanIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(RotateCcwIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MailCheckIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(LogOutIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

interface AdminUser {
  id: string;
  email: string;
  created_at?: string;
  last_sign_in_at?: string;
  banned_until?: string | null;
  user_metadata?: { role?: string; full_name?: string };
}

function isBanned(u: AdminUser): boolean {
  if (!u.banned_until) return false;
  return new Date(u.banned_until).getTime() > Date.now();
}

async function adminRequest(path: string, options: RequestInit = {}) {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set — the admin API is unavailable.');
  const resp = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!resp.ok) {
    let msg = `Request failed (${resp.status})`;
    try {
      const body = await resp.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return resp.json();
}

export default function AdminScreen() {
  const { user, signOut } = useAuth();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('staff');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const adminEmails = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? 'terence@probizn.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const currentEmail = (user?.email ?? '').toLowerCase();
  const isAdmin = adminEmails.length > 0 && adminEmails.includes(currentEmail);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminRequest('/admin/users'),
    enabled: isAdmin,
  });

  const createUser = useMutation({
    mutationFn: (payload: { email: string; password: string; name: string; role: string }) =>
      adminRequest('/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      setNotice(`User ${email.trim()} created and email confirmed.`);
      setEmail('');
      setPassword('');
      setFullName('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const setBan = useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) =>
      adminRequest(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ban_duration: banned ? '876600h' : null }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (e: Error) => setError(e.message),
  });

  const onSubmit = useCallback(() => {
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError('Enter an email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    createUser.mutate({ email: email.trim(), password, name: fullName.trim(), role });
  }, [email, password, fullName, role, createUser]);

  // Non-admin: show a clear gate (designer preview auto-signs in as the demo user,
  // which is NOT in the admin allow-list, so this renders honestly instead of
  // pretending the user can manage accounts).
  if (!isAdmin) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View className="items-center gap-4 rounded-3xl bg-card border border-border p-8">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <ShieldUserIcon className="text-primary" size={28} />
            </View>
            <Text className="text-lg font-semibold text-foreground">Administrator access only</Text>
            <Text className="text-center text-sm text-muted-foreground">
              You are signed in as{' '}
              <Text className="font-semibold text-foreground">{user?.email || 'a guest'}</Text>. Ask your
              administrator to add your email to the allow-list before you can manage staff users.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const users: AdminUser[] = (usersQuery.data as any)?.users ?? [];
  const activeUsers = users.filter((u) => !isBanned(u));
  const bannedUsers = users.filter((u) => isBanned(u));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={usersQuery.isRefetching}
              onRefresh={() => usersQuery.refetch()}
              tintColor={isDark ? '#8d9d9e' : '#70797a'}
            />
          }
        >
          {/* Header */}
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-xs font-semibold tracking-widest text-primary uppercase">Administration</Text>
              <Text className="mt-1 text-3xl font-bold tracking-tight text-foreground">Staff users</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Create accounts and control who can access VisaFlow.
              </Text>
            </View>
            <View className="items-center rounded-2xl bg-primary/10 px-3 py-2">
              <Text className="text-2xl font-bold text-primary">{activeUsers.length}</Text>
              <Text className="text-[11px] font-medium text-muted-foreground">Active</Text>
            </View>
          </View>

          {/* Sign out */}
          <Pressable
            onPress={() => signOut.mutate()}
            disabled={signOut.isPending}
            className="mt-4 flex-row items-center justify-center gap-2 self-end rounded-xl border border-border px-4 py-2.5 active:opacity-70"
          >
            {signOut.isPending ? (
              <ActivityIndicator size="small" color={isDark ? '#8d9d9e' : '#70797a'} />
            ) : (
              <LogOutIcon className="text-muted-foreground" size={16} />
            )}
            <Text className="text-sm font-semibold text-muted-foreground">Sign out</Text>
          </Pressable>

          {/* Create user form */}
          <View className="mt-6 rounded-3xl bg-card border border-border p-5">
            <View className="flex-row items-center gap-2">
              <UserPlusIcon className="text-primary" size={18} />
              <Text className="text-base font-semibold text-foreground">Add a staff user</Text>
            </View>

            {error && (
              <View className="mt-3 rounded-xl bg-destructive/10 p-3">
                <Text className="text-sm text-destructive">{error}</Text>
              </View>
            )}
            {notice && (
              <View className="mt-3 rounded-xl bg-primary/10 p-3">
                <Text className="text-sm text-primary">{notice}</Text>
              </View>
            )}

            <View className="mt-4 gap-3">
              <TextInput
                className="bg-background rounded-xl px-4 py-3.5 border border-border text-foreground"
                placeholder="Staff email"
                placeholderTextColor="#8d9d9e"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                className="bg-background rounded-xl px-4 py-3.5 border border-border text-foreground"
                placeholder="Full name (optional)"
                placeholderTextColor="#8d9d9e"
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                className="bg-background rounded-xl px-4 py-3.5 border border-border text-foreground"
                placeholder="Temporary password (8+ characters)"
                placeholderTextColor="#8d9d9e"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-muted-foreground">Role:</Text>
                {['staff', 'admin'].map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRole(r)}
                    className={`rounded-full px-3 py-1.5 border ${
                      role === r ? 'bg-primary border-primary' : 'border-border'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${role === r ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={createUser.isPending}
              className="mt-4 items-center justify-center rounded-2xl bg-primary py-4 active:scale-[0.98]"
            >
              {createUser.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-semibold text-primary-foreground">Create user</Text>
              )}
            </Pressable>
          </View>

          {/* User list */}
          <Text className="mt-8 mb-3 text-sm font-semibold text-muted-foreground">Active users</Text>
          {usersQuery.isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#12667a" />
            </View>
          ) : activeUsers.length === 0 ? (
            <View className="items-center gap-2 rounded-2xl bg-card border border-border py-10">
              <MailCheckIcon className="text-muted-foreground" size={28} />
              <Text className="text-sm text-muted-foreground">No active staff users yet.</Text>
            </View>
          ) : (
            <View className="gap-3">
              {activeUsers.map((u) => (
                <View key={u.id} className="rounded-2xl bg-card border border-border p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 min-w-0">
                      <Text className="font-semibold text-foreground" numberOfLines={1}>
                        {u.user_metadata?.full_name || u.email}
                      </Text>
                      {u.user_metadata?.full_name ? (
                        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                          {u.email}
                        </Text>
                      ) : null}
                      <View className="mt-2 flex-row items-center gap-2">
                        <View className="rounded-full bg-primary/10 px-2 py-0.5">
                          <Text className="text-[11px] font-medium text-primary">
                            {(u.user_metadata?.role as string) || 'staff'}
                          </Text>
                        </View>
                        <Text className="text-[11px] text-muted-foreground">
                          {u.last_sign_in_at ? `Last sign-in ${new Date(u.last_sign_in_at).toLocaleDateString()}` : 'Never signed in'}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => setBan.mutate({ id: u.id, banned: true })}
                      disabled={setBan.isPending}
                      className="ml-3 items-center justify-center rounded-xl bg-destructive/10 p-2.5 active:scale-95"
                    >
                      <BanIcon className="text-destructive" size={18} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Suspended (banned) users */}
          {bannedUsers.length > 0 && (
            <>
              <Text className="mt-8 mb-3 text-sm font-semibold text-muted-foreground">Disabled users</Text>
              <View className="gap-3">
                {bannedUsers.map((u) => (
                  <View key={u.id} className="rounded-2xl bg-card border border-border p-4 opacity-70">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 min-w-0">
                        <Text className="font-semibold text-foreground" numberOfLines={1}>
                          {u.user_metadata?.full_name || u.email}
                        </Text>
                        {u.user_metadata?.full_name ? (
                          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                            {u.email}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => setBan.mutate({ id: u.id, banned: false })}
                        disabled={setBan.isPending}
                        className="ml-3 items-center justify-center rounded-xl bg-primary/10 p-2.5 active:scale-95"
                      >
                        <RotateCcwIcon className="text-primary" size={18} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
