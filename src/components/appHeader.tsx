// components/AppHeader.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

const COLORS = {
  cream: "#F8F4EC",
  emerald: "#1E4D3A",
  gold: "#D4AF37",
  charcoal: "#2C2C2C",
  white: "#FFFFFF",
  muted: "#A0A0A0",
};

export default function AppHeader() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.Username || "User");
        }
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  const handlePress = () => {
    router.push("/(tabs)/profile");
  };

  if (!user) return null;

  const firstLetter = username.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Ionicons name="moon-outline" size={20} color={COLORS.emerald} />
        <Text style={styles.appName}>MIQAT</Text>
      </View>
      <TouchableOpacity style={styles.right} onPress={handlePress}>
        <Text style={styles.username}>{username}</Text>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{firstLetter}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.cream,
    borderBottomWidth: 1,
    borderBottomColor: "#E2DCD0",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  appName: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.emerald,
    marginLeft: 8,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
  },
  username: {
    fontSize: 14,
    color: COLORS.charcoal,
    marginRight: 8,
    fontWeight: "500",
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.emerald,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 16,
  },
});