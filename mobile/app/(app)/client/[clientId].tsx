import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeftIcon, MessageCircleIcon, ClipboardPasteIcon, CheckCircle2Icon, FileTextIcon, CameraIcon, CalendarClockIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useApp, useAuth } from '@/src/hooks';
import SalutationPicker from '@/components/SalutationPicker';
import NationalityPicker from '@/components/NationalityPicker';
import { uploadClientDoc } from '@/src/lib/upload';

// Resolve the hosted base URL for the client portal (same logic as the pipeline board).
function getPortalBase(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_WEB_URL ?? 'https://visaflow.example.com';
}

cssInterop(ArrowLeftIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MessageCircleIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ClipboardPasteIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle2Icon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(FileTextIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CameraIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CalendarClockIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function ClientDetailScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { client } = useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [zoomLink, setZoomLink] = useState('');
  const [salutation, setSalutation] = useState('');
  const [nationality, setNationality] = useState('');
  const [confirmedTime, setConfirmedTime] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: c, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await client.from('clients').select('*').eq('id', clientId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await client.from('clients').update(patch).eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', clientId] }),
    onError: (e: any) => setError(e?.message ?? 'Update failed'),
  });

  const sendZoom = async () => {
    if (!c) return;
    const link = (zoomLink.trim() || c.zoom_link || '').trim();
    if (!link) {
      setError('Enter the Zoom link first');
      return;
    }
    const exactTime = confirmedTime.trim() || c.confirmed_time || c.preferred_time || '';
    update.mutate({
      zoom_link: link,
      confirmed_time: confirmedTime.trim() || c.confirmed_time || null,
      confirmed_date: c.preferred_date || null,
    });
    const msg = `Thanks ${c.first_name}! Your documents are received. Your Zoom interview is confirmed${exactTime ? ` for ${c.preferred_date ? `${c.preferred_date} at ` : ''}${exactTime}` : ''}. Here is your meeting link: ${link}`;
    const phone = (c.phone || '').replace(/\D/g, '');
    try {
      await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
      setNotice('Exact time + Zoom link sent on WhatsApp');
    } catch (e: any) {
      setError(e?.message ?? 'Could not open WhatsApp');
    }
  };

  const pasteCapture = async () => {
    if (!c) return;
    if (Platform.OS === 'web') {
      // Web: use the Clipboard API to read an image/text
      if (typeof navigator !== 'undefined' && navigator.clipboard?.read) {
        try {
          const items = await navigator.clipboard.read();
          const img = items.find((i) => i.types.includes('image/png'));
          if (img) {
            const blob = await img.getType('image/png');
            // Upload to Storage named by serial no. + SC so it's permanent & retrievable.
            const url = URL.createObjectURL(blob);
            setNotice('Uploading capture…');
            const publicUrl = await uploadClientDoc(url, 'capture', c.reg_no);
            URL.revokeObjectURL(url);
            update.mutate({ capture_url: publicUrl });
            setNotice(`Capture saved as ${c.reg_no}_SC.png — mark Verified below`);
          } else {
            setError('No image found in clipboard — use Win+Shift+S then Ctrl+V');
          }
        } catch (e: any) {
          setError(e?.message ?? 'Could not read clipboard');
        }
      } else {
        setError('Clipboard image paste is not available in this browser');
      }
    } else {
      setNotice('Press Ctrl+V in your Zoom capture box (native paste handled by OS)');
    }
  };

  const markVerified = () => {
    update.mutate({ status: 'verified', completed_at: new Date().toISOString(), follow_up_due: false });
    setNotice('Marked Completed & Verified');
  };

  const saveProfile = () => {
    update.mutate({ salutation: salutation.trim() || null, nationality: nationality.trim() || null });
    setNotice('Profile updated');
  };

  const setClarity = (kind: 'passport' | 'address', clarity: 'ok' | 'unclear') => {
    if (!c) return;
    const patch: Record<string, unknown> = kind === 'passport' ? { passport_clarity: clarity } : { address_clarity: clarity };
    // If both are now clear, stamp docs_verified_at; otherwise clear it until both pass.
    const otherClarity = kind === 'passport' ? c.address_clarity : c.passport_clarity;
    if (clarity === 'ok' && otherClarity === 'ok') {
      patch.docs_verified_at = c.docs_verified_at ?? new Date().toISOString();
    } else {
      patch.docs_verified_at = null;
    }
    update.mutate(patch);
  };

  const sendReuploadLink = async (kind: 'passport' | 'address') => {
    if (!c) return;
    const docLabel = kind === 'passport' ? 'passport copy' : 'address proof';
    const portalUrl = `${getPortalBase()}/portal/${c.reg_no}`;
    const msg = `Hi ${c.first_name}, we need a clearer ${docLabel} for your application (${c.reg_no}). Please use this link to upload a crisp, well-lit photo: ${portalUrl}`;
    const phone = (c.phone || '').replace(/\D/g, '');
    try {
      await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
      setNotice(`Re-upload link sent for ${docLabel}`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not open WhatsApp');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!c) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <Text className="text-foreground mt-10 text-center">Client not found</Text>
      </SafeAreaView>
    );
  }

  const docsComplete = c.passport_url && c.address_proof_url;
  // Docs are only "clear" (ready to confirm the appointment) once staff has reviewed
  // BOTH the passport and address proof and marked them OK.
  const docsClear = c.passport_clarity === 'ok' && c.address_clarity === 'ok';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 py-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-card items-center justify-center active:scale-[0.97]">
            <ArrowLeftIcon className="text-foreground" size={20} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{c.first_name} {c.last_name}</Text>
            <Text className="text-xs text-muted-foreground">{c.reg_no} · {c.status === 'verified' ? 'Verified & Closed' : c.status === 'appt_set' ? 'Appt Set' : 'Awaiting Input'}</Text>
          </View>
        </View>

        {error && (
          <View className="mx-5 mb-3 rounded-xl bg-destructive/10 p-3">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        )}
        {notice && (
          <View className="mx-5 mb-3 rounded-xl bg-accent/15 p-3">
            <Text className="text-sm text-accent-foreground">{notice}</Text>
          </View>
        )}

        {/* Contact hero */}
        <View className="mx-5 rounded-3xl bg-card p-5">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-secondary items-center justify-center">
              <Text className="text-xl font-bold text-secondary-foreground">{c.first_name[0]}{c.last_name[0]}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-muted-foreground">Handling staff</Text>
              <Text className="text-base font-semibold text-foreground">{c.handling_staff}</Text>
              <Text className="text-sm text-muted-foreground">{c.phone}</Text>
            </View>
          </View>
        </View>

        {/* Profile: salutation + nationality */}
        <Section icon={<CalendarClockIcon className="text-muted-foreground" size={16} />} title="Client Profile">
          <View className="mt-2 flex-row gap-2">
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-1">Salutation</Text>
              <SalutationPicker
                value={salutation || c.salutation || ''}
                onChange={setSalutation}
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground mb-1">Nationality</Text>
              <NationalityPicker
                value={nationality || c.nationality || ''}
                onChange={setNationality}
              />
            </View>
          </View>
          <Pressable onPress={saveProfile} className="mt-3 items-center rounded-xl bg-muted py-2.5 active:scale-[0.97]">
            <Text className="text-sm font-semibold text-foreground">Save profile</Text>
          </Pressable>
        </Section>

        {/* Appointment */}
        <Section icon={<CalendarClockIcon className="text-muted-foreground" size={16} />} title="Proposed Interview">
          {c.preferred_time ? (
            <View className="mt-2 rounded-xl bg-secondary p-4">
              <Text className="text-base font-semibold text-foreground">{c.preferred_time}</Text>
              <Text className="text-sm text-muted-foreground">{c.preferred_date ?? 'Date pending'}</Text>
              {c.confirmed_time && (
                <View className="mt-3 pt-3 border-t border-border">
                  <Text className="text-xs font-semibold text-chart-2 uppercase tracking-wide">Confirmed exact time</Text>
                  <Text className="mt-0.5 text-base font-semibold text-foreground">
                    {c.confirmed_date ?? c.preferred_date ?? ''} at {c.confirmed_time}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text className="mt-2 text-sm text-muted-foreground">No time proposed yet — awaiting client input.</Text>
          )}
        </Section>

        {/* Documents */}
        <Section icon={<FileTextIcon className="text-muted-foreground" size={16} />} title="Uploaded ID Documents">
          <View className="mt-2 gap-2">
            <DocRow label="Passport Copy" url={c.passport_url} />
            {c.passport_url && (
              <ClarityReview
                kind="passport"
                clarity={c.passport_clarity}
                onSet={(v) => setClarity('passport', v)}
                onReupload={() => sendReuploadLink('passport')}
              />
            )}
            <DocRow label="Address Proof" url={c.address_proof_url} />
            {c.address_proof_url && (
              <ClarityReview
                kind="address"
                clarity={c.address_clarity}
                onSet={(v) => setClarity('address', v)}
                onReupload={() => sendReuploadLink('address')}
              />
            )}
            <DocRow label="Live Zoom Capture" url={c.capture_url} camera />
          </View>
          {docsComplete && !docsClear && (
            <View className="mt-3 rounded-xl bg-accent/15 border border-accent/30 p-3">
              <Text className="text-xs font-semibold text-accent-foreground">
                Review both documents for clarity before confirming the appointment time.
              </Text>
            </View>
          )}
        </Section>

        {/* Staff actions */}
        <View className="mt-5 px-5 gap-3">
          {c.status === 'appt_set' && c.preferred_time && (
            <>
              <View className="rounded-2xl bg-card p-4">
                <Text className="text-sm font-semibold text-foreground">Confirm exact appointment time</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  Client proposed the {c.preferred_time} slot — pick the exact time within it.
                </Text>
                <TextInput
                  className="mt-2 bg-background rounded-xl px-4 py-3.5 border border-border text-foreground"
                  placeholder="e.g. 2:30 PM"
                  placeholderTextColor="#8d9d9e"
                  value={confirmedTime || c.confirmed_time || ''}
                  onChangeText={setConfirmedTime}
                />
                <TextInput
                  className="mt-2 bg-background rounded-xl px-4 py-3.5 border border-border text-foreground"
                  placeholder="Zoom meeting link"
                  placeholderTextColor="#8d9d9e"
                  value={c.zoom_link || zoomLink}
                  onChangeText={setZoomLink}
                />
                {docsClear ? (
                  <Pressable onPress={sendZoom} className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 active:scale-[0.97]">
                    <MessageCircleIcon className="text-white" size={18} />
                    <Text className="text-base font-semibold text-white">Send Exact Time + Zoom Link</Text>
                  </Pressable>
                ) : (
                  <View className="mt-3 rounded-xl bg-muted p-3 items-center">
                    <Text className="text-xs text-muted-foreground text-center">
                      {docsComplete
                        ? 'Mark both Passport & Address Proof as Clear above to confirm the appointment.'
                        : 'Waiting on client to upload Passport & Address Proof before confirming the appointment.'}
                    </Text>
                  </View>
                )}
              </View>

              {!docsComplete && (
                <Text className="text-xs text-muted-foreground text-center px-2">
                  Waiting on client to upload their Passport & Address Proof before the live interview.
                </Text>
              )}

              {docsComplete && (
                <>
                  <Pressable onPress={pasteCapture} className="flex-row items-center justify-center gap-2 rounded-2xl bg-secondary py-4 active:scale-[0.97]">
                    <ClipboardPasteIcon className="text-secondary-foreground" size={18} />
                    <Text className="text-base font-semibold text-secondary-foreground">Paste Zoom Capture (Ctrl+V)</Text>
                  </Pressable>

                  <Pressable onPress={markVerified} className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4 active:scale-[0.97]">
                    <CheckCircle2Icon className="text-primary-foreground" size={18} />
                    <Text className="text-base font-semibold text-primary-foreground">Mark Verified & Close</Text>
                  </Pressable>
                </>
              )}
            </>
          )}

          {c.status === 'awaiting_input' && (
            <View className="rounded-2xl bg-muted p-4">
              <Text className="text-sm text-muted-foreground">WhatsApp invitation already sent. Waiting for the client to select a time and upload documents.</Text>
            </View>
          )}

          {c.status === 'verified' && (
            <View className="rounded-2xl bg-chart-2/10 p-4 items-center">
              <CheckCircle2Icon className="text-chart-2" size={28} />
              <Text className="mt-2 text-base font-semibold text-foreground">Completed & Verified</Text>
              <Text className="text-sm text-muted-foreground text-center">Live interview finished and captured.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <View className="mx-5 mt-5">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ClarityReview({ kind, clarity, onSet, onReupload }: {
  kind: 'passport' | 'address';
  clarity: string | null;
  onSet: (v: 'ok' | 'unclear') => void;
  onReupload: () => void;
}) {
  const label = kind === 'passport' ? 'Passport' : 'Address Proof';
  return (
    <View className="rounded-xl bg-background border border-border p-3">
      <Text className="text-xs font-semibold text-foreground">{label} clarity</Text>
      <View className="mt-2 flex-row gap-2">
        <Pressable
          onPress={() => onSet('ok')}
          className={`flex-1 items-center rounded-lg py-2 ${clarity === 'ok' ? 'bg-chart-2' : 'bg-card'}`}
        >
          <Text className={`text-xs font-semibold ${clarity === 'ok' ? 'text-white' : 'text-foreground'}`}>✓ Clear</Text>
        </Pressable>
        <Pressable
          onPress={() => onSet('unclear')}
          className={`flex-1 items-center rounded-lg py-2 ${clarity === 'unclear' ? 'bg-accent' : 'bg-card'}`}
        >
          <Text className={`text-xs font-semibold ${clarity === 'unclear' ? 'text-accent-foreground' : 'text-foreground'}`}>✕ Unclear</Text>
        </Pressable>
      </View>
      {clarity === 'unclear' && (
        <Pressable
          onPress={onReupload}
          className="mt-2 flex-row items-center justify-center gap-2 rounded-lg bg-[#25D366] py-2 active:scale-[0.97]"
        >
          <MessageCircleIcon className="text-white" size={14} />
          <Text className="text-xs font-semibold text-white">Send re-upload link</Text>
        </Pressable>
      )}
    </View>
  );
}

function DocRow({ label, url, camera }: { label: string; url?: string | null; camera?: boolean }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-card p-3">
      <View className="w-12 h-12 rounded-lg bg-muted items-center justify-center overflow-hidden">
        {url ? (
          <Image source={{ uri: url }} style={{ width: 48, height: 48 }} resizeMode="cover" />
        ) : camera ? (
          <CameraIcon className="text-muted-foreground" size={20} />
        ) : (
          <FileTextIcon className="text-muted-foreground" size={20} />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        <Text className={`text-xs ${url ? 'text-chart-2' : 'text-muted-foreground'}`}>
          {url ? 'Uploaded — hi-res preview available' : 'Not uploaded yet'}
        </Text>
      </View>
    </View>
  );
}
