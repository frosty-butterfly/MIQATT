// app/(tabs)/about.tsx
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../../../firebaseConfig";
import Header from "../../components/header";
import { useClock } from "../../hooks/useClock";

export default function AboutScreen() {
  const router = useRouter();
  const { timeString, dateString } = useClock();

  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");

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
      if (userDoc.exists()) setFullName(userDoc.data().Full_Name);
    };
    fetchUser();
  }, [uid]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (!authChecked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" />
      </View>
    );
  }
  if (!uid) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Header
        fullName={fullName}
        onLogout={handleLogout}
        locationLabel={undefined}
        timeString={timeString}
        dateString={dateString}
        // markedDates not needed for About
      />
      <Text style={styles.title}>About MIQAT</Text>
      <View style={styles.card}>
        <Text style={styles.text}>
          MIQAT is your prayer companion – track your daily prayers, manage missed (qada) prayers,
          and stay connected with your circle.
        </Text>
        <Text style={styles.text}>
          • Log prayers on time, late, or missed{'\n'}
          • View your streak and calendar history{'\n'}
          • Join circles and encourage friends{'\n'}
          • Keep your qada ledger up to date
        </Text>
        <Text style={styles.version}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115", padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#0f1115", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  card: {
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  text: { color: "#9ca3af", fontSize: 14, lineHeight: 22, marginBottom: 12 },
  version: { color: "#6b7280", fontSize: 12, textAlign: "center", marginTop: 8 },
});