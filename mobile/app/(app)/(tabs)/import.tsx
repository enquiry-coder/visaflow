import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheetIcon, PlusIcon, Trash2Icon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useApp, useAuth } from '@/src/hooks';
import { newId } from '@/src/lib/id';
import SalutationPicker from '@/components/SalutationPicker';
import CountryCodePicker from '@/components/CountryCodePicker';
import NationalityPicker from '@/components/NationalityPicker';

cssInterop(FileSpreadsheetIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(PlusIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2Icon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type Row = { salutation: string; first_name: string; last_name: string; country_code: string; phone: string; nationality: string; handling_staff: string };

const EMPTY_ROW: Row = { salutation: '', first_name: '', last_name: '', country_code: '+44', phone: '', nationality: '', handling_staff: 'Sarah Mitchell' };

export default function ImportScreen() {
  const { client } = useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }]);
  const [pasteText, setPasteText] = useState('');
  const [importingDraft, setImportingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Split pasted Excel/CSV text into rows. Handles tabs (Excel copy) and commas (CSV).
  const parsePaste = () => {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const parsed: Row[] = [];
    for (const line of lines) {
      // Skip header-like lines (e.g. "First name, Last name, ...")
      if (/first\s*name/i.test(line) && /last\s*name/i.test(line)) continue;
      const cols = line.includes('\t') ? line.split('\t') : line.split(',');
      const [a = '', b = '', c = '', d = '', e = '', f = ''] = cols.map((c) => c.trim());
      // Detect header order if the first column is "Mr/Ms", otherwise assume salutation first.
      const salutation = a || '';
      const first_name = b || '';
      const last_name = c || '';
      const phone = d || '';
      const nationality = e || '';
      const handling_staff = f || 'Sarah Mitchell';
      if (!first_name && !last_name && !phone) continue;
      parsed.push({ salutation, first_name, last_name, country_code: '+44', phone, nationality, handling_staff });
    }

    if (parsed.length === 0) {
      setError('Nothing parsed — paste rows like "John, Smith, +1 555 0100, Sarah Mitchell" (one per line)');
      return;
    }

    // Replace the blank starter row, then append parsed rows.
    setRows((prev) => {
      const blank = prev.length === 1 && !prev[0].first_name.trim() && !prev[0].last_name.trim() && !prev[0].phone.trim();
      return blank ? parsed : [...prev, ...parsed];
    });
    setPasteText('');
    setError(null);
    setSuccess(`${parsed.length} row${parsed.length === 1 ? '' : 's'} added — review & submit below`);
  };

  const importRows = useMutation({
    mutationFn: async (rows: Row[]) => {
      // Collision-safe: existing seed rows already occupy REG-2026-0001..0004,
      // so derive a unique suffix from the current timestamp instead of a sequential index.
      const stamp = Date.now().toString(36).toUpperCase();
      const inserts = rows
        .filter((r) => r.first_name.trim() && r.last_name.trim())
        .map((r) => ({
          id: newId(),
          reg_no: `REG-${new Date().getFullYear()}-${stamp}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
          salutation: r.salutation.trim() || null,
          first_name: r.first_name.trim(),
          last_name: r.last_name.trim(),
          phone: `${r.country_code}${r.phone.trim()}`,
          country_code: r.country_code,
          phone_number: r.phone.trim() || '',
          nationality: r.nationality.trim() || null,
          handling_staff: r.handling_staff.trim() || 'Unassigned',
          status: 'awaiting_input',
          follow_up_due: false,
        }));
      if (inserts.length === 0) throw new Error('Add at least one client with a first & last name');
      const { error } = await client.from('clients').insert(inserts);
      if (error) throw error;
      return inserts.length;
    },
    onSuccess: (n) => {
      setSuccess(`Imported ${n} client${n === 1 ? '' : 's'} — assigned & awaiting outreach`);
      setRows([{ ...EMPTY_ROW }]);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (e: any) => setError(e?.message ?? 'Import failed'),
  });

  const setRow = (i: number, key: keyof Row, val: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <View className="px-5 pt-5 pb-4">
            <Text className="text-xs font-semibold tracking-widest text-primary uppercase">Batch Upload</Text>
            <Text className="mt-1 text-3xl font-bold tracking-tight text-foreground">Import Clients</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Paste your Excel rows here — Handling Staff auto-assigns on import.
            </Text>
          </View>

          {/* Paste target */}
          <View className="mx-5 rounded-3xl border-2 border-dashed border-border bg-card p-4">
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 rounded-2xl bg-secondary items-center justify-center">
                <FileSpreadsheetIcon className="text-secondary-foreground" size={24} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-semibold text-foreground">Paste Excel / CSV rows</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  Columns: Mr/Ms, First name, Last name, Phone, Nationality, Handling Staff
                </Text>
              </View>
            </View>
            <TextInput
              className="mt-3 min-h-[120px] bg-background rounded-xl px-3 py-3 border border-border text-foreground text-left"
              style={{ textAlignVertical: 'top' }}
              placeholder={'Example:\nMr, John, Smith, +1 555 0100, USA, Sarah Mitchell\nMs, Alice, Doe, +1 555 0101, UK, Sarah Mitchell'}
              placeholderTextColor="#8d9d9e"
              multiline
              value={pasteText}
              onChangeText={setPasteText}
            />
            <Pressable
              onPress={parsePaste}
              disabled={!pasteText.trim() || importingDraft}
              className="mt-3 flex-row items-center justify-center rounded-xl bg-secondary py-3 active:scale-[0.98]"
            >
              <Text className="text-sm font-semibold text-secondary-foreground">Parse pasted rows</Text>
            </Pressable>
          </View>

          {error && (
            <View className="mx-5 mt-4 rounded-xl bg-destructive/10 p-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          )}
          {success && (
            <View className="mx-5 mt-4 rounded-xl bg-primary/10 p-3">
              <Text className="text-sm text-primary">{success}</Text>
            </View>
          )}

          {/* Editable rows */}
          <View className="mt-5 px-5 gap-3">
            {rows.map((r, i) => (
              <View key={i} className="rounded-2xl bg-card p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-muted-foreground">Row {i + 1}</Text>
                  {rows.length > 1 && (
                    <Pressable onPress={() => setRows((p) => p.filter((_, idx) => idx !== i))}>
                      <Trash2Icon className="text-destructive" size={16} />
                    </Pressable>
                  )}
                </View>
                <View className="mt-3 flex-row gap-2">
                  <SalutationPicker
                    value={r.salutation}
                    onChange={(v) => setRow(i, 'salutation', v)}
                    containerClassName="w-20"
                  />
                  <TextInput
                    className="flex-1 bg-background rounded-xl px-3 py-3 border border-border text-foreground"
                    placeholder="First name"
                    placeholderTextColor="#8d9d9e"
                    value={r.first_name}
                    onChangeText={(v) => setRow(i, 'first_name', v)}
                  />
                  <TextInput
                    className="flex-1 bg-background rounded-xl px-3 py-3 border border-border text-foreground"
                    placeholder="Last name"
                    placeholderTextColor="#8d9d9e"
                    value={r.last_name}
                    onChangeText={(v) => setRow(i, 'last_name', v)}
                  />
                </View>
                <View className="mt-2 flex-row gap-2">
                  <CountryCodePicker
                    value={r.country_code}
                    onChange={(v) => setRow(i, 'country_code', v)}
                  />
                  <TextInput
                    className="flex-1 bg-background rounded-xl px-3 py-3 border border-border text-foreground"
                    placeholder="Phone number"
                    placeholderTextColor="#8d9d9e"
                    keyboardType="phone-pad"
                    value={r.phone}
                    onChangeText={(v) => setRow(i, 'phone', v)}
                  />
                </View>
                <View className="mt-2 gap-2">
                  <NationalityPicker
                    value={r.nationality}
                    onChange={(v) => setRow(i, 'nationality', v)}
                  />
                  <TextInput
                    className="bg-background rounded-xl px-3 py-3 border border-border text-foreground"
                    placeholder="Handling staff"
                    placeholderTextColor="#8d9d9e"
                    value={r.handling_staff}
                    onChangeText={(v) => setRow(i, 'handling_staff', v)}
                  />
                </View>
              </View>
            ))}

            <Pressable
              onPress={addRow}
              className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3.5 active:scale-[0.98]"
            >
              <PlusIcon className="text-muted-foreground" size={18} />
              <Text className="text-sm font-semibold text-muted-foreground">Add another row</Text>
            </Pressable>
          </View>

          {/* Submit */}
          <Pressable
            onPress={() => importRows.mutate(rows)}
            disabled={importRows.isPending || importingDraft}
            className="mx-5 mt-6 flex-row items-center justify-center rounded-2xl bg-primary py-4 active:scale-[0.98]"
          >
            {importRows.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">Import & Auto-assign</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
