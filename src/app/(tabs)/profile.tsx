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
import AppHeader from "../../components/appHeader";

const COLORS = {
  cream: "#F8F4EC",
  emerald: "#1E4D3A",
  gold: "#D4AF37",
  goldLight: "#F3E5AB",
  charcoal: "#2C2C2C",
  white: "#FFFFFF",
  muted: "#A0A0A0",
  border: "#E2DCD0",
  danger: "#B71C1C",
};

export default function ProfileScreen() {
  const router = useRouter();

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
      <View style={[styles.center, { backgroundColor: COLORS.cream }]}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }
  if (!uid) return null;

  const firstLetter = username.charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <AppHeader />
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{firstLetter}</Text>
          </View>
        </View>

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
              placeholderTextColor={COLORS.muted}
              value={editFullName}
              onChangeText={setEditFullName}
            />
            <Text style={styles.modalLabel}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={COLORS.muted}
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

      {/* Delete Confirmation Modal */}
      <Modal visible={confirmDeleteVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.confirmText}>
              Are you sure you want to delete your account? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.danger }]}
                onPress={confirmDelete}
              >
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.border }]}
                onPress={() => setConfirmDeleteVisible(false)}
              >
                <Text style={[styles.actionButtonText, { color: COLORS.charcoal }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.emerald,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.emerald,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  avatarText: {
    fontSize: 40,
    color: COLORS.white,
    fontWeight: "bold",
  },
  field: {
    width: "100%",
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: COLORS.charcoal,
  },
  editButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  editButtonText: {
    color: COLORS.charcoal,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: COLORS.danger + "20",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.emerald,
    textAlign: "center",
    marginBottom: 16,
  },
  modalLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    color: COLORS.charcoal,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: COLORS.charcoal,
    fontWeight: "bold",
  },
  modalCancel: {
    color: COLORS.muted,
    marginTop: 12,
    textAlign: "center",
  },
  confirmText: {
    color: COLORS.charcoal,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: "bold",
  },
});