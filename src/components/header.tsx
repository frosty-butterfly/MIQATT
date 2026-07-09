// components/Header.tsx
import { Href, useRouter, useSegments } from "expo-router";
import { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar } from "react-native-calendars";

type HeaderProps = {
  fullName: string;
  onLogout: () => void;
  locationLabel?: string;
  timeString: string;
  dateString: string;
  markedDates?: Record<string, any>;
};

export default function Header({
  fullName,
  onLogout,
  locationLabel,
  timeString,
  dateString,
  markedDates = {},
}: HeaderProps) {
  const router = useRouter();
  const segments = useSegments();
  const [calendarVisible, setCalendarVisible] = useState(false);

  const currentTab = segments.length > 1 ? segments[1] : 'tracker';

const allTabs = [
  { key: 'tracker', label: 'Tracker', path: '/(tabs)/tracker' as Href },
  { key: 'qada', label: 'Qada', path: '/(tabs)/qada' as Href },
  { key: 'circle', label: 'Circle', path: '/(tabs)/circle' as Href },
  { key: 'profile', label: 'Profile', path: '/(tabs)/profile' as Href }, // NEW
  { key: 'about', label: 'About', path: '/(tabs)/about' as Href },
];

  return (
    <>
      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => setCalendarVisible(true)}>
          <Text style={styles.navLink}>Calendar</Text>
        </TouchableOpacity>

        {allTabs
          .filter((tab) => tab.key !== currentTab)
          .map((tab) => (
            <TouchableOpacity key={tab.key} onPress={() => router.push(tab.path)}>
              <Text style={styles.navLink}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
      </View>

      {/* Clock Card */}
      <View style={styles.clockCard}>
        <Text style={styles.clockTime}>{timeString}</Text>
        <Text style={styles.clockDate}>{dateString}</Text>
        {locationLabel ? <Text style={styles.clockLocation}>{locationLabel}</Text> : null}
      </View>

      {/* Greeting + Logout */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Assalamualaikum,</Text>
          <Text style={styles.name}>{fullName || "User"}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Modal */}
      <Modal visible={calendarVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.calendarCard}>
            <Text style={styles.modalTitle}>Prayer History</Text>
            <Calendar
              markedDates={markedDates}
              theme={{
                backgroundColor: "#1a1d23",
                calendarBackground: "#1a1d23",
                textSectionTitleColor: "#9ca3af",
                dayTextColor: "#fff",
                monthTextColor: "#fff",
                todayTextColor: "#22c55e",
                arrowColor: "#22c55e",
              }}
            />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#22c55e" }]} />
                <Text style={styles.legendText}>On time</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#f59e0b" }]} />
                <Text style={styles.legendText}>Late</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
                <Text style={styles.legendText}>Missed</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setCalendarVisible(false)}>
              <Text style={styles.modalCancel}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // ... same styles as before (unchanged)
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2e37",
    paddingBottom: 12,
  },
  navLink: { color: "#22c55e", fontSize: 13, fontWeight: "600" },
  clockCard: {
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 10,
    padding: 12,
  },
  clockTime: { color: "#fff", fontSize: 28, fontWeight: "bold", fontVariant: ["tabular-nums"] },
  clockDate: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  clockLocation: { color: "#22c55e", fontSize: 11, marginTop: 4 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: { color: "#9ca3af", fontSize: 13 },
  name: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  logoutButton: { backgroundColor: "#3f1d1d", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  logoutText: { color: "#f87171", fontSize: 12, fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  calendarCard: { backgroundColor: "#1a1d23", borderRadius: 12, padding: 16, width: "90%" },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  modalCancel: { color: "#6b7280", marginTop: 12, textAlign: "center" },
  legendRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: "#9ca3af", fontSize: 12 },
});