import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(ChevronLeftIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronRightIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type Props = {
  value: string | null; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
};

// Lightweight, dependency-free calendar grid (works on web preview AND native).
export default function CalendarPicker({ value, onChange }: Props) {
  const today = new Date();
  const [view, setView] = useState(() => ({
    year: value ? Number(value.slice(0, 4)) : today.getFullYear(),
    month: value ? Number(value.slice(5, 7)) - 1 : today.getMonth(),
  }));

  const { grid, firstWeekday, daysInMonth } = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const firstWeekday = first.getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return { grid: cells, firstWeekday, daysInMonth };
  }, [view]);

  const shift = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const isPast = (d: number) => {
    const date = new Date(view.year, view.month, d);
    const y = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date < y;
  };

  const fmt = (d: number) => {
    const m = String(view.month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${view.year}-${m}-${dd}`;
  };

  return (
    <View className="mt-3 rounded-2xl bg-background border border-border p-3">
      {/* Header */}
      <View className="flex-row items-center justify-between px-1">
        <Pressable onPress={() => shift(-1)} className="w-9 h-9 rounded-full items-center justify-center active:scale-[0.9]">
          <ChevronLeftIcon className="text-muted-foreground" size={20} />
        </Pressable>
        <Text className="text-base font-semibold text-foreground">{monthLabel}</Text>
        <Pressable onPress={() => shift(1)} className="w-9 h-9 rounded-full items-center justify-center active:scale-[0.9]">
          <ChevronRightIcon className="text-muted-foreground" size={20} />
        </Pressable>
      </View>

      {/* Weekday header */}
      <View className="mt-2 flex-row">
        {WEEKDAYS.map((w) => (
          <View key={w} className="flex-1 items-center py-1">
            <Text className="text-[11px] font-semibold text-muted-foreground">{w}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View className="flex-row flex-wrap">
        {grid.map((d, i) => {
          if (d === null) return <View key={`b-${i}`} className="w-[14.28%] aspect-square" />;
          const dateStr = fmt(d);
          const selected = value === dateStr;
          const past = isPast(d);
          return (
            <Pressable
              key={d}
              disabled={past}
              onPress={() => onChange(dateStr)}
              className={`w-[14.28%] aspect-square items-center justify-center ${past ? 'opacity-30' : ''}`}
            >
              <View
                className={`w-9 h-9 rounded-full items-center justify-center ${selected ? 'bg-primary' : 'active:bg-muted'}`}
              >
                <Text className={`text-sm ${selected ? 'font-bold text-primary-foreground' : 'text-foreground'}`}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {value && (
        <Text className="mt-2 text-xs font-semibold text-chart-2 text-center">
          Selected: {value}
        </Text>
      )}
    </View>
  );
}
