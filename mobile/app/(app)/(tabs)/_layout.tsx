import { Tabs } from 'expo-router';
import { LayoutGridIcon, ClipboardPlusIcon, ShieldUserIcon } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';

cssInterop(LayoutGridIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ClipboardPlusIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ShieldUserIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#16272f' : '#ffffff',
          borderTopColor: isDark ? '#243840' : '#e2ded4',
        },
        tabBarActiveTintColor: isDark ? '#f5a442' : '#12667a',
        tabBarInactiveTintColor: isDark ? '#8d9d9e' : '#70797a',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pipeline',
          tabBarIcon: ({ focused }) => (
            <LayoutGridIcon className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: 'Import',
          tabBarIcon: ({ focused }) => (
            <ClipboardPlusIcon className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ focused }) => (
            <ShieldUserIcon className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
