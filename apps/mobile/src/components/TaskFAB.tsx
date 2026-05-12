import { Text, TouchableOpacity, View } from "react-native";

export interface TaskFABProps {
  onPress: () => void;
  /** Set to false on screens not inside Tabs (e.g. project detail). */
  aboveTabBar?: boolean;
}

export function TaskFAB({ onPress, aboveTabBar = true }: TaskFABProps): JSX.Element {
  return (
    <View
      style={{
        position: "absolute",
        right: 20,
        bottom: aboveTabBar ? 20 : 20,
        width: 60,
        height: 60,
        zIndex: 9999,
        elevation: 9999,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        accessibilityLabel="Aufgabe hinzufügen"
        activeOpacity={0.85}
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: "#2563EB",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#2563EB",
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 34,
            fontWeight: "300",
            lineHeight: 38,
            marginTop: -2,
          }}
        >
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
}
