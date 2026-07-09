import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../firebaseConfig";

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !username || !email || !password || !confirmPassword) {
      Alert.alert("Missing info", "Please fill in every field.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // Matches USER entity in the ER diagram
      await setDoc(doc(db, "users", userCred.user.uid), {
        Full_Name: fullName,
        Username: username,
        Email: email.trim(),
        Created_At: new Date().toISOString(),
      });

      router.replace("/(tabs)/tracker");
    } catch (err: any) {
      Alert.alert("Registration Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#6b7280" value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#6b7280" autoCapitalize="none" value={username} onChangeText={setUsername} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#6b7280" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#6b7280" secureTextEntry value={password} onChangeText={setPassword} />
      <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#6b7280" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Signing Up..." : "Sign Up"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Already have an account? Sign In</Text>
      </TouchableOpacity>
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
  title: { color: "#fff", fontSize: 22, fontWeight: "bold", marginBottom: 24 },
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
});