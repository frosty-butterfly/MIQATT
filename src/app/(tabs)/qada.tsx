// app/(tabs)/qada.tsx
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Calendar } from "react-native-calendars";
import { auth, db } from "../../../firebaseConfig";
import Header from "../../components/header";
import { useClock } from "../../hooks/useClock";

const PRAYERS = ["Subuh", "Zohor", "Asar", "Maghrib", "Isyak"];

type QadaEntry = {
  id: string;
  Prayer_Name: string;
  Original_Date: string;
  Is_Completed: boolean;
  Completed_At: string | null;
};

function dayColor(prayers: Record<string, string> | undefined) {
  if (!prayers || Object.keys(prayers).length === 0) return null;
  const values = Object.values(prayers);
  if (values.includes("Missed")) return "#ef4444";
  if (values.includes("Prayed late")) return "#f59e0b";
  if (PRAYERS.every((p) => prayers[p] === "Prayed on time")) return "#22c55e";
  return "#6b7280";
}

export default function QadaScreen() {
  const router = useRouter();
  const { timeString, dateString } = useClock();

  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [fullName, setFullName] = useState("");

  const [entries, setEntries] = useState<QadaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedPrayer, setSelectedPrayer] = useState(PRAYERS[0]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});


  // ---------- Auth ----------
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsubscribeAuth;
  }, []);

  // ---------- Fetch user name ----------
  useEffect(() => {
    if (!uid) return;
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) setFullName(userDoc.data().Full_Name);
    };
    fetchUser();
  }, [uid]);

  // ---------- Snapshot for qada entries ----------
  useEffect(() => {
    if (!uid) {
      if (authChecked) setLoading(false);
      return;
    }
    const q = query(
      collection(db, "qadaDebts"),
      where("User_ID", "==", uid),
      orderBy("Original_Date", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<QadaEntry, "id">),
      }));
      setEntries(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid, authChecked]);

  const outstandingCount = entries.filter((e) => !e.Is_Completed).length;

  // ---------- Load calendar marks ----------
useEffect(() => {
  if (!uid) return;
  loadCalendarMarks(uid);
}, [uid]);

  // ---------- Calendar marks ----------
    const loadCalendarMarks = async (userId: string) => {
      const logsRef = collection(db, "prayerLogs");
      const q = query(logsRef, where("User_ID", "==", userId));
      const snap = await getDocs(q);
  
      const marks: Record<string, any> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const color = dayColor(data.prayers);
        if (color && data.Prayer_Date) {
          marks[data.Prayer_Date] = { marked: true, dotColor: color };
        }
      });
      setMarkedDates(marks);
    };

  // ---------- CRUD operations ----------
  const addEntry = async () => {
  if (!uid) {
    Alert.alert("Not signed in", "Please log in again before adding an entry.");
    return;
  }
  if (!selectedDate) {
    Alert.alert("Missing date", "Please select the original date.");
    return;
  }

  const entryId = `${uid}_${selectedDate}_${selectedPrayer}`;
  const entryRef = doc(db, "qadaDebts", entryId);

  try {
    const existing = await getDoc(entryRef);
    if (existing.exists()) {
      Alert.alert(
        "Already logged",
        `You've already logged a missed ${selectedPrayer} for ${selectedDate}.`
      );
      return;
    }

    await setDoc(entryRef, {
      User_ID: uid,
      Prayer_Name: selectedPrayer,
      Original_Date: selectedDate,
      Is_Completed: false,
      Completed_At: null,
      Source: "manual",
    });
    setAddModalVisible(false);
  } catch (err: any) {
    console.error("Failed to add qada entry:", err);
    Alert.alert("Error", err.message ?? "Could not save this entry. Please try again.");
  }
};

  const markDone = async (id: string) => {
  try {
    await updateDoc(doc(db, "qadaDebts", id), {
      Is_Completed: true,
      Completed_At: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to mark done:", err);
    Alert.alert("Error", "Could not update this entry.");
  }
};

const removeEntry = async (id: string) => {
  try {
    await deleteDoc(doc(db, "qadaDebts", id));
  } catch (err) {
    console.error("Failed to remove entry:", err);
    Alert.alert("Error", "Could not delete this entry.");
  }
};

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  // ---------- Loading ----------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" />
      </View>
    );
  }

  // ---------- Render ----------
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Shared Header (without calendar) */}
      <Header
      fullName={fullName}
      onLogout={handleLogout}
      locationLabel={undefined}
      timeString={timeString}
      dateString={dateString}
      markedDates={markedDates}
    />

      <Text style={styles.title}>Qada Ledger</Text>

      <View style={styles.outstandingCard}>
        <Text style={styles.outstandingLabel}>Outstanding Qada</Text>
        <Text style={styles.outstandingValue}>{outstandingCount} prayers</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.entryRow}>
            <View>
              <Text style={styles.entryName}>{item.Prayer_Name}</Text>
              <Text style={styles.entryDate}>{item.Original_Date}</Text>
            </View>
            {item.Is_Completed ? (
              <TouchableOpacity onPress={() => removeEntry(item.id)}>
                <Text style={styles.completedText}>Completed ✓</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.doneButton} onPress={() => markDone(item.id)}>
                <Text style={styles.doneButtonText}>Mark Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No qada entries yet — you're all caught up.</Text>
        }
        scrollEnabled={false} // let ScrollView handle scrolling
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setAddModalVisible(true)}>
        <Text style={styles.addButtonText}>+ Add Missed Prayer</Text>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Missed Prayer</Text>

            <Text style={styles.modalLabel}>Prayer</Text>
            <View style={styles.prayerPicker}>
              {PRAYERS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.prayerChip,
                    selectedPrayer === p && styles.prayerChipActive,
                  ]}
                  onPress={() => setSelectedPrayer(p)}
                >
                  <Text
                    style={
                      selectedPrayer === p ? styles.prayerChipTextActive : styles.prayerChipText
                    }
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Original Date</Text>
            <Calendar current={selectedDate}
              onDayPress={(day: any) => setSelectedDate(day.dateString)}
              maxDate={new Date().toISOString().split("T")[0]}
              markedDates={{
                [selectedDate]: { selected: true, selectedColor: "#22c55e" },
              }}
              theme={{
                backgroundColor: "#0f1115",
                calendarBackground: "#0f1115",
                textSectionTitleColor: "#9ca3af",
                dayTextColor: "#fff",
                monthTextColor: "#fff",
                todayTextColor: "#22c55e",
                arrowColor: "#22c55e",
                selectedDayBackgroundColor: "#22c55e",
                selectedDayTextColor: "#0f1115",
              }}
              style={{ borderRadius: 8, marginBottom: 16 }}
            />

            <TouchableOpacity style={styles.modalSaveButton} onPress={addEntry}>
            <Text style={styles.addButtonText}>Save Entry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCancelButton} onPress={() => setAddModalVisible(false)}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115", padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#0f1115", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  outstandingCard: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalSaveButton: {
  backgroundColor: "#1a3d2a",
  borderRadius: 8,
  padding: 14,
  alignItems: "center",
  marginTop: 8,
},
modalCancelButton: {
  marginTop: 14,
  alignItems: "center",
},
  outstandingLabel: { color: "#9ca3af" },
  outstandingValue: { color: "#f59e0b", fontWeight: "bold", fontSize: 16 },
  entryRow: {
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  entryDate: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  doneButton: { backgroundColor: "#22c55e", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  doneButtonText: { color: "#0f1115", fontWeight: "bold", fontSize: 12 },
  completedText: { color: "#22c55e", fontWeight: "bold", fontSize: 13 },
  emptyText: { color: "#6b7280", textAlign: "center", marginTop: 40 },
  addButton: {
    backgroundColor: "#1a3d2a",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
  },
  addButtonText: { color: "#22c55e", fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#1a1d23", borderRadius: 12, padding: 20, width: "85%" },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginBottom: 16 },
  modalLabel: { color: "#9ca3af", fontSize: 12, marginBottom: 8 },
  prayerPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  prayerChip: { borderWidth: 1, borderColor: "#2a2e37", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  prayerChipActive: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  prayerChipText: { color: "#9ca3af", fontSize: 12 },
  prayerChipTextActive: { color: "#0f1115", fontSize: 12, fontWeight: "bold" },
  input: {
    backgroundColor: "#0f1115",
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 8,
    padding: 10,
    color: "#fff",
    marginBottom: 16,
  },
  modalCancel: { color: "#6b7280", marginTop: 12, textAlign: "center" },
});