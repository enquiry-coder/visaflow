import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { ChevronDownIcon, CheckIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { COUNTRY_CODES } from '@/src/lib/countryCodes';

cssInterop(ChevronDownIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type Props = {
  value: string; // the dial code, e.g. "+44"
  onChange: (dial: string) => void;
};

export default function CountryCodePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRY_CODES.find((c) => c.dial === value);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        className="bg-background rounded-xl px-3 py-3 border border-border flex-row items-center gap-1"
      >
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {selected ? `${selected.dial} ${selected.code}` : value || 'Code'}
        </Text>
        <ChevronDownIcon className="text-muted-foreground" size={14} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[70%] rounded-t-3xl bg-card p-4" onPress={() => {}}>
            <View className="w-10 h-1 rounded-full bg-border self-center mb-3" />
            <ScrollView>
              {COUNTRY_CODES.map((c) => {
                const active = c.dial === value;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      onChange(c.dial);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between rounded-xl px-4 py-3 active:bg-muted"
                  >
                    <Text className={`text-base ${active ? 'text-primary font-semibold' : 'text-foreground'}`}>
                      {c.name} <Text className="text-muted-foreground">({c.dial})</Text>
                    </Text>
                    {active && <CheckIcon className="text-primary" size={18} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
