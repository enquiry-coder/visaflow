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
  ArrowRightLeftIcon,
  PencilIcon,
  KeyRoundIcon,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useApp, useAuth, useTheme } from '@/src/hooks';
import { isValidPassword, passwordError } from '@/src/lib/password';
import { router } from 'expo-router';

cssInterop(ShieldUserIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(UserPlusIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle2Icon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(BanIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(RotateCcwIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MailCheckIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(LogOutIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ArrowRightLeftIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(PencilIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(KeyRoundIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const ADMIN_KEY = process.env.EXPO_PUBLIC_ADMIN_KEY ?? '';

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

async function adminRequest(path: string, options: RequestInit & { token?: string | null } = {}) {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set — the admin API is unavailable.');
  const { token, ...rest } = options;
  const resp = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {}),
      ...(token ? { 'x-supabase-token': token } : {}),
      ...(rest.headers || {}),
    },
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
  const { user, session, userRole, userFullName, signOut } = useAuth();
  const { client } = useApp();
  const token = session?.access_token ?? null;
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('staff');
  const [fromStaff, setFromStaff] = useState('');
  const [toStaff, setToStaff] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignNotice, setReassignNotice] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionNotice, setUserActionNotice] = useState<string | null>(null);

  const adminEmails = (
    `${process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? ''},terence@probizn.com`
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const currentEmail = (user?.email ?? '').toLowerCase();
  // "Admin" is recognized by metadata role first (robust across environments),
  // with the email allow-list as a fallback for accounts whose metadata lacks role.
  // ONLY terence@probizn.com is admin; terence.chk@outlook.com is a staff test user.
  const roleAdmin = userRole === 'admin';
  const emailAdmin = adminEmails.length > 0 && adminEmails.includes(currentEmail);
  const isAdmin = roleAdmin || emailAdmin;
  const isSupervisor = userRole === 'supervisor';
  // Supervisors can view the roster + reassign, but NOT create/edit/reset/disable.
  const canViewRoster = isAdmin || isSupervisor;
  // Human-readable name for the signed-in user (fall back to email local-part).
  const currentUserName =
    userFullName ||
    (user?.email ? user.email.split('@')[0] : 'staff');

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminRequest('/admin/users', { token }),
    enabled: canViewRoster,
  });

  const createUser = useMutation({
    mutationFn: (payload: { email: string; password: string; name: string; role: string }) =>
      adminRequest('/admin/users', { method: 'POST', body: JSON.stringify(payload), token }),
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
        body: JSON.stringify({ ban_duration: banned ? '876600h' : 'none' }),
        token,
      }),
    onSuccess: (_data, vars) => {
      setUserActionError(null);
      setUserActionNotice(vars.banned ? 'User disabled.' : 'User restored.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e: Error) => {
      setUserActionNotice(null);
      setUserActionError(e.message);
    },
  });

  const updateEmail = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      adminRequest(`/admin/users/${id}/email`, {
        method: 'POST',
        body: JSON.stringify({ email }),
        token,
      }),
    onSuccess: () => {
      setUserActionNotice(`Email updated to ${editEmail.trim()}.`);
      setEditingUser(null);
      setEditEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e: Error) => setUserActionError(e.message),
  });

  const bootstrapStaff = useMutation({
    mutationFn: async () => {
      const specs = [
        { email: 'staff1@probizn.com', name: 'Hazel', role: 'staff' },
        { email: 'staff2@probizn.com', name: 'Iris', role: 'staff' },
        { email: 'staff3@probizn.com', name: 'Sarah Mitchell', role: 'staff' },
      ];
      const results = [];
      for (const s of specs) {
        // Create only if the email isn't already in the roster.
        const existing = (usersQuery.data as any)?.users ?? [];
        if (existing.some((u: AdminUser) => (u.email || '').toLowerCase() === s.email.toLowerCase())) {
          results.push(`skipped ${s.email} (already exists)`);
          continue;
        }
        await adminRequest('/admin/users', {
          method: 'POST',
          body: JSON.stringify({ email: s.email, password: 'Temp1234', name: s.name, role: s.role }),
          token,
        });
        results.push(`created ${s.email}`);
      }
      return results.join('; ');
    },
    onSuccess: (summary) => {
      setNotice(`Staff roster: ${summary}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const resetUserPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      adminRequest(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
        token,
      }),
    onSuccess: () => {
      setUserActionNotice('Password reset. The staff member can now sign in with the new password.');
      setResetTarget(null);
      setResetPassword('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e: Error) => setUserActionError(e.message),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      adminRequest(`/admin/users/${id}/role`, {
        method: 'POST',
        body: JSON.stringify({ role }),
        token,
      }),
    onSuccess: () => {
      setUserActionNotice('Role updated.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e: Error) => setUserActionError(e.message),
  });

  // One-click backfill: link each handlebing_staff name to the matching auth
  // account (server-side, no UUID pasting or SQL Editor needed).
  const backfillStaff = useMutation({
    mutationFn: () =>
      adminRequest('/admin/clients/backfill-staff', {
        method: 'POST',
        token,
      }),
    onSuccess: (data: any) => {
      const n = (data?.results ?? []).reduce((sum: number, r: any) => sum + (r.updated || 0), 0);
      setUserActionNotice(`Linked ${n} client case(s) to staff accounts.`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (e: Error) => setUserActionError(e.message),
  });

  // Load clients to power the "reassign staff" bulk action. We only need the
  // (unfinished) clients whose handling_staff is being handed over.
  const clientsQuery = useQuery({
    queryKey: ['admin', 'clients'],
    queryFn: async () => {
      const { data, error } = await client
        .from('clients')
        .select('id, handling_staff, status')
        .limit(1000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: canViewRoster,
  });

  // Distinct staff names that still have unfinished clients, in a stable order.
  const unfinishedClients = (clientsQuery.data ?? []).filter(
    (c: any) => c.status !== 'verified' && c.status !== 'completed'
  );
  const staffNames = Array.from(
    new Set(unfinishedClients.map((c: any) => c.handling_staff).filter((s: any) => !!s))
  ).sort();

  const pendingCount = unfinishedClients.filter(
    (c: any) => c.handling_staff === fromStaff
  ).length;

  // "To" targets = actual team accounts (staff + supervisor), so a brand-new
  // staff member with no clients yet can still receive a handover.
  const rosterUsers: AdminUser[] = (usersQuery.data as any)?.users ?? [];
  const toOptions = Array.from(
    new Map(
      rosterUsers
        .filter((u) => !isBanned(u))
        .map((u) => [u.email || '', u.user_metadata?.full_name || u.email || ''])
    ).entries()
  )
    .map(([email, name]) => ({ email, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const reassign = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      if (!from || !to) throw new Error('Choose both a "from" and "to" staff member.');
      if (from === to) throw new Error('"From" and "to" staff must be different.');
      const ids = unfinishedClients
        .filter((c: any) => c.handling_staff === from)
        .map((c: any) => c.id);
      if (ids.length === 0) throw new Error(`No unfinished clients assigned to "${from}".`);
      // Resolve the target staff's user id (so staff_user_id follows the name).
      const roster = (usersQuery.data as any)?.users ?? [];
      const toFullName = (u: AdminUser) => u.user_metadata?.full_name || '';
      const toId =
        roster.find((u: AdminUser) => (u.email || '').toLowerCase() === to.toLowerCase())?.id ||
        roster.find((u: AdminUser) => toFullName(u).toLowerCase() === to.toLowerCase())?.id ||
        null;
      const patch: any = { handling_staff: to };
      if (toId) patch.staff_user_id = toId;
      const { error } = await client
        .from('clients')
        .update(patch)
        .in('id', ids);
      if (error) throw new Error(error.message);
      return ids.length;
    },
    onSuccess: (count) => {
      setReassignNotice(`Reassigned ${count} unfinished client(s) from "${fromStaff}" to "${toStaff}".`);
      setFromStaff('');
      setToStaff('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (e: Error) => setReassignError(e.message),
  });

  const onSubmit = useCallback(() => {
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError('Enter an email address.');
    const pwdError = passwordError(password);
    if (pwdError) return setError(pwdError);
    createUser.mutate({ email: email.trim(), password, name: fullName.trim(), role });
  }, [email, password, fullName, role, createUser]);

  // Non-admin/non-supervisor: show a clear gate (designer preview auto-signs in as
  // the demo user, which is NOT in the admin allow-list, so this renders honestly).
  if (!canViewRoster) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View className="items-center gap-4 rounded-3xl bg-card border border-border p-8">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <ShieldUserIcon className="text-primary" size={28} />
            </View>
            <Text className="text-lg font-semibold text-foreground">Supervisor / administrator access only</Text>
            <Text className="text-center text-sm text-muted-foreground">
              You are signed in as{' '}
              <Text className="font-semibold text-foreground">{user?.email || 'a guest'}</Text>. Staff manage
              their own cases from the pipeline; supervisors and administrators manage the team here.
            </Text>
            <Pressable
              onPress={() =>
                signOut.mutate(undefined, {
                  onSuccess: () => router.replace('/(auth)/login'),
                })
              }
              disabled={signOut.isPending}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 active:opacity-70"
            >
              {signOut.isPending ? (
                <ActivityIndicator size="small" />
              ) : (
                <LogOutIcon className="text-muted-foreground" size={16} />
              )}
              <Text className="text-sm font-semibold text-muted-foreground">Sign out</Text>
            </Pressable>
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
              <Text className="text-xs font-semibold tracking-widest text-primary uppercase">Management</Text>
              <Text className="mt-1 text-3xl font-bold tracking-tight text-foreground">Team & cases</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {isAdmin ? 'Create accounts, set roles, and reassign work.' : 'Oversee the team and reassign work.'}
              </Text>
            </View>
            <View className="items-center rounded-2xl bg-primary/10 px-3 py-2">
              <Text className="text-2xl font-bold text-primary">{activeUsers.length}</Text>
              <Text className="text-[11px] font-medium text-muted-foreground">Active</Text>
            </View>
          </View>

          {/* Sign out + current user */}
          <View className="mt-4 flex-row items-center justify-end gap-3">
            <View className="items-end">
              <Text className="text-xs text-muted-foreground">Signed in as</Text>
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                {currentUserName}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                signOut.mutate(undefined, {
                  onSuccess: () => router.replace('/(auth)/login'),
                })
              }
              disabled={signOut.isPending}
              className="flex-row items-center justify-center gap-2 self-end rounded-xl border border-border px-4 py-2.5 active:opacity-70"
            >
              {signOut.isPending ? (
                <ActivityIndicator size="small" color={isDark ? '#8d9d9e' : '#70797a'} />
              ) : (
                <LogOutIcon className="text-muted-foreground" size={16} />
              )}
              <Text className="text-sm font-semibold text-muted-foreground">Sign out</Text>
            </Pressable>
          </View>

          {/* Create user form (admin only) */}
          {isAdmin && (
          <View className="mt-6 rounded-3xl bg-card border border-border p-5">
            <View className="flex-row items-center gap-2">
              <UserPlusIcon className="text-primary" size={18} />
              <Text className="text-base font-semibold text-foreground">Add a team member</Text>
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
                placeholder="Temporary password (6-8 letters/numbers)"
                placeholderTextColor="#8d9d9e"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-sm text-muted-foreground">Role:</Text>
                {['staff', 'supervisor', 'admin'].map((r) => (
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

            <Pressable
              onPress={() => bootstrapStaff.mutate()}
              disabled={bootstrapStaff.isPending}
              className="mt-3 items-center justify-center rounded-2xl border border-border py-3 active:scale-[0.98]"
            >
              {bootstrapStaff.isPending ? (
                <ActivityIndicator color={isDark ? '#8d9d9e' : '#70797a'} />
              ) : (
                <Text className="text-sm font-semibold text-muted-foreground">
                  Recreate 3 staff users (placeholder emails)
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setUserActionError(null);
                setUserActionNotice(null);
                backfillStaff.mutate();
              }}
              disabled={backfillStaff.isPending}
              className="mt-3 items-center justify-center rounded-2xl border border-primary/40 bg-primary/5 py-3 active:scale-[0.98]"
            >
              {backfillStaff.isPending ? (
                <ActivityIndicator color={isDark ? '#8d9d9e' : '#70797a'} />
              ) : (
                <Text className="text-sm font-semibold text-primary">
                  Link open cases to staff accounts
                </Text>
              )}
            </Pressable>
          </View>
          )}

          {/* Reassign staff (bulk handover of UNFINISHED clients only) */}
          <View className="mt-6 rounded-3xl bg-card border border-border p-5">
            <View className="flex-row items-center gap-2">
              <ArrowRightLeftIcon className="text-primary" size={18} />
              <Text className="text-base font-semibold text-foreground">Reassign unfinished clients</Text>
            </View>
            <Text className="mt-1 text-xs text-muted-foreground">
              Hand over every open client from one staff member to another. Completed appointments are left untouched.
            </Text>

            {reassignError && (
              <View className="mt-3 rounded-xl bg-destructive/10 p-3">
                <Text className="text-sm text-destructive">{reassignError}</Text>
              </View>
            )}
            {reassignNotice && (
              <View className="mt-3 rounded-xl bg-primary/10 p-3">
                <Text className="text-sm text-primary">{reassignNotice}</Text>
              </View>
            )}

            {/* From picker */}
            <Text className="mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">From</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {staffNames.length === 0 ? (
                <Text className="text-sm text-muted-foreground">No staff with open clients.</Text>
              ) : (
                staffNames.map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => {
                      setFromStaff(name);
                      setReassignError(null);
                      setReassignNotice(null);
                    }}
                    className={`rounded-full px-3 py-1.5 border ${
                      fromStaff === name ? 'bg-primary border-primary' : 'border-border'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${fromStaff === name ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                      {name}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            {/* To picker */}
            <Text className="mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">To</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {toOptions.length === 0 ? (
                <Text className="text-sm text-muted-foreground">No team members yet — add a staff user first.</Text>
              ) : (
                toOptions.map((t) => (
                  <Pressable
                    key={t.email}
                    onPress={() => {
                      setToStaff(t.name);
                      setReassignError(null);
                      setReassignNotice(null);
                    }}
                    className={`rounded-full px-3 py-1.5 border ${
                      toStaff === t.name ? 'bg-primary border-primary' : 'border-border'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${toStaff === t.name ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                      {t.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            {fromStaff && (
              <Text className="mt-3 text-xs text-muted-foreground">
                {pendingCount} unfinished client{pendingCount === 1 ? '' : 's'} will be moved.
              </Text>
            )}

            <Pressable
              onPress={() => reassign.mutate({ from: fromStaff, to: toStaff })}
              disabled={reassign.isPending || !fromStaff || !toStaff}
              className={`mt-4 items-center justify-center rounded-2xl py-4 active:scale-[0.98] ${
                fromStaff && toStaff && fromStaff !== toStaff ? 'bg-primary' : 'bg-border'
              }`}
            >
              {reassign.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className={`text-base font-semibold ${fromStaff && toStaff && fromStaff !== toStaff ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                  Reassign clients
                </Text>
              )}
            </Pressable>
          </View>

          {/* Per-user action feedback */}
          {userActionError && (
            <View className="mt-6 rounded-xl bg-destructive/10 p-3">
              <Text className="text-sm text-destructive">{userActionError}</Text>
            </View>
          )}
          {userActionNotice && (
            <View className="mt-6 rounded-xl bg-primary/10 p-3">
              <Text className="text-sm text-primary">{userActionNotice}</Text>
            </View>
          )}

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
                    {isAdmin && (
                    <View className="ml-3 flex-row items-center gap-1.5">
                      <Pressable
                        onPress={() => {
                          setEditingUser(u);
                          setEditEmail(u.email || '');
                          setUserActionError(null);
                          setUserActionNotice(null);
                        }}
                        className="items-center justify-center rounded-xl bg-primary/10 p-2.5 active:scale-95"
                      >
                        <PencilIcon className="text-primary" size={16} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setResetTarget(u);
                          setResetPassword('');
                          setUserActionError(null);
                          setUserActionNotice(null);
                        }}
                        className="items-center justify-center rounded-xl bg-primary/10 p-2.5 active:scale-95"
                      >
                        <KeyRoundIcon className="text-primary" size={16} />
                      </Pressable>
                      <Pressable
                        onPress={() => setBan.mutate({ id: u.id, banned: true })}
                        disabled={setBan.isPending}
                        className="items-center justify-center rounded-xl bg-destructive/10 p-2.5 active:scale-95"
                      >
                        <BanIcon className="text-destructive" size={18} />
                      </Pressable>
                    </View>
                    )}
                  </View>

                  {/* Role selector (admin-only; supervisors can't manage roles) */}
                  {isAdmin && (
                    <View className="mt-3 flex-row items-center gap-2 flex-wrap">
                      <Text className="text-[11px] font-medium text-muted-foreground">Role:</Text>
                      {['staff', 'supervisor', 'admin'].map((r) => {
                        const current = (u.user_metadata?.role as string) || 'staff';
                        const active = current === r;
                        return (
                          <Pressable
                            key={r}
                            onPress={() => {
                              setUserActionError(null);
                              setUserActionNotice(null);
                              updateRole.mutate({ id: u.id, role: r });
                            }}
                            disabled={updateRole.isPending}
                            className={`rounded-full px-2.5 py-1 border ${
                              active ? 'bg-primary border-primary' : 'border-border'
                            }`}
                          >
                            <Text className={`text-[11px] font-semibold ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                              {r}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {/* Inline edit-email form */}
                  {editingUser?.id === u.id && (
                    <View className="mt-3 rounded-xl bg-background border border-border p-3">
                      <Text className="text-xs font-semibold text-muted-foreground">Change email</Text>
                      <TextInput
                        className="mt-2 bg-card rounded-xl px-3 py-2.5 border border-border text-foreground"
                        placeholder="New email"
                        placeholderTextColor="#8d9d9e"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={editEmail}
                        onChangeText={setEditEmail}
                      />
                      <View className="mt-2 flex-row gap-2">
                        <Pressable
                          onPress={() => updateEmail.mutate({ id: u.id, email: editEmail.trim() })}
                          disabled={updateEmail.isPending || !editEmail.trim()}
                          className="flex-1 items-center justify-center rounded-xl bg-primary py-2.5 active:scale-95"
                        >
                          {updateEmail.isPending ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text className="text-sm font-semibold text-primary-foreground">Save</Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => { setEditingUser(null); setEditEmail(''); }}
                          className="items-center justify-center rounded-xl border border-border px-4 py-2.5 active:opacity-70"
                        >
                          <Text className="text-sm font-semibold text-muted-foreground">Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* Inline reset-password form */}
                  {resetTarget?.id === u.id && (
                    <View className="mt-3 rounded-xl bg-background border border-border p-3">
                      <Text className="text-xs font-semibold text-muted-foreground">Reset password</Text>
                      <TextInput
                        className="mt-2 bg-card rounded-xl px-3 py-2.5 border border-border text-foreground"
                        placeholder="New password (6-8 letters/numbers)"
                        placeholderTextColor="#8d9d9e"
                        secureTextEntry
                        value={resetPassword}
                        onChangeText={setResetPassword}
                      />
                      <View className="mt-2 flex-row gap-2">
                        <Pressable
                          onPress={() => resetUserPassword.mutate({ id: u.id, password: resetPassword })}
                          disabled={resetUserPassword.isPending || !isValidPassword(resetPassword)}
                          className="flex-1 items-center justify-center rounded-xl bg-primary py-2.5 active:scale-95"
                        >
                          {resetUserPassword.isPending ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text className="text-sm font-semibold text-primary-foreground">Save</Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => { setResetTarget(null); setResetPassword(''); }}
                          className="items-center justify-center rounded-xl border border-border px-4 py-2.5 active:opacity-70"
                        >
                          <Text className="text-sm font-semibold text-muted-foreground">Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
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
                        className="ml-3 flex-row items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2.5 active:scale-95"
                      >
                        <RotateCcwIcon className="text-primary" size={18} />
                        <Text className="text-xs font-semibold text-primary">Restore</Text>
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
