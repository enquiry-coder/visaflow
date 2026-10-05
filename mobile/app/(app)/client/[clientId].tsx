import { useState, useEffect, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeftIcon, MessageCircleIcon, ClipboardPasteIcon, CheckCircle2Icon, FileTextIcon, CameraIcon, CalendarClockIcon, XIcon, UserCheckIcon, ExternalLinkIcon, UploadIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useApp, useAuth } from '@/src/hooks';
import SalutationPicker from '@/components/SalutationPicker';
import NationalityPicker from '@/components/NationalityPicker';
import { uploadClientDoc, uploadStampedCapture } from '@/src/lib/upload';
import { stampCapture } from '@/src/lib/stampCapture';
import { getStaffZoomLink, saveStaffZoomLink } from '@/src/lib/remember';

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
cssInterop(XIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(UserCheckIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ExternalLinkIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(UploadIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

/**
 * Print the full ID-verification report (web only). Assembles the passport,
 * address proof and stamped capture into one print-ready page, plus a completed
 * checklist with timestamps + staff, so the whole proof-of-work is on one document.
 */
function printReport(c: any, docsClear: boolean, allStepsComplete: boolean): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const w = window.open('', '_blank');
  if (!w) return;

  const sal = c.salutation ? `${c.salutation} ` : '';
  const fullName = `${sal}${c.first_name} ${c.last_name}`.trim();
  const step = (done: boolean, label: string, meta?: string) =>
    `<div class="row"><span class="chk">${done ? '✓' : '○'}</span><span class="lbl">${label}${meta ? ` <span class="meta">— ${meta}</span>` : ''}</span></div>`;

  const docCard = (t: string, u: string | null | undefined) =>
    u
      ? `<div class="imgWrap"><div class="cap">${t}</div><img src="${u}" /></div>`
      : `<div class="imgWrap empty"><div class="cap">${t}</div><div class="missing">Not uploaded</div></div>`;

  const hk = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Hong_Kong' }) + ' (HK)' : '—');

  const html = `<!doctype html><html><head><title>ID Verification Report — ${c.reg_no}</title>
<style>
  *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:32px;color:#111;background:#fff}
  .hd{border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:20px}
  .hd h1{font-size:22px;margin:0 0 4px}.hd .sub{font-size:12px;color:#555}
  .badge{display:inline-block;background:#0c8f3c;color:#fff;font-size:11px;font-weight:bold;padding:3px 8px;border-radius:4px;margin-top:8px}
  .cap{background:#f4f4f4;font-size:10px;font-weight:bold;padding:5px 8px;border-bottom:1px solid #ddd}
  .imgWrap{border:1px solid #ddd;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid}
  .imgWrap img{display:block;width:100%;height:110px;max-height:110px;object-fit:contain;background:#fafafa}
  .missing{height:110px;display:flex;align-items:center;justify-content:center;color:#999;font-size:11px}
  .capture{margin-top:12px}
  .capture img{height:260px;max-height:260px}
  .lower{margin-top:12px;display:flex;gap:16px;align-items:stretch}
  .docs{flex:0 0 42%;display:flex;flex-direction:column;gap:12px;max-width:42%}
  .steps{flex:1;border:1px solid #eee;border-radius:6px;padding:12px}
  .steps h2{font-size:13px;margin:0 0 6px;padding-bottom:6px;border-bottom:1px solid #eee}
  .row{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px dashed #eee;font-size:12px}
  .chk{font-weight:bold;color:#0c8f3c;width:14px;text-align:center}
  .lbl{flex:1}.meta{color:#777;font-size:11px}
  .foot{margin-top:16px;font-size:9px;color:#888}
  @media print{
    @page{size:A4;margin:12mm}
    body{margin:0;padding:12mm;width:auto}
    img{max-width:100% !important;height:auto !important;max-height:180px !important;object-fit:contain}
    .capture img{max-height:240px !important}
    .imgWrap,.lower,.steps{break-inside:avoid;page-break-inside:avoid}
  }
</style></head><body>
  <div class="hd">
    <h1>ID Verification Report</h1>
    <div class="sub">Client: ${fullName} &nbsp;·&nbsp; Serial No: ${c.reg_no} &nbsp;·&nbsp; Nationality: ${c.nationality || '—'}</div>
    <div class="badge">${allStepsComplete ? '✓ ALL STEPS COMPLETED' : 'INCOMPLETE'}</div>
  </div>

  <div class="imgWrap capture">
    <div class="cap">Live Face Capture</div>
    ${(c.capture_stamped_url || c.capture_url) ? `<img src="${c.capture_stamped_url || c.capture_url}" />` : `<div class="missing" style="height:260px">Not uploaded</div>`}
  </div>

  <div class="lower">
    <div class="docs">
      ${docCard('Passport Copy', c.passport_url)}
      ${docCard('Address Proof', c.address_proof_url)}
    </div>
    <div class="steps">
      <h2>Live Verification — Steps Completed</h2>
      ${step(!!c.passport_url && !!c.address_proof_url, '1. Documents uploaded')}
      ${step(docsClear, '2. Documents marked Clear')}
      ${step(!!c.capture_url, '3. Live face captured')}
      ${step(c.face_match === 'yes', '4. Face matches passport photo', c.face_match === 'yes' ? `by ${c.matched_by || 'Staff'} ${hk(c.face_match_at)}` : (c.face_match === 'no' ? 'flagged — NO match' : 'not recorded'))}
      ${step(!!c.matched_at, '5. Matched & stamped (timestamp burned in)', `by ${c.matched_by || 'Staff'} ${hk(c.matched_at)}`)}
    </div>
  </div>

  <div class="foot">Generated ${hk(new Date().toISOString())} · Grandtag Insurance Broker</div>
</body></html>`;

  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export default function ClientDetailScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { client } = useApp();
  const { user, userFullName } = useAuth();
  const queryClient = useQueryClient();
  const [zoomLink, setZoomLink] = useState('');
  const [salutation, setSalutation] = useState('');
  const [nationality, setNationality] = useState('');
  const [confirmedTime, setConfirmedTime] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ label: string; url: string } | null>(null);
  const [matchedSaving, setMatchedSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pre-fill this staff user's Zoom link from the last time they entered one.
  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    getStaffZoomLink(user.id).then((saved) => {
      if (active && saved && !zoomLink) setZoomLink(saved);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      // Also refresh the pipeline board's list (and its category counts) so a
      // stage change here (status/documents/matched) shows up immediately there.
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
    },
    onError: (e: any) => setError(e?.message ?? 'Update failed'),
  });

  const sendZoom = async () => {
    if (!c) return;
    const link = (zoomLink.trim() || c.zoom_link || '').trim();
    if (!link) {
      setError('Enter the Zoom link first');
      return;
    }
    if (user?.id) saveStaffZoomLink(user.id, link);
    const exactTime = confirmedTime.trim() || c.confirmed_time || c.preferred_time || '';
    update.mutate({
      zoom_link: link,
      confirmed_time: confirmedTime.trim() || c.confirmed_time || null,
      confirmed_date: c.preferred_date || null,
    });
    const sal = c.salutation ? `${c.salutation} ` : '';
    const fullName = `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}`;
    const msg = `Thanks ${sal}${fullName}! Your documents are received. Your Zoom interview is confirmed${exactTime ? ` for ${c.preferred_date ? `${c.preferred_date} at ` : ''}${exactTime} (Hong Kong time, UTC+8)` : ''}. Here is your meeting link: ${link}`;
    const phone = (c.phone || '').replace(/\D/g, '');
    try {
      await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
      setNotice('Exact time + Zoom link sent on WhatsApp');
    } catch (e: any) {
      setError(e?.message ?? 'Could not open WhatsApp');
    }
  };

  // Shared upload path: take an image File and store it as the Zoom capture.
  const processClipboardFile = async (file: File) => {
    if (!c) return;
    setNotice('Uploading capture…');
    try {
      const url = URL.createObjectURL(file);
      const publicUrl = await uploadClientDoc(url, 'capture', c.reg_no);
      URL.revokeObjectURL(url);
      update.mutate({ capture_url: publicUrl });
      setNotice(`Capture saved as ${c.reg_no}_SC.png — mark Verified below`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not upload pasted image');
    }
  };

  // Global web listener so pressing Ctrl+V directly pastes the screenshot —
  // no need to click the button. The browser fires a `paste` event with the
  // image inside event.clipboardData.items, which is more reliable than the
  // async navigator.clipboard.read() API.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processClipboardFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [c?.id]);

  const pasteCapture = async () => {
    if (!c) return;
    if (Platform.OS === 'web') {
      // Button fallback: use the Clipboard API to read an image.
      if (typeof navigator !== 'undefined' && navigator.clipboard?.read) {
        try {
          const items = await navigator.clipboard.read();
          const img = items.find((i) => i.types.includes('image/png'));
          if (img) {
            const blob = await img.getType('image/png');
            await processClipboardFile(new File([blob], 'capture.png', { type: 'image/png' }));
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

  // Capture the client's Zoom screenshot as evidence and stamp a "matched" record.
  // On web, the timestamp + MATCHED badge + staff/client are burned INTO the image
  // pixels so the printed capture is self-contained evidence.
  const markMatched = async () => {
    if (!c) return;
    if (!c.capture_url) {
      setError('Paste or upload the client\'s Zoom screenshot first, then tap Matched.');
      return;
    }
    const staffName = userFullName || user?.email || 'Staff';
    const clientName = `${c.first_name} ${c.last_name}`.trim();
    const matchedAt = new Date().toISOString();
    setMatchedSaving(true);
    try {
      // Burn the stamp into the image pixels (web canvas only).
      let stampedUrl: string | null = null;
      if (Platform.OS === 'web') {
        try {
          const stampedDataUrl = await stampCapture(c.capture_url, {
            matchedBy: staffName,
            clientName,
            regNo: c.reg_no,
            matchedAt,
          });
          stampedUrl = await uploadStampedCapture(stampedDataUrl, c.reg_no);
        } catch (stampErr: any) {
          // Stamping is best-effort on the client; the matched record still saves.
          console.warn('Could not burn stamp into image:', stampErr);
        }
      }

      await new Promise<void>((resolve, reject) => {
        update.mutate(
          { matched_at: matchedAt, matched_by: staffName, capture_stamped_url: stampedUrl },
          { onSuccess: () => resolve(), onError: (e: any) => reject(e) },
        );
      });
      setNotice(
        stampedUrl
          ? 'Matched — evidence image stamped with time + MATCHED badge (print-ready).'
          : `Matched & saved as evidence by ${staffName}`,
      );
    } catch (e: any) {
      setError(e?.message ?? 'Could not save matched evidence');
    } finally {
      setMatchedSaving(false);
    }
  };

  // Upload an image file (web) as the Zoom capture evidence.
  const uploadCaptureFile = async (file: File) => {
    if (!c) return;
    setNotice('Uploading capture…');
    try {
      const uri = URL.createObjectURL(file);
      const publicUrl = await uploadClientDoc(uri, 'capture', c.reg_no);
      URL.revokeObjectURL(uri);
      update.mutate({ capture_url: publicUrl });
      setNotice('Capture saved — now tap "Matched" to record the evidence.');
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    }
  };

  const saveProfile = () => {
    update.mutate({ salutation: salutation.trim() || null, nationality: nationality.trim() || null });
    setNotice('Profile updated');
  };

  // Record the staff's affirmative "does the live client match the passport photo?"
  // decision as proof-of-work. yes/no + timestamp are persisted so the ID check is
  // auditable evidence, not just an unrecorded human judgment.
  const markFaceMatch = (result: 'yes' | 'no') => {
    if (!c) return;
    update.mutate({ face_match: result, face_match_at: new Date().toISOString() });
    setNotice(
      result === 'yes'
        ? 'Face match confirmed — saved as proof of ID verification.'
        : 'Face match marked "No" — flagged for review.',
    );
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
  // The interview is only "complete" (and report-ready) once every KYC step is done.
  const allStepsComplete = !!docsClear && c.face_match === 'yes' && !!c.matched_at && !!c.capture_url;

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
            <Text className="mt-0.5 text-[11px] text-muted-foreground">Signed in as <Text className="font-semibold text-foreground">{userFullName || user?.email || 'User'}</Text></Text>
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
                  <Text className="text-xs text-muted-foreground">Hong Kong time (UTC+8)</Text>
                </View>
              )}
            </View>
          ) : (
            <Text className="mt-2 text-sm text-muted-foreground">No time proposed yet — awaiting client input.</Text>
          )}
        </Section>

        {/* Live Verification */}
        <Section icon={<UserCheckIcon className="text-muted-foreground" size={16} />} title="Live Verification (during the Zoom meeting)">
          {/* Step checklist — complete these in order 1→5 to finish the interview */}
          <View className="mt-3 rounded-xl bg-background border border-border p-3 gap-1.5">
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Complete in order</Text>
            <StepRow done={!!c.passport_url && !!c.address_proof_url} num={1} label="Documents uploaded" />
            <StepRow done={docsClear} num={2} label="Documents marked Clear" />
            <StepRow done={!!c.capture_url} num={3} label="Live face captured" />
            <StepRow done={c.face_match === 'yes'} num={4} label="Face matches passport photo" />
            <StepRow done={!!c.matched_at} num={5} label="Matched & stamped (timestamp burned in)" />
          </View>

          <View className="mt-3 flex-col gap-3 md:flex-row">
            {/* Left: submitted documents */}
            <View className="flex-1 gap-3">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">① Submit documents · ② Review clarity</Text>
              <DocThumb label="Passport Copy" url={c.passport_url} onPress={() => c.passport_url && setPreviewDoc({ label: 'Passport Copy', url: c.passport_url })} />
              <DocThumb label="Address Proof" url={c.address_proof_url} onPress={() => c.address_proof_url && setPreviewDoc({ label: 'Address Proof', url: c.address_proof_url })} />
              {docsComplete && !docsClear && (
                <Text className="text-[11px] text-accent-foreground">Review both documents for clarity below.</Text>
              )}
            </View>

            {/* Right: live capture + matched action */}
            <View className="flex-1 gap-3">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">③ Capture the client's live face</Text>
              <View className="rounded-xl bg-card border border-border overflow-hidden">
                {(c.capture_stamped_url || c.capture_url) ? (
                  <Pressable onPress={() => setPreviewDoc({ label: c.capture_stamped_url ? 'Matched Evidence (stamped)' : 'Live Zoom Capture', url: (c.capture_stamped_url || c.capture_url)! })}>
                    <Image source={{ uri: (c.capture_stamped_url || c.capture_url)! }} style={{ width: '100%', height: 180 }} resizeMode="contain" />
                    {c.capture_stamped_url ? (
                      <View className="absolute top-2 right-2 rounded-md bg-chart-2 px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-white">STAMPED</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ) : (
                  <View className="h-[180px] items-center justify-center gap-2 px-4">
                    <CameraIcon className="text-muted-foreground" size={28} />
                    <Text className="text-center text-xs text-muted-foreground">
                      Take a Zoom screenshot of the client's face (Win+Shift+S), then paste it here with Ctrl+V.
                    </Text>
                  </View>
                )}
              </View>

              <View className="flex-row gap-2">
                <Pressable onPress={pasteCapture} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-secondary py-2.5 active:scale-[0.97]">
                  <ClipboardPasteIcon className="text-secondary-foreground" size={15} />
                  <Text className="text-xs font-semibold text-secondary-foreground">Paste (Ctrl+V)</Text>
                </Pressable>
                <Pressable onPress={() => fileInputRef.current?.click()} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-secondary py-2.5 active:scale-[0.97]">
                  <UploadIcon className="text-secondary-foreground" size={15} />
                  <Text className="text-xs font-semibold text-secondary-foreground">Upload</Text>
                </Pressable>
              </View>
              {Platform.OS === 'web' && (
                <input
                  ref={fileInputRef as any}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadCaptureFile(file);
                    e.target.value = '';
                  }}
                />
              )}

              {/* Face-match proof-of-work: does the live client match the passport photo? */}
              <View className="rounded-xl bg-background border border-border p-3 gap-2">
                <Text className="text-xs font-semibold text-foreground">④ Confirm the live client matches the passport photo</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => markFaceMatch('yes')}
                    className={`flex-1 items-center rounded-lg py-2 ${c.face_match === 'yes' ? 'bg-chart-2' : 'bg-card'}`}
                  >
                    <Text className={`text-xs font-semibold ${c.face_match === 'yes' ? 'text-white' : 'text-foreground'}`}>✓ Yes</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => markFaceMatch('no')}
                    className={`flex-1 items-center rounded-lg py-2 ${c.face_match === 'no' ? 'bg-accent' : 'bg-card'}`}
                  >
                    <Text className={`text-xs font-semibold ${c.face_match === 'no' ? 'text-accent-foreground' : 'text-foreground'}`}>✕ No</Text>
                  </Pressable>
                </View>
                {c.face_match && (
                  <Text className="text-[11px] text-muted-foreground">
                    Recorded by {c.matched_by ?? 'Staff'} · {new Date(c.face_match_at ?? Date.now()).toLocaleString()} (Hong Kong time, UTC+8)
                  </Text>
                )}
              </View>

              <Pressable
                onPress={markMatched}
                disabled={matchedSaving}
                className={`flex-row items-center justify-center gap-2 rounded-xl py-3 active:scale-[0.97] ${c.capture_url ? 'bg-primary' : 'bg-muted'}`}
              >
                {matchedSaving ? (
                  <ActivityIndicator size="small" color={c.capture_url ? '#fff' : '#6b7280'} />
                ) : (
                  <UserCheckIcon className={c.capture_url ? 'text-primary-foreground' : 'text-muted-foreground'} size={18} />
                )}
                <Text className={`text-sm font-semibold ${c.capture_url ? 'text-primary-foreground' : 'text-muted-foreground'}`}>⑤ Matched — save as evidence (timestamp burned in)</Text>
              </Pressable>

              {allStepsComplete ? (
                <Pressable
                  onPress={() => printReport(c, docsClear, true)}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:scale-[0.97]"
                >
                  <CheckCircle2Icon className="text-primary-foreground" size={16} />
                  <Text className="text-sm font-semibold text-primary-foreground">Print verification report</Text>
                </Pressable>
              ) : null}

              {c.matched_at ? (
                <View className="rounded-xl bg-chart-2/10 p-3 gap-2">
                  <Text className="text-xs font-semibold text-chart-2">✓ Matched</Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {c.matched_by ?? 'Staff'} · {new Date(c.matched_at).toLocaleString()} (Hong Kong time, UTC+8)
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Clarity review */}
          <View className="mt-3 gap-2">
            {c.passport_url && (
              <ClarityReview
                kind="passport"
                clarity={c.passport_clarity}
                onSet={(v) => setClarity('passport', v)}
                onReupload={() => sendReuploadLink('passport')}
              />
            )}
            {c.address_proof_url && (
              <ClarityReview
                kind="address"
                clarity={c.address_clarity}
                onSet={(v) => setClarity('address', v)}
                onReupload={() => sendReuploadLink('address')}
              />
            )}
          </View>
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

      {/* Full-screen document preview modal */}
      <Modal visible={!!previewDoc} transparent animationType="fade" onRequestClose={() => setPreviewDoc(null)}>
        <View className="flex-1 bg-black/90 items-center justify-center px-4">
          <View className="w-full max-w-3xl rounded-2xl bg-card overflow-hidden">
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{previewDoc?.label}</Text>
              <Pressable onPress={() => setPreviewDoc(null)} className="w-8 h-8 rounded-full bg-muted items-center justify-center active:scale-95">
                <XIcon className="text-foreground" size={18} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }} style={{ maxHeight: '80%' as any }}>
              <Image
                source={{ uri: previewDoc?.url ?? '' }}
                style={{ width: '100%', height: 480 }}
                resizeMode="contain"
              />
            </ScrollView>
            <View className="px-4 py-3 border-t border-border">
              <Pressable
                onPress={() => previewDoc?.url && (Platform.OS === 'web' ? (window.open(previewDoc.url, '_blank') as any) : Linking.openURL(previewDoc.url))}
                className="flex-row items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 active:scale-[0.97]"
              >
                <ExternalLinkIcon className="text-secondary-foreground" size={16} />
                <Text className="text-sm font-semibold text-secondary-foreground">Open full image in browser</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

function StepRow({ num, label, done }: { num: number; label: string; done: boolean }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className={`w-5 h-5 rounded-full items-center justify-center ${done ? 'bg-chart-2' : 'bg-muted'}`}>
        {done ? (
          <Text className="text-[11px] font-bold text-white">✓</Text>
        ) : (
          <Text className="text-[11px] font-bold text-muted-foreground">{num}</Text>
        )}
      </View>
      <Text className={`text-xs ${done ? 'text-foreground line-through' : 'text-muted-foreground'}`}>{label}</Text>
    </View>
  );
}

function DocThumb({ label, url, onPress }: { label: string; url?: string | null; onPress?: () => void }) {
  const content = url ? (
    <Image source={{ uri: url }} style={{ width: '100%', height: 140 }} resizeMode="contain" />
  ) : (
    <View className="h-[140px] items-center justify-center">
      <FileTextIcon className="text-muted-foreground" size={22} />
      <Text className="mt-1 text-xs text-muted-foreground">Not uploaded yet</Text>
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={!url}
      className="rounded-xl bg-card border border-border overflow-hidden"
    >
      {content}
      <View className="flex-row items-center justify-between px-3 py-2 border-t border-border">
        <Text className="text-xs font-semibold text-foreground">{label}</Text>
        {url ? <Text className="text-[11px] text-primary">Tap to enlarge</Text> : null}
      </View>
    </Pressable>
  );
}
