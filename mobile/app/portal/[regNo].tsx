import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { CameraIcon, FileTextIcon, CalendarClockIcon, SendIcon, CheckCircle2Icon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useApp } from '@/src/hooks';
import { uploadClientDoc } from '@/src/lib/upload';
import SalutationPicker from '@/components/SalutationPicker';
import NationalityPicker from '@/components/NationalityPicker';
import { buildCalendarEvent, openInCalendar } from '@/src/lib/calendar';
import CalendarPicker from '@/components/CalendarPicker';

cssInterop(CameraIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(FileTextIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CalendarClockIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(SendIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle2Icon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const TIME_SLOTS = ['9:00 AM', '10:30 AM', '12:00 PM', '2:00 PM', '3:30 PM', '5:00 PM'];

export default function ClientPortalScreen() {
  const { regNo } = useLocalSearchParams<{ regNo: string }>();
  const { client } = useApp();
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [time, setTime] = useState<string | null>(null);
  const [salutation, setSalutation] = useState('');
  const [nationality, setNationality] = useState('');
  const [passport, setPassport] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'passport' | 'address' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [addingCalendar, setAddingCalendar] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ['portal', regNo],
    queryFn: async () => {
      const { data, error } = await client.from('clients').select('*').eq('reg_no', regNo).single();
      if (error) throw error;
      return data;
    },
    enabled: !!regNo,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!time) throw new Error('Select a preferred time slot');
      const { error } = await client
        .from('clients')
        .update({
          salutation: salutation.trim() || null,
          nationality: nationality.trim() || null,
          preferred_date: date || null,
          preferred_time: time,
          passport_url: passport,
          address_proof_url: address,
          status: 'appt_set',
          submitted_at: new Date().toISOString(),
        })
        .eq('reg_no', regNo);
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (e: any) => setError(e?.message ?? 'Submit failed'),
  });

  const pickPhoto = async (which: 'passport' | 'address') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const uri = result.assets[0].uri;
      // Show the local preview immediately so the user sees something while it uploads.
      if (which === 'passport') setPassport(uri);
      else setAddress(uri);

      setUploading(which);
      setError(null);
      const publicUrl = await uploadClientDoc(uri, which, c.reg_no);
      // Persist the permanent Storage URL (not the transient device URI).
      if (which === 'passport') setPassport(publicUrl);
      else setAddress(publicUrl);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const resubmitUnclear = async () => {
    if (!c) return;
    setError(null);
    try {
      // Re-upload the unclear document(s) and clear the "unclear" flags so staff can review again.
      const patch: Record<string, unknown> = {};
      if (c.passport_clarity === 'unclear' && passport) {
        patch.passport_url = passport;
        patch.passport_clarity = null;
      }
      if (c.address_clarity === 'unclear' && address) {
        patch.address_proof_url = address;
        patch.address_clarity = null;
      }
      // If the client uploaded neither (they only re-picked via a newer upload but didn't change), still clear.
      if (Object.keys(patch).length === 0) {
        setError('Please upload a clearer copy first.');
        return;
      }
      const { error } = await client.from('clients').update(patch).eq('reg_no', regNo);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['portal', regNo] });
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? 'Re-upload failed');
    }
  };

  const addToCalendar = async () => {
    if (!c?.confirmed_time) return;
    const date = c.confirmed_date ?? c.preferred_date ?? date;
    if (!date) {
      setError('Your exact appointment date is not set yet.');
      return;
    }
    const ics = buildCalendarEvent({
      title: 'VisaFlow Interview',
      date,
      time: c.confirmed_time,
      durationMinutes: 60,
      description: `Visa interview — ${c.reg_no}`,
      location: c.zoom_link || '',
    });
    if (!ics) {
      setError('Could not read the appointment time.');
      return;
    }
    setAddingCalendar(true);
    setError(null);
    try {
      await openInCalendar(ics);
    } catch (e: any) {
      setError(e?.message ?? 'Could not open your calendar');
    } finally {
      setAddingCalendar(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  // When staff marked a document unclear, let the client re-upload a clearer copy
  // (instead of the blanket "already answered" screen).
  const unclearDocs = ['passport', 'address'].filter((k) =>
    k === 'passport' ? c?.passport_clarity === 'unclear' : c?.address_clarity === 'unclear',
  ) as ('passport' | 'address')[];

  if ((submitted || c?.submitted_at) && unclearDocs.length > 0) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <View className="px-5 pt-8 pb-4">
              <View className="items-center">
                <CameraIcon className="text-primary" size={48} />
                <Text className="mt-3 text-2xl font-bold text-foreground text-center">
                  We need a clearer {unclearDocs.map((d) => (d === 'passport' ? 'Passport' : 'Address Proof')).join(' & ')}
                </Text>
                <Text className="mt-2 text-base text-muted-foreground text-center">
                  The staff couldn't read your document clearly. Please upload a crisp, well-lit photo below.
                </Text>
              </View>

              {unclearDocs.includes('passport') && (
                <UploadCard
                  label="Passport Copy"
                  hint="Tap to re-upload a clearer photo"
                  preview={passport || c?.passport_url}
                  uploading={uploading === 'passport'}
                  onPick={() => pickPhoto('passport')}
                />
              )}
              {unclearDocs.includes('address') && (
                <UploadCard
                  label="Address Proof"
                  hint="Tap to re-upload a clearer photo"
                  preview={address || c?.address_proof_url}
                  uploading={uploading === 'address'}
                  onPick={() => pickPhoto('address')}
                />
              )}

              {error && (
                <View className="mt-4 mx-5 rounded-xl bg-destructive/10 p-3">
                  <Text className="text-sm text-destructive">{error}</Text>
                </View>
              )}

              <Pressable
                onPress={resubmitUnclear}
                disabled={uploading !== null}
                className="mx-5 mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4 active:scale-[0.97]"
              >
                <CheckCircle2Icon className="text-primary-foreground" size={18} />
                <Text className="text-base font-semibold text-primary-foreground">
                  {uploading ? 'Uploading…' : 'Submit clearer copy'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (submitted || c?.submitted_at) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6">
          <CheckCircle2Icon className="text-chart-2" size={56} />
          <Text className="mt-4 text-2xl font-bold text-foreground text-center">Thank you{c ? `, ${c.first_name}` : ''}!</Text>
          <Text className="mt-2 text-base text-muted-foreground text-center">
            Your appointment invitation has already been answered. Your handling staff will confirm your Zoom call shortly.
          </Text>
          {c?.confirmed_time && (
            <Text className="mt-4 text-sm font-semibold text-foreground">
              Confirmed: {c.confirmed_date ?? c.preferred_date ?? ''} at {c.confirmed_time}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View className="px-5 pt-6 pb-4">
            <Text className="text-xs font-semibold tracking-widest text-primary uppercase">Interview Booking</Text>
            <Text className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              Hi{c ? ` ${c.salutation ? c.salutation + ' ' : ''}${c.first_name}` : ''}{c?.last_name ? ` ${c.last_name}` : ''}
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {c?.nationality ? `${c.nationality} · ` : ''}Application {c?.reg_no ?? regNo}
            </Text>

            {/* Client details summary */}
            {c && (
              <View className="mt-3 rounded-2xl bg-card border border-border p-4">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Your Application</Text>
                <DetailRow label="Name" value={`${c.salutation ? c.salutation + ' ' : ''}${c.first_name} ${c.last_name}`} />
                <DetailRow label="Nationality" value={c.nationality || '—'} />
                <DetailRow label="Application no." value={c.reg_no} />
                <DetailRow label="Handling staff" value={c.handling_staff} />
              </View>
            )}

            {/* Confirmed appointment + add to phone calendar */}
            {c?.confirmed_time && (
              <View className="mt-3 rounded-2xl bg-primary p-4">
                <Text className="text-xs font-semibold text-primary-foreground/80 uppercase tracking-wide">Your Confirmed Interview</Text>
                <Text className="mt-1 text-xl font-bold text-primary-foreground">
                  {c.confirmed_date ?? c.preferred_date ?? ''} at {c.confirmed_time}
                </Text>
                {c.zoom_link && (
                  <Text className="text-xs text-primary-foreground/80 mt-0.5">{c.zoom_link}</Text>
                )}
                <Text className="mt-1.5 text-sm text-primary-foreground/90">
                  Would you like to add this to your phone calendar?
                </Text>
                <Pressable
                  onPress={addToCalendar}
                  disabled={addingCalendar}
                  className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-primary-foreground py-3 active:scale-[0.97]"
                >
                  {addingCalendar ? (
                    <ActivityIndicator color="#0f766e" />
                  ) : (
                    <CalendarClockIcon className="text-primary" size={18} />
                  )}
                  <Text className="text-sm font-semibold text-primary">
                    {addingCalendar ? 'Opening…' : 'Add to Phone Calendar'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {error && (
            <View className="mx-5 mb-3 rounded-xl bg-destructive/10 p-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          )}

          {/* Identity */}
          <View className="mx-5 rounded-3xl bg-card p-5">
            <View className="flex-row items-center gap-2">
              <FileTextIcon className="text-primary" size={18} />
              <Text className="text-base font-semibold text-foreground">Your Details</Text>
            </View>
            <View className="mt-3 flex-row gap-2">
              <SalutationPicker
                value={salutation}
                onChange={setSalutation}
                containerClassName="w-20"
              />
              <NationalityPicker
                value={nationality}
                onChange={setNationality}
                containerClassName="flex-1"
              />
            </View>
          </View>

          {/* Date */}
          <View className="mx-5 mt-4 rounded-3xl bg-card p-5">
            <View className="flex-row items-center gap-2">
              <CalendarClockIcon className="text-primary" size={18} />
              <Text className="text-base font-semibold text-foreground">Preferred Zoom Date</Text>
            </View>
            <CalendarPicker value={date} onChange={setDate} />
            <Text className="mt-4 text-sm font-semibold text-foreground">Preferred time slot</Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              Pick the window that works best for you — your staff will confirm the exact time within it.
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {TIME_SLOTS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTime(t)}
                  className={`rounded-full px-4 py-2 ${time === t ? 'bg-primary' : 'bg-muted'} active:scale-[0.97]`}
                >
                  <Text className={`text-sm font-semibold ${time === t ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Uploads */}
          <UploadCard
            label="Passport Copy"
            hint="Tap to upload or take a photo"
            preview={passport}
            uploading={uploading === 'passport'}
            onPick={() => pickPhoto('passport')}
          />
          <UploadCard
            label="Address Proof"
            hint="Utility bill or bank statement"
            preview={address}
            uploading={uploading === 'address'}
            onPick={() => pickPhoto('address')}
          />

          {/* Submit */}
          <Pressable
            onPress={() => submit.mutate()}
            disabled={submit.isPending}
            className="mx-5 mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4 active:scale-[0.97]"
          >
            {submit.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <SendIcon className="text-primary-foreground" size={18} />
                <Text className="text-base font-semibold text-primary-foreground">Submit</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}

function UploadCard({ label, hint, preview, uploading, onPick }: { label: string; hint: string; preview: string | null; uploading: boolean; onPick: () => void }) {
  return (
    <View className="mx-5 mt-4 rounded-3xl bg-card p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">{label}</Text>
        {preview && !uploading && (
          <Text className="text-xs font-semibold text-chart-2">Uploaded ✓</Text>
        )}
      </View>
      <Pressable
        onPress={onPick}
        disabled={uploading}
        className="mt-3 h-32 rounded-2xl border-2 border-dashed border-border items-center justify-center overflow-hidden active:scale-[0.98]"
      >
        {preview ? (
          <Image source={{ uri: preview }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View className="items-center">
            <CameraIcon className="text-muted-foreground" size={28} />
            <Text className="mt-2 text-sm text-muted-foreground">{hint}</Text>
          </View>
        )}
        {uploading && (
          <View className="absolute inset-0 bg-black/40 items-center justify-center">
            <ActivityIndicator color="#ffffff" />
            <Text className="mt-2 text-xs font-semibold text-white">Uploading…</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
