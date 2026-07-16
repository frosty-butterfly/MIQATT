// app/index.tsx
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert, StyleSheet, Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from "../../firebaseConfig";

const COLORS = {
  cream: "#F8F4EC",
  emerald: "#1E4D3A",
  gold: "#D4AF37",
  goldLight: "#F3E5AB",
  charcoal: "#2C2C2C",
  white: "#FFFFFF",
  muted: "#A0A0A0",
  border: "#E2DCD0",
};

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check auth state and "Remember Me" on app start
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in – check if "Remember Me" is true
        const savedPreference = await AsyncStorage.getItem('rememberMe');
        if (savedPreference === 'true') {
          // Auto-login: go to main screen
          router.replace("/(tabs)/tracker");
        } else {
          // "Remember Me" is false – sign out and stay on login
          await signOut(auth);
          setCheckingAuth(false);
        }
      } else {
        // No user – stay on login
        setCheckingAuth(false);
      }
    });
    return unsubscribe;
  }, []);

  // Load saved username if "Remember Me" was checked before
  useEffect(() => {
    const loadSavedUsername = async () => {
      const savedUsername = await AsyncStorage.getItem('savedUsername');
      const savedPreference = await AsyncStorage.getItem('rememberMe');
      if (savedUsername && savedPreference === 'true') {
        setUsername(savedUsername);
        setRememberMe(true);
      }
    };
    loadSavedUsername();
  }, []);

  const handleSignIn = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Missing info", "Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      // 1. Find the user by username
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("Username", "==", username.trim()));
      const querySnap = await getDocs(q);
      if (querySnap.empty) {
        Alert.alert("User not found", "No account with that username.");
        setLoading(false);
        return;
      }
      const userData = querySnap.docs[0].data();
      const email = userData.Email;

      // 2. Sign in
      await signInWithEmailAndPassword(auth, email, password.trim());

      // 3. Store "Remember Me" preference
      if (rememberMe) {
        await AsyncStorage.setItem('rememberMe', 'true');
        await AsyncStorage.setItem('savedUsername', username.trim());
      } else {
        await AsyncStorage.setItem('rememberMe', 'false');
        await AsyncStorage.removeItem('savedUsername');
      }

      // 4. Navigate to main app
      router.replace("/(tabs)/tracker");
    } catch (err: any) {
      Alert.alert("Sign In Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={COLORS.emerald} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.geometric} />
      <View style={styles.card}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoLetter}>M</Text>
        </View>
        <Text style={styles.title}>MIQAT</Text>
        <Text style={styles.subtitle}>Prayer companion</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* Remember Me Checkbox */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setRememberMe(!rememberMe)}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Remember me</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Signing In..." : "Sign In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/register")}>
          <Text style={styles.link}>Create an account</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>MIQAT · Fajr to Isha, together</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  geometric: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.goldLight,
    opacity: 0.15,
    transform: [{ rotate: "45deg" }],
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.emerald,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoLetter: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: "bold",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.emerald,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 28,
  },
  input: {
    width: "100%",
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.charcoal,
    marginBottom: 14,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 16,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.muted,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 15,
    color: COLORS.charcoal,
  },
  button: {
    width: "100%",
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    color: COLORS.charcoal,
    fontSize: 16,
    fontWeight: "bold",
  },
  link: {
    color: COLORS.emerald,
    marginTop: 16,
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    position: "absolute",
    bottom: -40,
    color: COLORS.muted,
    fontSize: 11,
    textAlign: "center",
  },
});