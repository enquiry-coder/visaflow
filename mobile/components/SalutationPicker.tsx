import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { ChevronDownIcon, CheckIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useTheme } from '@/src/hooks';

cssInterop(ChevronDownIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type Option = { label: string; value: string };

const DEFAULT_OPTIONS: Option[] = [
  { label: 'Mr', value: 'Mr' },
  { label: 'Ms', value: 'Ms' },
  { label: 'Mrs', value: 'Mrs' },
  { label: 'Dr', value: 'Dr' },
  { label: 'Mx', value: 'Mx' },
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  options?: Option[];
  placeholder?: string;
  containerClassName?: string;
};

/**
 * A lightweight dropdown for short enum-like fields (e.g. Mr/Ms). Renders a
 * Pressable trigger that opens a Modal with the options. No native Picker needed,
 * so it behaves identically on web and native.
 */
export default function SalutationPicker({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  placeholder = 'Select',
  containerClassName,
}: Props) {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? value;

  return (
    <View className={containerClassName}>
      <Pressable
        onPress={() => setOpen(true)}
        className="bg-background rounded-xl px-3 py-3 border border-border flex-row items-center justify-between"
      >
        <Text
          className={`text-sm ${display ? 'text-foreground' : 'text-muted-foreground'}`}
          numberOfLines={1}
          style={{ fontFamily: undefined }}
        >
          {display || placeholder}
        </Text>
        <ChevronDownIcon className="text-muted-foreground" size={16} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setOpen(false)}
        >
          <Pressable
            className="max-h-[70%] rounded-t-3xl bg-card p-4"
            onPress={() => {}}
          >
            <View className="w-10 h-1 rounded-full bg-border self-center mb-3" />
            <ScrollView>
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between rounded-xl px-4 py-3.5 active:bg-muted"
                  >
                    <Text className={`text-base ${active ? 'text-primary font-semibold' : 'text-foreground'}`}>
                      {o.label}
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
