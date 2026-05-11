import { Tabs } from "expo-router";
import { CalendarDays, Inbox, Folder, Settings, Sun } from "lucide-react-native";

/**
 * Tab navigator for the authenticated app shell. The 5 tabs match the plan
 * (Task 10) and the desktop sidebar order. Deep-link routing into individual
 * tabs is handled in the root layout (`app/_layout.tsx`) so it works on cold
 * start too.
 */
export default function TabLayout(): JSX.Element {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#2563EB" }}>
      <Tabs.Screen
        name="today"
        options={{ title: "Heute", tabBarIcon: ({ color }) => <Sun color={color} /> }}
      />
      <Tabs.Screen
        name="upcoming"
        options={{ title: "Demnächst", tabBarIcon: ({ color }) => <CalendarDays color={color} /> }}
      />
      <Tabs.Screen
        name="inbox"
        options={{ title: "Inbox", tabBarIcon: ({ color }) => <Inbox color={color} /> }}
      />
      <Tabs.Screen
        name="projects"
        options={{ title: "Projekte", tabBarIcon: ({ color }) => <Folder color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color }) => <Settings color={color} /> }}
      />
    </Tabs>
  );
}
