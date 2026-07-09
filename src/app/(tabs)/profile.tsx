// app/(tabs)/profile.tsx
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { auth, db } from "../../../firebaseConfig";
import Header from "../../components/header";
import { useClock } from "../../hooks/useClock";

export default function ProfileScreen() {
  const router = useRouter();
  const { timeString, dateString } = useClock();

  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [saving, setSaving] = useState(false);

  // NEW: confirmation modal
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setEmail(user?.email ?? "");
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", uid!));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFullName(data.Full_Name || "");
          setUsername(data.Username || "");
          setStreak(data.Current_Streak || 0);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [uid]);

  const openEditModal = () => {
    setEditFullName(fullName);
    setEditUsername(username);
    setEditModalVisible(true);
  };

  const saveProfile = async () => {
    if (!editFullName.trim() || !editUsername.trim()) {
      Alert.alert("Error", "Full Name and Username cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", uid!), {
        Full_Name: editFullName.trim(),
        Username: editUsername.trim(),
      });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: editFullName.trim() });
      }
      setFullName(editFullName.trim());
      setUsername(editUsername.trim());
      Alert.alert("Success", "Profile updated successfully.");
      setEditModalVisible(false);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = () => {
    console.log("Delete button pressed");
    setConfirmDeleteVisible(true);
  };

  const confirmDelete = async () => {
    setConfirmDeleteVisible(false);
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", uid!));
      await signOut(auth);
      router.replace("/");
      Alert.alert("Account deleted", "Your account has been removed.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (!authChecked || loading || deleting) {
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
      />

      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <Text style={styles.value}>{fullName || "Not set"}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.value}>{username || "Not set"}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{email || "Not set"}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Current Streak</Text>
          <Text style={styles.value}>{streak} days</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={deleteAccount} disabled={deleting}>
        <Text style={styles.deleteButtonText}>{deleting ? "Deleting..." : "Delete Account"}</Text>
      </TouchableOpacity>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#6b7280"
              value={editFullName}
              onChangeText={setEditFullName}
            />
            <Text style={styles.modalLabel}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              value={editUsername}
              onChangeText={setEditUsername}
            />
            <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Delete Confirmation Modal */}
      <Modal visible={confirmDeleteVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.confirmText}>
              Are you sure you want to delete your account? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#3f1d1d" }]}
                onPress={confirmDelete}
              >
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#2a2e37" }]}
                onPress={() => setConfirmDeleteVisible(false)}
              >
                <Text style={[styles.actionButtonText, { color: "#9ca3af" }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
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
  card: {
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  field: { marginBottom: 12 },
  label: { color: "#6b7280", fontSize: 12, marginBottom: 4 },
  value: { color: "#fff", fontSize: 16 },
  editButton: {
    backgroundColor: "#1a3d2a",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  editButtonText: { color: "#22c55e", fontWeight: "bold" },
  deleteButton: {
    backgroundColor: "#3f1d1d",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  deleteButtonText: { color: "#f87171", fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#1a1d23", borderRadius: 12, padding: 20, width: "85%" },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginBottom: 16 },
  modalLabel: { color: "#9ca3af", fontSize: 12, marginBottom: 8 },
  input: {
    backgroundColor: "#0f1115",
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 8,
    padding: 10,
    color: "#fff",
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { color: "#0f1115", fontWeight: "bold" },
  modalCancel: { color: "#6b7280", marginTop: 12, textAlign: "center" },
  confirmText: { color: "#fff", fontSize: 14, textAlign: "center", marginBottom: 8 },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  actionButtonText: { color: "#fff", fontWeight: "bold" },
});