// app/(tabs)/streak.tsx
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
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
const COLORS = {
  cream: "#F8F4EC",
  emerald: "#1E4D3A",
  gold: "#D4AF37",
  charcoal: "#2C2C2C",
  white: "#FFFFFF",
  muted: "#A0A0A0",
  border: "#E2DCD0",
  success: "#2E7D32",
  warning: "#B76E00",
  danger: "#B71C1C",
};

function localDateKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function StreakScreen() {
  const router = useRouter();
  const { timeString, dateString } = useClock();
  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [fullName, setFullName] = useState("");
  const [streak, setStreak] = useState(0);
  const [recentDays, setRecentDays] = useState<
    { date: string; status: "complete" | "partial" | "missed" | "pending" }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Auth
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
    loadStreakData(uid);
  }, [uid]);

  const loadStreakData = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch last 14 days of logs
      const logsRef = collection(db, "prayerLogs");
      const q = query(
        logsRef,
        where("User_ID", "==", userId),
        orderBy("Prayer_Date", "desc")
      );
      const snap = await getDocs(q);

      // Calculate streak
      let streakCount = 0;
      let checkDate = new Date();
      const daysData: {
        date: string;
        status: "complete" | "partial" | "missed" | "pending";
      }[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const expectedKey = localDateKey(checkDate);
        if (data.Prayer_Date !== expectedKey) break;

        const prayers = data.prayers || {};
        const allDone = PRAYERS.every((p) => prayers[p] && prayers[p] !== "Missed");
        const anyLogged = Object.keys(prayers).length > 0;

        if (!anyLogged || !allDone) break;

        streakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
      setStreak(streakCount);

      // Build recent 7 days summary
      const today = new Date();
      const recent: typeof daysData = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = localDateKey(d);
        const found = snap.docs.find((doc) => doc.data().Prayer_Date === key);
        if (found) {
          const prayers = found.data().prayers || {};
          const allDone = PRAYERS.every((p) => prayers[p] && prayers[p] !== "Missed");
          const anyLogged = Object.keys(prayers).length > 0;
          if (allDone && anyLogged) {
            recent.push({ date: key, status: "complete" });
          } else if (anyLogged) {
            recent.push({ date: key, status: "partial" });
          } else {
            recent.push({ date: key, status: "missed" });
          }
        } else {
          recent.push({ date: key, status: "pending" });
        }
      }
      setRecentDays(recent);
    } catch (err) {
      console.error("Failed to load streak:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (!authChecked || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }
  if (!uid) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case "complete":
        return "✅";
      case "partial":
        return "🟡";
      case "missed":
        return "❌";
      default:
        return "⬜";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return COLORS.success;
      case "partial":
        return COLORS.warning;
      case "missed":
        return COLORS.danger;
      default:
        return COLORS.muted;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <AppHeader />
        <Text style={styles.bismillah}>بسم الله الرحمن الرحيم</Text>
        <Text style={styles.greeting}>Assalamualaikum, {fullName}</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Streak Hero */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>🔥 CURRENT STREAK</Text>
        <Text style={styles.heroValue}>{streak}</Text>
        <Text style={styles.heroSub}>days</Text>
        <View style={styles.graceBadge}>
          <Text style={styles.graceText}>🛡️ Grace Shield Active</Text>
        </View>
      </View>

      {/* Recent Days List */}
      <Text style={styles.sectionTitle}>📅 Recent Days</Text>
      {recentDays.slice(0, 14).map((day, index) => (
        <View key={index} style={styles.dayRow}>
          <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
          <View style={[styles.dayStatus, { backgroundColor: getStatusColor(day.status) + "20" }]}>
            <Text style={[styles.dayStatusText, { color: getStatusColor(day.status) }]}>
              {getStatusEmoji(day.status)} {day.status.toUpperCase()}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: COLORS.cream,
  paddingHorizontal: 20,
  paddingTop: 0,
},
  center: {
    flex: 1,
    backgroundColor: COLORS.cream,
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
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  heroLabel: {
    fontSize: 14,
    color: COLORS.gold,
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 64,
    fontWeight: "bold",
    color: COLORS.white,
  },
  heroSub: {
    fontSize: 18,
    color: COLORS.white,
    opacity: 0.8,
    marginBottom: 8,
  },
  graceBadge: {
    backgroundColor: COLORS.gold + "40",
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
  },
  graceText: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.charcoal,
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayDate: {
    fontSize: 14,
    color: COLORS.charcoal,
    fontWeight: "500",
  },
  dayStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  dayStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
});