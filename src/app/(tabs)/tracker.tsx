// app/(tabs)/tracker.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from "expo-location";
import { useRootNavigationState, useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
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
import AppHeader from '../../components/appHeader';
import { useClock } from "../../hooks/useClock";

const PRAYERS = ["Subuh", "Zohor", "Asar", "Maghrib", "Isyak"];
const STATUS_OPTIONS = ["Prayed on time", "Prayed late", "Missed"];

// ---- ISLAMIC THEME COLORS ----
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

// ---- HELPERS ----
function localDateKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return localDateKey(new Date());
}

function dayColor(prayers: Record<string, string> | undefined) {
  if (!prayers || Object.keys(prayers).length === 0) return null;
  const values = Object.values(prayers);
  if (values.includes("Missed")) return COLORS.danger;
  if (values.includes("Prayed late")) return COLORS.warning;
  if (PRAYERS.every((p) => prayers[p] === "Prayed on time")) return COLORS.success;
  return COLORS.muted;
}

export default function DashboardScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { now, timeString, dateString } = useClock();

  // ---- Auth State ----
  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");

  // ---- Data State ----
  const [loading, setLoading] = useState(true);
  const [prayerStatus, setPrayerStatus] = useState<Record<string, string>>({});
  const [streak, setStreak] = useState(0);
  const [outstandingQada, setOutstandingQada] = useState(0);
  const [prayerTimes, setPrayerTimes] = useState<Record<string, string>>({});
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [locationError, setLocationError] = useState<string | null>(null);

  // ---- UI State ----
  const [nextPrayer, setNextPrayer] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [greeting, setGreeting] = useState("Assalamualaikum");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});

  // ---- FORCE 1-SECOND RE-RENDER FOR COUNTDOWN ----
  const [currentNow, setCurrentNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ---- AUTH ----
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
    if (!uid) router.replace("/");
  }, [rootNavigationState?.key, authChecked, uid]);

  // ---- FETCH USER ----
  useEffect(() => {
    if (!uid) return;
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) setFullName(userDoc.data().Full_Name || "");
    };
    fetchUser();
  }, [uid]);

  // ---- LOAD DATA ----
  useEffect(() => {
    if (!uid) return;
    loadToday(uid);
    calculateStreak(uid);
    loadCalendarMarks(uid);
    fetchPrayerTimes();
    fetchQadaCount(uid);
  }, [uid]);

  const loadToday = async (userId: string) => {
    const logRef = doc(db, "prayerLogs", `${userId}_${todayKey()}`);
    const snap = await getDoc(logRef);
    setPrayerStatus(snap.exists() ? snap.data().prayers || {} : {});
    setLoading(false);
  };

  const fetchQadaCount = async (userId: string) => {
    const q = query(
      collection(db, "qadaDebts"),
      where("User_ID", "==", userId),
      where("Is_Completed", "==", false)
    );
    const snap = await getDocs(q);
    setOutstandingQada(snap.size);
  };

  // ---- MARK PRAYER ----
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
      if (existing.exists() && existing.data().Source === "auto" && !existing.data().Is_Completed) {
        await deleteDoc(qadaRef);
      }
    }
  };


  const addFeedEntry = async (userId: string, prayerName: string, status: string) => {
  try {
    // Get user's circles
    const memberQuery = query(collection(db, 'circleMembers'), where('User_ID', '==', userId));
    const memberSnap = await getDocs(memberQuery);
    if (memberSnap.empty) return;

    // Get user name
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userName = userDoc.exists() ? userDoc.data().Full_Name || userDoc.data().Username : 'Someone';

    const circleIds = memberSnap.docs.map(doc => doc.data().Circle_ID);
    for (const circleId of circleIds) {
      await addDoc(collection(db, 'feed'), {
        circleId,
        userId,
        userName,
        prayer: prayerName,
        status,
        timestamp: new Date().toISOString(),
        type: status === 'Missed' ? 'missed' : (status === 'Prayed late' ? 'qada' : 'prayer'),
      });
    }
  } catch (err) {
    console.error('Failed to add feed entry:', err);
  }
};

  const markPrayer = async (prayerName: string, status: string) => {
    if (!uid) return;
    const logRef = doc(db, "prayerLogs", `${uid}_${todayKey()}`);
    const updated = { ...prayerStatus, [prayerName]: status };
    await addFeedEntry(uid, prayerName, status);
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
    fetchQadaCount(uid);
  };

  const deleteEntry = async (prayerName: string) => {
    if (!uid) return;
    const logRef = doc(db, "prayerLogs", `${uid}_${todayKey()}`);
    const updated = { ...prayerStatus };
    delete updated[prayerName];
    setPrayerStatus(updated);
    setPickerFor(null);

    try {
      await updateDoc(logRef, { [`prayers.${prayerName}`]: deleteField() });
      const qadaRef = doc(db, "qadaDebts", `${uid}_${todayKey()}_${prayerName}`);
      const existing = await getDoc(qadaRef);
      if (existing.exists() && existing.data().Source === "auto" && !existing.data().Is_Completed) {
        await deleteDoc(qadaRef);
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
    calculateStreak(uid);
    loadCalendarMarks(uid);
    fetchQadaCount(uid);
  };

  const handleQuickLog = async () => {
    if (!nextPrayer) {
      Alert.alert("No prayer", "No upcoming prayer to log.");
      return;
    }
    if (prayerStatus[nextPrayer]) {
      Alert.alert("Already logged", `You already logged ${nextPrayer} today.`);
      return;
    }
    await markPrayer(nextPrayer, "Prayed on time");
  };

  // ---- STREAK ----
  const calculateStreak = async (userId: string) => {
    const logsRef = collection(db, "prayerLogs");
    const q = query(logsRef, where("User_ID", "==", userId), orderBy("Prayer_Date", "desc"));
    const snap = await getDocs(q);

    let count = 0;
    let checkDate = new Date();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const expectedKey = localDateKey(checkDate);
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

  // ---- CALENDAR MARKS ----
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

  // ---- PRAYER TIMES (WAKTUSOLAT) ----
  const fetchPrayerTimes = async () => {
  try {
    // 1. Get location (fallback to KL if permission denied)
    let lat = 3.139;
    let lon = 101.6869;
    let hasRealLocation = false;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const position = await Location.getCurrentPositionAsync({});
      lat = position.coords.latitude;
      lon = position.coords.longitude;
      hasRealLocation = true;
    } else {
      setLocationError('Location permission denied — showing times for Kuala Lumpur.');
    }

    // 2. Get today's date in DD-MM-YYYY format (Aladhan expects)
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

    // 3. Fetch from Aladhan API (CORS-friendly)
    const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=2`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const json = await response.json();
    const timings = json.data.timings;

    // Map Aladhan names to your app's names
    const prayerTimesMap: Record<string, string> = {
      Subuh: timings.Fajr,
      Zohor: timings.Dhuhr,
      Asar: timings.Asr,
      Maghrib: timings.Maghrib,
      Isyak: timings.Isha,
    };

    setPrayerTimes(prayerTimesMap);

    // 4. Set location label
    if (hasRealLocation) {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (places.length > 0) {
        const place = places[0];
        const label = [place.district || place.subregion, place.region].filter(Boolean).join(', ');
        setLocationLabel(label || '');
      }
    } else {
      setLocationLabel('Kuala Lumpur (default)');
    }
  } catch (err) {
    console.error('Prayer times fetch error:', err);
    setLocationError('Could not fetch prayer times. Using fallback times for Kuala Lumpur.');

    // 5. Fallback: set static times for Kuala Lumpur (approximate)
    // These are for demonstration; you can adjust them.
    const fallbackTimes = {
      Subuh: '05:55',
      Zohor: '13:21',
      Asar: '16:45',
      Maghrib: '19:29',
      Isyak: '20:44',
    };
    setPrayerTimes(fallbackTimes);
    setLocationLabel('Kuala Lumpur (fallback)');
  }
};

  // ---- COUNTDOWN LOGIC (NOW WITH SECONDS) ----
useEffect(() => {
  if (Object.keys(prayerTimes).length === 0) return;

  const sorted = PRAYERS.map((p) => ({
    name: p,
    time: prayerTimes[p],
  })).filter((p) => p.time);

  // Calculate current time in total seconds (HOURS * 3600 + MINUTES * 60 + SECONDS)
  const nowSeconds =
    currentNow.getHours() * 3600 +
    currentNow.getMinutes() * 60 +
    currentNow.getSeconds();

  let next: string | null = null;
  let minDiffSec = Infinity;

  for (const p of sorted) {
    const [h, m] = p.time.split(":").map(Number);
    const prayerSeconds = h * 3600 + m * 60; // assume HH:MM, seconds are 00

    let diff = prayerSeconds - nowSeconds;
    if (diff < 0) diff += 86400; // 24 hours in seconds

    if (diff < minDiffSec) {
      minDiffSec = diff;
      next = p.name;
    }
  }

  setNextPrayer(next);
  setTimeRemaining(minDiffSec);
}, [currentNow, prayerTimes]);

  // ---- GREETING ----
  useEffect(() => {
    const hour = currentNow.getHours();
    if (hour < 12) setGreeting("Sabah al-Khair");
    else setGreeting("Masa' al-Khair");
  }, [currentNow]);

  // ---- LOGOUT ----
 const handleLogout = async () => {
  await AsyncStorage.removeItem('rememberMe');
  await AsyncStorage.removeItem('savedUsername');
  await signOut(auth);
  router.replace("/");
};

  // ---- LOADING ----
  if (!authChecked || loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.cream }]}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }
  if (!uid) return null;

  // ---- HELPERS ----
  const formatTime = (seconds: number) => {
    if (seconds < 0) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const isPrayerTimeReached = (prayer: string) => {
    const timeStr = prayerTimes[prayer];
    if (!timeStr) return true;
    const [h, m] = timeStr.split(":").map(Number);
    const prayerDateTime = new Date(currentNow);
    prayerDateTime.setHours(h, m, 0, 0);
    return currentNow >= prayerDateTime;
  };

  // ---- RENDER ----
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader />
      {/* 1. BISMILLAH & GREETING */}
      <View style={styles.headerContainer}>
        <Text style={styles.bismillah}>بسم الله الرحمن الرحيم</Text>
        <Text style={styles.greeting}>
          {greeting}, {fullName || "Beloved"}
        </Text>
        {locationLabel ? (
          <Text style={styles.location}>{locationLabel}</Text>
        ) : null}
        {locationError ? (
          <Text style={styles.locationError}>{locationError}</Text>
        ) : null}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* 2. HERO COUNTDOWN CARD */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>NEXT PRAYER</Text>
        {nextPrayer ? (
          <>
            <Text style={styles.heroPrayerName}>{nextPrayer}</Text>
            <Text style={styles.heroCountdown}>{formatTime(timeRemaining)}</Text>
            <Text style={styles.heroTime}>Starts at {prayerTimes[nextPrayer] || "--:--"}</Text>
          </>
        ) : (
          <Text style={styles.heroPlaceholder}>Loading times...</Text>
        )}
      </View>

      {/* 3. QUICK LOG FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleQuickLog}>
        <Text style={styles.fabText}>
          {nextPrayer ? `Log ${nextPrayer} Now` : "Log Prayer"}
        </Text>
      </TouchableOpacity>

      {/* 4. HORIZONTAL PRAYER CHIPS with status icons */}
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={styles.chipsContainer}
  contentContainerStyle={styles.chipsContent}
>
  {PRAYERS.map((prayer) => {
    const status = prayerStatus[prayer];
    const isPast = status && status !== "Missed";
    const isCurrent = !status && prayer === nextPrayer;
    const isFuture = !status && prayer !== nextPrayer;
    const isLocked = !isPrayerTimeReached(prayer);

    let chipStyle = styles.chipFuture;
    let textStyle = styles.chipTextFuture;
    let iconName: string | null = null;
    let iconColor = COLORS.charcoal;

    if (status === "Prayed on time") {
      chipStyle = styles.chipOnTime;
      textStyle = styles.chipTextOnTime;
      iconName = "checkmark-circle";
      iconColor = COLORS.white;
    } else if (status === "Prayed late") {
      chipStyle = styles.chipLate;
      textStyle = styles.chipTextLate;
      iconName = "time-outline";
      iconColor = COLORS.charcoal;
    } else if (status === "Missed") {
      chipStyle = styles.chipMissed;
      textStyle = styles.chipTextMissed;
      iconName = "close-circle";
      iconColor = COLORS.white;
    } else if (isCurrent) {
      chipStyle = styles.chipCurrent;
      textStyle = styles.chipTextCurrent;
      iconName = null; // No icon for current
    } else if (isLocked && isFuture) {
      chipStyle = styles.chipLocked;
      textStyle = styles.chipTextLocked;
      iconName = null;
    }

    return (
      <TouchableOpacity
        key={prayer}
        style={[styles.chip, chipStyle]}
        onPress={() => {
          if (isLocked && !isPast) {
            Alert.alert(
              "Not yet time",
              `${prayer} time arrives at ${prayerTimes[prayer]}.`
            );
            return;
          }
          setPickerFor(prayer);
        }}
      >
        <View style={styles.chipContent}>
          {iconName && (
              <Ionicons 
                name={iconName as any} 
                size={16} 
                color={iconColor} 
                style={styles.chipIcon} 
              />
            )}
          <Text style={[styles.chipText, textStyle]}>
            {prayer} {prayerTimes[prayer] ? prayerTimes[prayer] : "--:--"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  })}
</ScrollView>

      {/* 5. DUAL CARDS: QADA & STREAK */}
      <View style={styles.dualContainer}>
        <View style={[styles.dualCard, styles.qadaCard]}>
          <Text style={styles.dualCardEmoji}>🕌</Text>
          <Text style={styles.dualCardTitle}>Qada</Text>
          <Text style={styles.dualCardValue}>{outstandingQada}</Text>
          <Text style={styles.dualCardSub}>awaiting</Text>
          {outstandingQada > 0 && (
            <TouchableOpacity
              style={styles.dualButton}
              onPress={() => router.push("/(tabs)/qada")}
            >
              <Text style={styles.dualButtonText}>Clear Now</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.dualCard, styles.streakCard]}>
          <Text style={styles.dualCardEmoji}>🔥</Text>
          <Text style={styles.dualCardTitle}>Streak</Text>
          <Text style={styles.dualCardValue}>{streak}</Text>
          <Text style={styles.dualCardSub}>days</Text>
          <View style={styles.graceBadge}>
            <Text style={styles.graceText}>🛡️ Grace active</Text>
          </View>
        </View>
      </View>

      {/* 6. STATUS PICKER MODAL */}
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
    </ScrollView>
  );
}

// ---- STYLES ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContainer: {
    marginBottom: 24,
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
  location: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 2,
  },
  locationError: {
    fontSize: 11,
    color: COLORS.warning,
    textAlign: "center",
    marginTop: 2,
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
  heroCard: {
    backgroundColor: COLORS.emerald,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  heroLabel: {
    fontSize: 12,
    color: COLORS.goldLight,
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 6,
  },
  heroPrayerName: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 4,
  },
  heroCountdown: {
    fontSize: 42,
    fontWeight: "bold",
    color: COLORS.gold,
    fontVariant: ["tabular-nums"],
    marginVertical: 4,
  },
  heroTime: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8,
  },
  heroPlaceholder: {
    color: COLORS.white,
    fontSize: 16,
  },
  fab: {
    backgroundColor: COLORS.gold,
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  fabText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.charcoal,
  },
  chipContent: {
  flexDirection: 'row',
  alignItems: 'center',
},
chipIcon: {
  marginRight: 4,
},
// Status-specific chips
chipOnTime: {
  backgroundColor: COLORS.success,
  borderColor: COLORS.success,
},
chipTextOnTime: {
  color: COLORS.white,
},
chipLate: {
  backgroundColor: COLORS.warning,
  borderColor: COLORS.warning,
},
chipTextLate: {
  color: COLORS.charcoal,
},
chipMissed: {
  backgroundColor: COLORS.danger,
  borderColor: COLORS.danger,
},
chipTextMissed: {
  color: COLORS.white,
},
// Keep existing current/future/locked styles...
chipCurrent: {
  backgroundColor: COLORS.gold,
  borderColor: COLORS.gold,
},
chipFuture: {
  backgroundColor: COLORS.white,
  borderColor: COLORS.border,
},
chipLocked: {
  backgroundColor: "#E8E4DC",
  borderColor: "#D0CBC0",
  opacity: 0.6,
},
chipTextCurrent: {
  color: COLORS.charcoal,
},
chipTextFuture: {
  color: COLORS.charcoal,
},
chipTextLocked: {
  color: COLORS.muted,
},
  chipsContainer: {
    marginBottom: 24,
    width: "100%",
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipPast: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextPast: {
    color: COLORS.white,
  },

  dualContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  dualCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qadaCard: {
    borderTopColor: COLORS.warning,
    borderTopWidth: 3,
  },
  streakCard: {
    borderTopColor: COLORS.success,
    borderTopWidth: 3,
  },
  dualCardEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  dualCardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dualCardValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.charcoal,
    marginVertical: 2,
  },
  dualCardSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 8,
  },
  dualButton: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dualButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.charcoal,
  },
  graceBadge: {
    backgroundColor: COLORS.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
  },
  graceText: {
    fontSize: 10,
    color: COLORS.warning,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.charcoal,
    textAlign: "center",
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalOptionText: {
    fontSize: 16,
    color: COLORS.charcoal,
    textAlign: "center",
  },
  modalDelete: {
    paddingVertical: 14,
    marginTop: 4,
  },
  modalDeleteText: {
    fontSize: 16,
    color: COLORS.danger,
    textAlign: "center",
    fontWeight: "600",
  },
  modalCancel: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 12,
    fontWeight: "600",
  },
});