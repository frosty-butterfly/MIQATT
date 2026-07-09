import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth } from "../../firebaseConfig";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/(tabs)/tracker");
    } catch (err: any) {
      Alert.alert("Sign In Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoLetter}>M</Text>
      </View>
      <Text style={styles.title}>MIQAT</Text>
      <Text style={styles.subtitle}>Prayer circle & qada tracker</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6b7280"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Signing In..." : "Sign In"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/register")}>
        <Text style={styles.link}>Create an account</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>MIQAT · Fajr to Isha, together</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1115",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoLetter: { color: "#22c55e", fontSize: 28, fontWeight: "bold" },
  title: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  subtitle: { color: "#9ca3af", fontSize: 13, marginBottom: 32 },
  input: {
    width: "100%",
    backgroundColor: "#1a1d23",
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    marginBottom: 12,
  },
  button: {
    width: "100%",
    backgroundColor: "#22c55e",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#0f1115", fontWeight: "bold" },
  link: { color: "#22c55e", marginTop: 16, fontSize: 13 },
  footer: { position: "absolute", bottom: 40, color: "#4b5563", fontSize: 11 },
});