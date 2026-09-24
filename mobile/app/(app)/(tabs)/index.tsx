import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { MessageCircleIcon, ChevronRightIcon, CameraIcon, FileTextIcon, CalendarClockIcon, DownloadIcon, PauseCircleIcon, PlayCircleIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useApp, useAuth } from '@/src/hooks';
import { downloadCsv, docRef } from '@/src/lib/export';

cssInterop(MessageCircleIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronRightIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CameraIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(FileTextIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CalendarClockIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(DownloadIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(PauseCircleIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(PlayCircleIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const STAGES = [
  { key: 'not_processed', label: 'Not Processed', hint: 'No invitation sent yet' },
  { key: 'invited', label: 'Invited-Not Responded', hint: 'Invitation sent, awaiting reply' },
  { key: 'responded', label: 'Responded-To Confirm', hint: 'Client replied, staff confirms time' },
  { key: 'completed', label: 'Completed', hint: 'Interview verified & closed' },
] as const;

// Resolve the hosted base URL for the client portal. On web this is the live
// origin (works in the editor preview with no env var set). On native it falls
// back to the configured EXPO_PUBLIC_WEB_URL, then the placeholder.
function getPortalBase(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_WEB_URL ?? 'https://visaflow.example.com';
}

export default function PipelineScreen() {
  const { client } = useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ['clients', user?.id ?? 'none'],
    queryFn: async () => {
      const { data, error } = await client.from('clients').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const suspendClient = useMutation({
    mutationFn: async ({ id, suspend }: { id: string; suspend: boolean }) => {
      const { error } = await client
        .from('clients')
        .update(suspend ? { status: 'suspended', follow_up_due: false } : { status: 'awaiting_input' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setNotice('Client updated');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const sendWhatsApp = useMutation({
    mutationFn: async (c: { id: string; first_name: string; reg_no: string; phone: string }) => {
      // Public portal link — the client opens this in any browser, no app download needed.
      const portalUrl = `${getPortalBase()}/portal/${c.reg_no}`;
      const msg = `Hi ${c.first_name}, this is Sarah regarding your application (${c.reg_no}). Please use this quick link to select your preferred Zoom interview time and attach your Passport & Address Proof: ${portalUrl}`;
      // Open WhatsApp (native app on mobile, wa.me in a new tab on web) with the message pre-filled.
      const phone = (c.phone || '').replace(/\D/g, '');
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      await Linking.openURL(url);
      // Record the invitation so the client moves into "Invited-Not Responded".
      const { error } = await client
        .from('clients')
        .update({ invited_at: new Date().toISOString() })
        .eq('id', c.id);
      if (error) throw error;
      return msg;
    },
    onSuccess: () => {
      setNotice('WhatsApp opened with the portal link — invitation sent');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const counts = useMemo(() => {
    // Four-stage pipeline derived from status + timestamps:
    //  - Not Processed:          no invitation sent yet
    //  - Invited-Not Responded:  invitation sent, client has not answered
    //  - Responded-To Confirm:   client answered, staff must confirm exact time
    //  - Completed:              verified & closed
    const base = { not_processed: 0, invited: 0, responded: 0, completed: 0 };
    (clients ?? []).forEach((c: any) => {
      if (c.status === 'verified') base.completed += 1;
      else if (c.status === 'suspended') return;
      else if (c.submitted_at || c.status === 'appt_set') base.responded += 1;
      else if (c.invited_at) base.invited += 1;
      else base.not_processed += 1;
    });
    return base;
  }, [clients]);

  const { active, completed, overdue, suspended } = useMemo(() => {
    const all = clients ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = (c: any) => {
      if (c.status === 'verified' || c.status === 'suspended') return false;
      // Manually flagged for follow-up, OR has a proposed date that has already passed without completion.
      if (c.follow_up_due) return true;
      if (c.preferred_date && typeof c.preferred_date === 'string') {
        const d = c.preferred_date.slice(0, 10);
        if (d < today) return true;
      }
      return false;
    };
    const suspended = all.filter((c) => c.status === 'suspended');
    const stageMatches = (c: any) => !stageFilter || stageOf(c) === stageFilter;
    return {
      active: all.filter((c) => c.status !== 'verified' && c.status !== 'suspended' && stageMatches(c)),
      completed: all.filter((c) => c.status === 'verified' && stageMatches(c)),
      suspended,
      overdue: all.filter(isOverdue),
    };
  }, [clients, stageFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Export the CURRENTLY selected category (or all clients when no filter).
  const rowsToExport = useMemo(() => {
    const all = clients ?? [];
    if (stageFilter && stageFilter !== 'all') {
      return all.filter((c) => stageOf(c) === stageFilter);
    }
    return all.filter((c) => c.status !== 'suspended');
  }, [clients, stageFilter]);

  const exportLabel = useMemo(() => {
    if (stageFilter && stageFilter !== 'all') {
      return STAGES.find((s) => s.key === stageFilter)?.label ?? 'Clients';
    }
    return 'All Clients';
  }, [stageFilter]);

  const onExport = async () => {
    if (rowsToExport.length === 0) {
      setNotice('Nothing to export — no clients in this category yet.');
      return;
    }
    setExporting(true);
    try {
      const headers = [
        'Serial No', 'Salutation', 'First Name', 'Last Name', 'Nationality',
        'Country Code', 'Phone Number', 'Handling Staff', 'Stage',
        'Passport File', 'Address Proof File', 'Zoom Capture File',
        'Preferred Date', 'Preferred Time', 'Confirmed Date', 'Confirmed Time',
        'Invited At', 'Responded At', 'Completed At',
      ];
      const rows = rowsToExport.map((c: any) => ({
        'Serial No': c.reg_no ?? '',
        'Salutation': c.salutation ?? '',
        'First Name': c.first_name ?? '',
        'Last Name': c.last_name ?? '',
        'Nationality': c.nationality ?? '',
        'Country Code': c.country_code ?? '',
        'Phone Number': c.phone_number ?? c.phone ?? '',
        'Handling Staff': c.handling_staff ?? '',
        'Stage': STAGES.find((s) => s.key === stageOf(c))?.label ?? '',
        'Passport File': docRef(c.reg_no, 'passport', c.passport_url),
        'Address Proof File': docRef(c.reg_no, 'address', c.address_proof_url),
        'Zoom Capture File': docRef(c.reg_no, 'capture', c.capture_url),
        'Preferred Date': c.preferred_date ?? '',
        'Preferred Time': c.preferred_time ?? '',
        'Confirmed Date': c.confirmed_date ?? '',
        'Confirmed Time': c.confirmed_time ?? '',
        'Invited At': c.invited_at ?? '',
        'Responded At': c.submitted_at ?? '',
        'Completed At': c.completed_at ?? '',
      }));
      const stamp = new Date().toISOString().slice(0, 10);
      const safeLabel = exportLabel.replace(/[^a-z0-9]+/gi, '-');
      const filename = `clients-${safeLabel}-${stamp}.csv`;
      await downloadCsv(filename, headers, rows);
      setNotice(`Exported ${rows.length} client${rows.length > 1 ? 's' : ''} (${exportLabel}).`);
    } catch (e: any) {
      setNotice(`Export failed: ${e?.message ?? 'unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View className="px-5 pt-5 pb-4">
          <Image source={require('../../../assets/image.png')} style={{ width: 170, height: 51 }} resizeMode="contain" />
          <Text className="mt-3 text-xs font-semibold tracking-wide" style={{ color: '#6b7a2b' }}>via Probiz InsureProofID</Text>
          <Text className="mt-1 text-xs font-semibold tracking-widest text-primary uppercase">Onboarding Pipeline</Text>
          <Text className="mt-1 text-3xl font-bold tracking-tight text-foreground">Client Intake</Text>
          <Text className="mt-1 text-sm text-muted-foreground">{clients?.length ?? 0} records in the lifecycle</Text>
        </View>

        {/* Hero metric */}
        <View className="mx-5 rounded-3xl bg-primary p-5">
          <Text className="text-sm font-medium text-primary-foreground/80">Invited — not responded</Text>
          <Text className="mt-1 text-5xl font-bold text-primary-foreground">{counts.invited}</Text>
          <Text className="mt-2 text-xs text-primary-foreground/70">Send a 1-click WhatsApp nudge to move them forward</Text>
        </View>

        {/* Stage chips */}
        <View className="mt-5 gap-2 px-5">
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setStageFilter(stageFilter === 'all' ? null : 'all')}
              className={`flex-1 rounded-2xl p-3 ${stageFilter === 'all' ? 'bg-primary' : 'bg-card'}`}
            >
              <Text className={`text-2xl font-bold ${stageFilter === 'all' ? 'text-primary-foreground' : 'text-foreground'}`}>
                {clients?.length ?? 0}
              </Text>
              <Text className={`mt-1 text-[11px] leading-tight ${stageFilter === 'all' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                All clients
              </Text>
            </Pressable>
            {STAGES.map((s) => {
              const selected = stageFilter === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setStageFilter(selected ? null : s.key)}
                  className={`flex-1 rounded-2xl p-3 ${selected ? 'bg-primary' : 'bg-card'}`}
                >
                  <Text className={`text-2xl font-bold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {counts[s.key]}
                  </Text>
                  <Text className={`mt-1 text-[11px] leading-tight ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {stageFilter && stageFilter !== 'all' && (
            <Pressable onPress={() => setStageFilter(null)} className="self-start flex-row items-center gap-1 rounded-full bg-secondary px-3 py-1.5">
              <Text className="text-xs font-semibold text-secondary-foreground">✕ Clear filter</Text>
            </Pressable>
          )}
        </View>

        {notice && (
          <View className="mx-5 mt-4 rounded-xl bg-accent/15 p-3">
            <Text className="text-sm text-accent-foreground">{notice}</Text>
          </View>
        )}

        {/* Overdue reminder (backend oversight) */}
        {overdue.length > 0 && (
          <View className="mx-5 mt-4 rounded-2xl bg-accent/15 border border-accent/30 p-4">
            <Text className="text-sm font-semibold text-accent-foreground">
              ⚠️ {overdue.length} client{overdue.length > 1 ? 's' : ''} overdue — appointment not completed
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">Follow up with these clients to keep the pipeline moving.</Text>
          </View>
        )}

        {/* Active pipeline */}
        <View className="mt-6 px-5 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-foreground">
            {stageFilter && stageFilter !== 'all' ? STAGES.find((s) => s.key === stageFilter)?.label : 'Active pipeline'}
          </Text>
          {stageFilter && stageFilter !== 'all' && (
            <Text className="text-xs font-semibold text-primary">{active.length} shown</Text>
          )}
        </View>

        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator />
          </View>
        ) : active.length === 0 ? (
          <View className="mx-5 mt-4 items-center rounded-2xl bg-card py-10 px-6">
            <MessageCircleIcon className="text-muted-foreground" size={32} />
            <Text className="mt-3 text-base font-semibold text-foreground">
              {stageFilter && stageFilter !== 'all' ? 'No clients in this stage' : 'No active clients'}
            </Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">Import your first batch from the Import tab.</Text>
          </View>
        ) : (
          <View className="mt-3 px-5 gap-3">
            {active.map((c) => (
              <ClientCard key={c.id} c={c} overdue={overdue.some((o) => o.id === c.id)} onPress={() => router.push('/client/' + c.id)} onWhatsApp={() => sendWhatsApp.mutate(c)} onSuspend={() => suspendClient.mutate({ id: c.id, suspend: true })} />
            ))}
          </View>
        )}

        {/* Suspended clients */}
        {suspended.length > 0 && (
          <>
            <View className="mt-8 px-5 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Suspended — no follow-up</Text>
              <Text className="text-xs font-semibold text-muted-foreground">{suspended.length} paused</Text>
            </View>
            <View className="mt-3 px-5 gap-3">
              {suspended.map((c) => (
                <ClientCard key={c.id} c={c} suspended onReinstate={() => suspendClient.mutate({ id: c.id, suspend: false })} onPress={() => router.push('/client/' + c.id)} />
              ))}
            </View>
          </>
        )}

        {/* Completed clients */}
        {completed.length > 0 && (
          <>
            <View className="mt-8 px-5 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Completed clients</Text>
              <Text className="text-xs font-semibold text-chart-2">{completed.length} completed</Text>
            </View>
            <View className="mt-3 px-5 gap-3">
              {completed.map((c) => (
                <ClientCard key={c.id} c={c} onPress={() => router.push('/client/' + c.id)} />
              ))}
            </View>
          </>
        )}

        {/* Export */}
        <Pressable
          onPress={onExport}
          disabled={exporting}
          className="mx-5 mt-8 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 active:scale-[0.98]"
        >
          <DownloadIcon className="text-primary-foreground" size={18} />
          <Text className="text-sm font-semibold text-primary-foreground">
            {exporting ? 'Exporting…' : `Export ${exportLabel} (${rowsToExport.length})`}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  reg_no: string;
  phone: string;
  handling_staff: string;
  status: string;
  passport_url: string | null;
  address_proof_url: string | null;
  capture_url: string | null;
  preferred_time: string | null;
  zoom_link: string | null;
  follow_up_due: boolean;
  submitted_at: string | null;
  invited_at: string | null;
};

function ClientCard({ c, onPress, onWhatsApp, overdue, onSuspend, onReinstate, suspended }: { c: ClientRow; onPress: () => void; onWhatsApp?: () => void; overdue?: boolean; onSuspend?: () => void; onReinstate?: () => void; suspended?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      activeOpacity={0.9}
      className={`bg-card rounded-2xl p-4 active:scale-[0.98] ${overdue ? 'border border-accent/50' : ''}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1 min-w-0">
          <View className="w-10 h-10 rounded-full bg-secondary items-center justify-center">
            <Text className="text-sm font-bold text-secondary-foreground">
              {c.first_name[0]}{c.last_name[0]}
            </Text>
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              {c.first_name} {c.last_name}
            </Text>
            <Text className="text-xs text-muted-foreground">{c.reg_no} · {c.handling_staff}</Text>
          </View>
        </View>
        <ChevronRightIcon className="text-muted-foreground" size={18} />
      </View>

      {/* Stage badge */}
      <View className="mt-3 flex-row items-center gap-2">
        <StageBadge c={c} />
        {c.preferred_time ? (
          <View className="flex-row items-center gap-1">
            <CalendarClockIcon className="text-muted-foreground" size={13} />
            <Text className="text-xs text-muted-foreground">{c.preferred_time}</Text>
          </View>
        ) : null}
        {overdue && (
          <Text className="text-[11px] font-semibold text-accent-foreground">Overdue</Text>
        )}
      </View>

      {/* Doc indicators */}
      <View className="mt-2 flex-row gap-2">
        <DocPill label="Passport" done={!!c.passport_url} />
        <DocPill label="Address" done={!!c.address_proof_url} />
        <DocPill label="Capture" done={!!c.capture_url} camera />
      </View>

      {/* Action */}
      {suspended && onReinstate ? (
        <Pressable
          onPress={onReinstate}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-border py-2.5 active:scale-[0.97]"
        >
          <PlayCircleIcon className="text-foreground" size={16} />
          <Text className="text-sm font-semibold text-foreground">Reinstate</Text>
        </Pressable>
      ) : onWhatsApp && !c.invited_at ? (
        <Pressable
          onPress={onWhatsApp}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 active:scale-[0.97]"
        >
          <MessageCircleIcon className="text-white" size={16} />
          <Text className="text-sm font-semibold text-white">Send WhatsApp</Text>
        </Pressable>
      ) : c.status === 'appt_set' && !c.zoom_link ? (
        <Pressable
          onPress={onPress}
          className="mt-3 items-center rounded-xl bg-secondary py-2.5 active:scale-[0.97]"
        >
          <Text className="text-sm font-semibold text-secondary-foreground">Review & Send Zoom Link</Text>
        </Pressable>
      ) : null}

      {/* Suspend (Invited-Not Responded / Responded-To Confirm) */}
      {!suspended && onSuspend && (c.invited_at || c.submitted_at || c.status === 'appt_set') && (
        <Pressable
          onPress={onSuspend}
          className="mt-2 flex-row items-center justify-center gap-2 rounded-xl py-2 active:scale-[0.97]"
        >
          <PauseCircleIcon className="text-muted-foreground" size={14} />
          <Text className="text-xs font-medium text-muted-foreground">Suspend — no follow-up</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function StageBadge({ c }: { c: any }) {
  const stage = stageOf(c);
  const map: Record<string, { label: string; cls: string }> = {
    not_processed: { label: 'Not Processed', cls: 'bg-muted text-muted-foreground' },
    invited: { label: 'Invited-Not Responded', cls: 'bg-chart-1/15 text-chart-1' },
    responded: { label: 'Responded-To Confirm', cls: 'bg-chart-3/15 text-chart-3' },
    completed: { label: 'Completed', cls: 'bg-chart-2/15 text-chart-2' },
    suspended: { label: 'Suspended', cls: 'bg-muted text-muted-foreground' },
  };
  const s = map[stage];
  return (
    <View className={`rounded-full px-2.5 py-1 ${s.cls}`}>
      <Text className="text-[11px] font-semibold">{s.label}</Text>
    </View>
  );
}

function stageOf(c: any): 'not_processed' | 'invited' | 'responded' | 'completed' | 'suspended' {
  if (c.status === 'verified') return 'completed';
  if (c.status === 'suspended') return 'suspended';
  if (c.submitted_at || c.status === 'appt_set') return 'responded';
  if (c.invited_at) return 'invited';
  return 'not_processed';
}

function DocPill({ label, done, camera }: { label: string; done: boolean; camera?: boolean }) {
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${done ? 'bg-secondary' : 'bg-muted'}`}>
      {camera ? (
        <CameraIcon className={done ? 'text-secondary-foreground' : 'text-muted-foreground'} size={12} />
      ) : (
        <FileTextIcon className={done ? 'text-secondary-foreground' : 'text-muted-foreground'} size={12} />
      )}
      <Text className={`text-[11px] font-medium ${done ? 'text-secondary-foreground' : 'text-muted-foreground'}`}>
        {label}
      </Text>
    </View>
  );
}
