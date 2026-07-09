// app/(tabs)/tracker.tsx
import * as Location from "expo-location";
import { useRootNavigationState, useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../../firebaseConfig";
import Header from "../../components/header";
import { useClock } from "../../hooks/useClock";

const PRAYERS = ["Subuh", "Zohor", "Asar", "Maghrib", "Isyak"];
const STATUS_OPTIONS = ["Prayed on time", "Prayed late", "Missed"];

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function dayColor(prayers: Record<string, string> | undefined) {
  if (!prayers || Object.keys(prayers).length === 0) return null;
  const values = Object.values(prayers);
  if (values.includes("Missed")) return "#ef4444";
  if (values.includes("Prayed late")) return "#f59e0b";
  if (PRAYERS.every((p) => prayers[p] === "Prayed on time")) return "#22c55e";
  return "#6b7280";
}

export default function TrackerScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [prayerStatus, setPrayerStatus] = useState<Record<string, string>>({});
  const [streak, setStreak] = useState(0);
  const [fullName, setFullName] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  const [calendarVisible, setCalendarVisible] = useState(false);

  const [prayerTimes, setPrayerTimes] = useState<Record<string, string>>({});
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [locationError, setLocationError] = useState<string | null>(null);

  // Get live clock data
  const { now, timeString, dateString } = useClock();

  // ---------- Authentication ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (!authChecked) return;
    if (!uid) {
      router.replace("/");
    }
  }, [rootNavigationState?.key, authChecked, uid]);

  // ---------- Data loading ----------
  useEffect(() => {
    if (!uid) return;
    loadToday(uid);
    loadUserName(uid);
    calculateStreak(uid);
    loadCalendarMarks(uid);
    fetchPrayerTimes();
  }, [uid]);

  const loadUserName = async (userId: string) => {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) setFullName(userDoc.data().Full_Name);
  };

  const loadToday = async (userId: string) => {
    const logRef = doc(db, "prayerLogs", `${userId}_${todayKey()}`);
    const snap = await getDoc(logRef);
    setPrayerStatus(snap.exists() ? snap.data().prayers || {} : {});
    setLoading(false);
  };

  // ---------- Qada sync ----------
  const syncQadaLink = async (userId: string, prayerName: string, status: string) => {
    const qadaRef = doc(db, "qadaDebts", `${userId}_${todayKey()}_${prayerName}`);

    if (status === "Missed") {
      await setDoc(qadaRef, {
        User_ID: userId,
        Prayer_Name: prayerName,
        Original_Date: todayKey(),
        Is_Completed: false,
        Completed_At: null,
        Source: "auto",
      });
    } else {
      const existing = await getDoc(qadaRef);
      if (
        existing.exists() &&
        existing.data().Source === "auto" &&
        !existing.data().Is_Completed
      ) {
        await deleteDoc(qadaRef);
      }
    }
  };

  const markPrayer = async (prayerName: string, status: string) => {
    if (!uid) return;
    const logRef = doc(db, "prayerLogs", `${uid}_${todayKey()}`);
    const updated = { ...prayerStatus, [prayerName]: status };
    setPrayerStatus(updated);
    setPickerFor(null);

    await setDoc(
      logRef,
      {
        User_ID: uid,
        Prayer_Date: todayKey(),
        prayers: updated,
        Logged_At: new Date().toISOString(),
      },
      { merge: true }
    );

    await syncQadaLink(uid, prayerName, status);

    calculateStreak(uid);
    loadCalendarMarks(uid);
  };

  const deleteEntry = async (prayerName: string) => {
    if (!uid) return;
    const logRef = doc(db, "prayerLogs", `${uid}_${todayKey()}`);
    const updated = { ...prayerStatus };
    delete updated[prayerName];
    setPrayerStatus(updated);
    setPickerFor(null);

    try {
      await updateDoc(logRef, {
        [`prayers.${prayerName}`]: deleteField(),
      });

      const qadaRef = doc(db, "qadaDebts", `${uid}_${todayKey()}_${prayerName}`);
      const existing = await getDoc(qadaRef);
      if (
        existing.exists() &&
        existing.data().Source === "auto" &&
        !existing.data().Is_Completed
      ) {
        await deleteDoc(qadaRef);
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }

    calculateStreak(uid);
    loadCalendarMarks(uid);
  };

  // ---------- Streak ----------
  const calculateStreak = async (userId: string) => {
    const logsRef = collection(db, "prayerLogs");
    const q = query(
      logsRef,
      where("User_ID", "==", userId),
      orderBy("Prayer_Date", "desc")
    );
    const snap = await getDocs(q);

    let count = 0;
    let checkDate = new Date();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const expectedKey = checkDate.toISOString().split("T")[0];
      if (data.Prayer_Date !== expectedKey) break;

      const prayers = data.prayers || {};
      const allDone = PRAYERS.every((p) => prayers[p] && prayers[p] !== "Missed");
      if (!allDone) break;

      count++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
    setStreak(count);
    await setDoc(doc(db, "users", userId), { Current_Streak: count }, { merge: true });
  };
  

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

  

  // ---------- Prayer times ----------
  const fetchPrayerTimes = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 3.139;
      let lon = 101.6869;
      let hasRealLocation = false;

      if (status === "granted") {
        const position = await Location.getCurrentPositionAsync({});
        lat = position.coords.latitude;
        lon = position.coords.longitude;
        hasRealLocation = true;
      } else {
        setLocationError("Location permission denied — showing times for Kuala Lumpur.");
      }

      const solatRes = await fetch(
        `https://api.waktusolat.app/v2/solat/gps/${lat}/${lon}`
      );
      if (!solatRes.ok) throw new Error(`Prayer time API returned ${solatRes.status}`);
      const solatJson = await solatRes.json();

      const todayNum = new Date().getDate();
      const todayEntry = solatJson?.prayers?.find((p: any) => p.day === todayNum);

      if (todayEntry) {
        const fmt = (epochSeconds: number) =>
          new Date(epochSeconds * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

        setPrayerTimes({
          Subuh: fmt(todayEntry.fajr),
          Zohor: fmt(todayEntry.dhuhr),
          Asar: fmt(todayEntry.asr),
          Maghrib: fmt(todayEntry.maghrib),
          Isyak: fmt(todayEntry.isha),
        });
      } else {
        setLocationError("Prayer times unavailable for today — try again later.");
      }

      if (hasRealLocation) {
        const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (places.length > 0) {
          const place = places[0];
          const label = [place.district || place.subregion, place.region]
            .filter(Boolean)
            .join(", ");
          setLocationLabel(label || solatJson.zone || "");
        } else {
          setLocationLabel(solatJson.zone || "");
        }
      } else {
        setLocationLabel(solatJson.zone ? `Zone ${solatJson.zone}` : "");
      }
    } catch (err) {
      setLocationError("Could not fetch prayer times right now.");
    }
  };

  const isPrayerTimeReached = (prayer: string) => {
    const timeStr = prayerTimes[prayer];
    if (!timeStr) return true;
    const [hourStr, minuteStr] = timeStr.split(":");
    const prayerDateTime = new Date();
    prayerDateTime.setHours(parseInt(hourStr, 10), parseInt(minuteStr, 10), 0, 0);
    return now >= prayerDateTime; // now from useClock
  };

  // ---------- Logout ----------
  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  // ---------- Loading states ----------
  if (!authChecked || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" />
      </View>
    );
  }

  if (!uid) return null;

  // ---------- Render ----------
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Shared Header */}
      <Header
          fullName={fullName}
          onLogout={handleLogout}
          locationLabel={locationLabel}
          timeString={timeString}
          dateString={dateString}
          markedDates={markedDates}
        />

      {/* Streak Card */}
      <View style={styles.streakCard}>
        <Text style={styles.streakLabel}>Current Streak</Text>
        <Text style={styles.streakValue}>{streak} days</Text>
      </View>

      {locationError && <Text style={styles.warningText}>{locationError}</Text>}

      {/* Prayer rows */}
      {PRAYERS.map((prayer) => {
        const status = prayerStatus[prayer];
        const timeReached = isPrayerTimeReached(prayer);
        return (
          <TouchableOpacity
            key={prayer}
            style={[styles.prayerRow, !timeReached && styles.prayerRowLocked]}
            onPress={() => {
              if (!timeReached) {
                Alert.alert(
                  "Not yet time",
                  `${prayer} time hasn't arrived yet. You can log it starting at ${prayerTimes[prayer]}.`
                );
                return;
              }
              setPickerFor(prayer);
            }}
          >
            <View>
              <Text style={styles.prayerName}>{prayer}</Text>
              <Text style={styles.prayerTime}>{prayerTimes[prayer] ?? "--:--"}</Text>
            </View>
            <Text
              style={
                status ? styles.statusDone : timeReached ? styles.statusPending : styles.statusLocked
              }
            >
              {status ? `${status} ✓` : timeReached ? "Pending" : "Locked"}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Status Picker Modal */}
      <Modal visible={!!pickerFor} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{pickerFor}</Text>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.modalOption}
                onPress={() => markPrayer(pickerFor!, opt)}
              >
                <Text style={styles.modalOptionText}>{opt}</Text>
              </TouchableOpacity>
            ))}
            {pickerFor && prayerStatus[pickerFor] && (
              <TouchableOpacity style={styles.modalDelete} onPress={() => deleteEntry(pickerFor)}>
                <Text style={styles.modalDeleteText}>Delete Entry</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setPickerFor(null)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Calendar Modal (managed by Header, but we still have it here? 
          Actually Header already has its own calendar modal, but Tracker used to have one too.
          We removed it because Header now provides the calendar modal. 
          So we delete this calendar modal below. */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115", padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#0f1115", alignItems: "center", justifyContent: "center" },
  streakCard: {
    borderWidth: 1,
    borderColor: "#22c55e",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakLabel: { color: "#9ca3af" },
  streakValue: { color: "#22c55e", fontSize: 20, fontWeight: "bold" },
  warningText: { color: "#f59e0b", fontSize: 12, marginBottom: 12, textAlign: "center" },
  prayerRow: {
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  prayerRowLocked: { opacity: 0.5 },
  prayerName: { color: "#fff", fontSize: 15 },
  prayerTime: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  statusDone: { color: "#22c55e", fontWeight: "bold" },
  statusPending: { color: "#6b7280" },
  statusLocked: { color: "#4b5563", fontStyle: "italic", fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#1a1d23", borderRadius: 12, padding: 20, width: "80%" },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  modalOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#2a2e37" },
  modalOptionText: { color: "#fff" },
  modalDelete: { paddingVertical: 12 },
  modalDeleteText: { color: "#f87171" },
  modalCancel: { color: "#6b7280", marginTop: 12, textAlign: "center" },
});