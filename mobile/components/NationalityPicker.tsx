import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { ChevronDownIcon, CheckIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useTheme } from '@/src/hooks';

cssInterop(ChevronDownIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type Option = { label: string; value: string };

const NATIONALITIES: Option[] = [
  { label: 'Korea', value: 'Korea' },
  { label: 'Japan', value: 'Japan' },
  { label: 'Thailand', value: 'Thailand' },
  { label: 'Taiwan', value: 'Taiwan' },
  { label: 'Malaysia', value: 'Malaysia' },
  { label: 'India', value: 'India' },
  { label: 'Indonesia', value: 'Indonesia' },
  { label: 'Other', value: 'Other' },
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  options?: Option[];
  placeholder?: string;
  containerClassName?: string;
};

/**
 * A client nationality dropdown (Korea, Japan, Thailand, Taiwan, Malaysia,
 * India, Indonesia, Other). Same modal pattern as SalutationPicker so it
 * renders identically on web and native.
 */
export default function NationalityPicker({
  value,
  onChange,
  options = NATIONALITIES,
  placeholder = 'Select nationality',
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
        >
          {display || placeholder}
        </Text>
        <ChevronDownIcon className="text-muted-foreground" size={16} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[70%] rounded-t-3xl bg-card p-4" onPress={() => {}}>
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
