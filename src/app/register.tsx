// app/register.tsx
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebaseConfig';

const COLORS = {
  cream: '#F8F4EC',
  emerald: '#1E4D3A',
  gold: '#D4AF37',
  goldLight: '#F3E5AB',
  charcoal: '#2C2C2C',
  white: '#FFFFFF',
  muted: '#A0A0A0',
  border: '#E2DCD0',
};

// Wraps any promise with a timeout so the UI never hangs forever
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out. Please check your connection and try again.`)), ms)
    ),
  ]);
}

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !username || !email || !password || !confirmPassword) {
      Alert.alert('Missing info', 'Please fill in every field.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      // 1. Check if username is already taken (with timeout safeguard)
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('Username', '==', username.trim()));
      const snap = await withTimeout(getDocs(q), 15000, 'Username check');
      if (!snap.empty) {
        Alert.alert('Username taken', 'That username is already in use.');
        setLoading(false);
        return;
      }

      // 2. Create Firebase Auth user (with timeout safeguard)
      const userCred = await withTimeout(
        createUserWithEmailAndPassword(auth, email.trim(), password),
        15000,
        'Account creation'
      );
      const uid = userCred.user.uid;

      try {
        // 3. Save user profile to Firestore (with timeout safeguard)
        await withTimeout(
          setDoc(doc(db, 'users', uid), {
            Full_Name: fullName.trim(),
            Username: username.trim(),
            Email: email.trim(),
            Created_At: new Date().toISOString(),
            Current_Streak: 0,
          }),
          15000,
          'Profile creation'
        );
      } catch (firestoreError) {
        // Firestore write failed or timed out — delete the orphaned Auth user
        console.error('Firestore write failed, deleting Auth user:', firestoreError);
        try {
          await signOut(auth);
          await deleteUser(userCred.user);
        } catch (deleteError) {
          console.error('Failed to delete Auth user:', deleteError);
        }
        throw firestoreError;
      }

      // 4. Success — navigate to main app
      router.replace('/(tabs)/tracker');
    } catch (err: any) {
      console.error('Registration error:', err);

      let errorMessage = err.message || 'Registration failed. Please try again.';

      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in or use a different email.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (err.message && err.message.includes('permission')) {
        errorMessage = 'Permission denied. Please check Firestore security rules.';
      }

      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.geometric} />
      <View style={styles.card}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start your journey with MIQAT</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor={COLORS.muted}
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={styles.input}
          placeholder="Username (unique)"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 chars)"
          placeholderTextColor={COLORS.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor={COLORS.muted}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Signing Up...' : 'Sign Up'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  geometric: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.goldLight,
    opacity: 0.12,
    transform: [{ rotate: '30deg' }],
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.emerald,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.charcoal,
    marginBottom: 14,
  },
  button: {
    width: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: COLORS.charcoal,
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    color: COLORS.emerald,
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
});