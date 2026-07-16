// app/(tabs)/calendar.tsx
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView, StyleSheet, Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Calendar } from "react-native-calendars";
import { auth, db } from "../../../firebaseConfig";
import AppHeader from '../../components/appHeader';
import { useClock } from "../../hooks/useClock";

const PRAYERS = ["Subuh", "Zohor", "Asar", "Maghrib", "Isyak"];
const COLORS = {
  cream: "#F8F4EC",
  emerald: "#1E4D3A",
  gold: "#D4AF37",
  goldLight: "#F3E5AB",
  charcoal: "#2C2C2C",
  white: "#FFFFFF",
  muted: "#A0A0A0",
  border: "#E2DCD0",
  success: "#2E7D32",
  warning: "#B76E00",
  danger: "#B71C1C",
};

function dayColor(prayers: Record<string, string> | undefined) {
  if (!prayers || Object.keys(prayers).length === 0) return null;
  const values = Object.values(prayers);
  if (values.includes("Missed")) return COLORS.danger;
  if (values.includes("Prayed late")) return COLORS.warning;
  if (PRAYERS.every((p) => prayers[p] === "Prayed on time")) return COLORS.success;
  return COLORS.muted;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { dateString } = useClock();

  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [fullName, setFullName] = useState("");
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPrayers, setSelectedPrayers] = useState<Record<string, string> | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) setFullName(userDoc.data().Full_Name || "");
    };
    fetchUser();
    loadCalendarMarks(uid);
  }, [uid]);

  const loadCalendarMarks = async (userId: string) => {
    setLoading(true);
    try {
      const logsRef = collection(db, "prayerLogs");
      const q = query(logsRef, where("User_ID", "==", userId));
      const snap = await getDocs(q);
      const marks: Record<string, any> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const color = dayColor(data.prayers);
        if (color && data.Prayer_Date) {
          marks[data.Prayer_Date] = {
            marked: true,
            dotColor: color,
          };
        }
      });
      setMarkedDates(marks);
    } catch (err) {
      console.error("Failed to load calendar marks:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDayPress = async (day: any) => {
    const dateKey = day.dateString;
    setSelectedDate(dateKey);

    try {
      const logRef = doc(db, "prayerLogs", `${uid}_${dateKey}`);
      const snap = await getDoc(logRef);
      if (snap.exists()) {
        const data = snap.data();
        setSelectedPrayers(data.prayers || {});
      } else {
        setSelectedPrayers(null);
      }
      setModalVisible(true);
    } catch (err) {
      Alert.alert("Error", "Could not load prayer logs for this day.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (!authChecked || loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.cream }]}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }
  if (!uid) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.headerContainer}>
        <AppHeader />
        <Text style={styles.bismillah}>بسم الله الرحمن الرحيم</Text>
        <Text style={styles.greeting}>Assalamualaikum, {fullName}</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.pageTitle}>📅 Prayer History</Text>

      <View style={styles.calendarWrapper}>
        <Calendar
          current={new Date().toISOString().split("T")[0]}
          markedDates={markedDates}
          onDayPress={handleDayPress}
          theme={{
            backgroundColor: COLORS.white,
            calendarBackground: COLORS.white,
            textSectionTitleColor: COLORS.charcoal,
            selectedDayBackgroundColor: COLORS.emerald,
            selectedDayTextColor: COLORS.white,
            todayTextColor: COLORS.gold,
            dayTextColor: COLORS.charcoal,
            textDisabledColor: "#d9e1e8",
            dotColor: COLORS.emerald,
            selectedDotColor: COLORS.white,
            arrowColor: COLORS.emerald,
            monthTextColor: COLORS.charcoal,
            textDayFontWeight: "500",
            textMonthFontWeight: "bold",
            textDayHeaderFontWeight: "600",
            textDayFontSize: 16,
            textMonthFontSize: 18,
          }}
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
            padding: 12,
          }}
        />
      </View>

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.legendText}>On time</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
          <Text style={styles.legendText}>Late</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
          <Text style={styles.legendText}>Missed</Text>
        </View>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }) : ""}
            </Text>

            {selectedPrayers && Object.keys(selectedPrayers).length > 0 ? (
              PRAYERS.map((prayer) => {
                const status = selectedPrayers[prayer];
                let color = COLORS.muted;
                if (status === "Prayed on time") color = COLORS.success;
                else if (status === "Prayed late") color = COLORS.warning;
                else if (status === "Missed") color = COLORS.danger;

                return (
                  <View key={prayer} style={styles.prayerRow}>
                    <Text style={styles.prayerName}>{prayer}</Text>
                    <Text style={[styles.prayerStatus, { color }]}>
                      {status || "Not logged"}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No prayers logged for this day.</Text>
            )}

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    padding: 20,
    paddingTop: 50,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContainer: {
    marginBottom: 20,
  },
  bismillah: {
    fontSize: 22,
    fontFamily: "serif",
    color: COLORS.emerald,
    textAlign: "center",
    marginBottom: 4,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.charcoal,
    textAlign: "center",
  },
  logoutButton: {
    alignSelf: "center",
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },
  logoutText: {
    fontSize: 11,
    color: COLORS.muted,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.emerald,
    textAlign: "center",
    marginBottom: 16,
  },
  calendarWrapper: {
    marginBottom: 16,
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 14,
    color: COLORS.charcoal,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: "85%",
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.emerald,
    textAlign: "center",
    marginBottom: 16,
  },
  prayerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  prayerName: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.charcoal,
  },
  prayerStatus: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    marginVertical: 20,
  },
  modalCloseButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.charcoal,
  },
});