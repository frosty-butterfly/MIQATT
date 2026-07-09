// app/(tabs)/circle.tsx
import { useRootNavigationState, useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../../firebaseConfig";
import Header from "../../components/header";
import { useClock } from "../../hooks/useClock";

const PRAYERS = ["Subuh", "Zohor", "Asar", "Maghrib", "Isyak"];

type Circle = { id: string; Circle_Name: string };
type Member = { uid: string; Full_Name: string; Username: string; Current_Streak: number };
type Request = {
  id: string;
  Circle_ID: string;
  Circle_Name: string;
  Requester_UID: string;
  Requester_Name: string;
};
type SearchResult = {
  circleId: string;
  circleName: string;
  ownerUid: string;
  ownerName: string;
};
type Encouragement = {
  id: string;
  From_UID: string;
  From_Name: string;
  Message: string;
  Created_At: string;
};

function dayColor(prayers: Record<string, string> | undefined) {
  if (!prayers || Object.keys(prayers).length === 0) return null;
  const values = Object.values(prayers);
  if (values.includes("Missed")) return "#ef4444";
  if (values.includes("Prayed late")) return "#f59e0b";
  if (PRAYERS.every((p) => prayers[p] === "Prayed on time")) return "#22c55e";
  return "#6b7280";
}

export default function CircleScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { timeString, dateString } = useClock();

  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});

  const [myCircles, setMyCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Request[]>([]);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newCircleName, setNewCircleName] = useState("");

  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [encouragements, setEncouragements] = useState<Encouragement[]>([]);
  const [viewEncouragementsVisible, setViewEncouragementsVisible] = useState(false);

  const [cheerModalVisible, setCheerModalVisible] = useState(false);
  const [cheerTargetUid, setCheerTargetUid] = useState("");
  const [cheerTargetName, setCheerTargetName] = useState("");
  const [cheerMessage, setCheerMessage] = useState("Keep going, you've got this! 💪");

  // ---------- Auth ----------
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

  // ---------- Fetch user name ----------
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) setFullName(snap.data().Full_Name);
    });
  }, [uid]);

  // ---------- Load calendar marks ----------
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

  useEffect(() => {
    if (!uid) return;
    loadCalendarMarks(uid);
  }, [uid]);

  // ---------- My circles ----------
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "circleMembers"), where("User_ID", "==", uid));
    const unsub = onSnapshot(q, (snap) => {
      const circles = snap.docs.map((d) => ({
        id: d.data().Circle_ID,
        Circle_Name: d.data().Circle_Name,
      }));
      setMyCircles(circles);
      setSelectedCircle((prev) => prev ?? circles[0] ?? null);
    });

    const reqQ = query(
      collection(db, "circleRequests"),
      where("Owner_UID", "==", uid),
      where("Status", "==", "pending")
    );
    const unsubReq = onSnapshot(reqQ, (snap) => {
      setIncomingRequests(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Request, "id">) }))
      );
    });

    return () => {
      unsub();
      unsubReq();
    };
  }, [uid]);

  // ---------- Members of selected circle ----------
  useEffect(() => {
    if (!selectedCircle) {
      setMembers([]);
      return;
    }
    const memQ = query(
      collection(db, "circleMembers"),
      where("Circle_ID", "==", selectedCircle.id)
    );
    const unsub = onSnapshot(memQ, async (snap) => {
      const uids = snap.docs.map((d) => d.data().User_ID);
      if (uids.length === 0) {
        setMembers([]);
        return;
      }
      const usersQ = query(collection(db, "users"), where(documentId(), "in", uids.slice(0, 30)));
      const userSnaps = await getDocs(usersQ);
      setMembers(
        userSnaps.docs.map((d) => ({
          uid: d.id,
          Full_Name: d.data().Full_Name,
          Username: d.data().Username,
          Current_Streak: d.data().Current_Streak ?? 0,
        }))
      );
    });
    return unsub;
  }, [selectedCircle]);

  // ---------- Encouragements (received) ----------
  useEffect(() => {
    if (!uid) return;
    const encQ = query(
      collection(db, "encouragements"),
      where("To_UID", "==", uid),
      orderBy("Created_At", "desc")
    );
    const unsub = onSnapshot(encQ, (snap) => {
      setEncouragements(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Encouragement, "id">) }))
      );
    });
    return unsub;
  }, [uid]);

  // ---------- Circle actions ----------
  const createCircle = async () => {
    if (!newCircleName.trim() || !uid) return;
    const circleRef = await addDoc(collection(db, "circles"), {
      Circle_Name: newCircleName.trim(),
      Created_By: uid,
      Created_At: new Date().toISOString(),
    });
    await addDoc(collection(db, "circleMembers"), {
      Circle_ID: circleRef.id,
      Circle_Name: newCircleName.trim(),
      User_ID: uid,
      Joined_At: new Date().toISOString(),
    });
    setNewCircleName("");
    setCreateModalVisible(false);
  };

  // ---------- SEARCH BY CIRCLE NAME ----------
  const searchByCircleName = async () => {
    if (!searchTerm.trim()) {
      setSearchError("Please enter a circle name.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const term = searchTerm.trim();
      // Prefix match using >= and <= with a sentinel character
      const circlesQ = query(
        collection(db, "circles"),
        where("Circle_Name", ">=", term),
        where("Circle_Name", "<=", term + "\uf8ff")
      );
      const circleSnaps = await getDocs(circlesQ);

      if (circleSnaps.empty) {
        setSearchError(`No circles found with name starting with "${term}".`);
        setSearching(false);
        return;
      }

      const results: SearchResult[] = [];
      for (const circleDoc of circleSnaps.docs) {
        const data = circleDoc.data();
        const ownerUid = data.Created_By;
        // Get owner's name
        const ownerDoc = await getDoc(doc(db, "users", ownerUid));
        const ownerName = ownerDoc.exists() ? ownerDoc.data().Full_Name : "Unknown";
        results.push({
          circleId: circleDoc.id,
          circleName: data.Circle_Name,
          ownerUid,
          ownerName,
        });
      }
      setSearchResults(results);
    } catch (err: any) {
      setSearchError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const sendJoinRequest = async (circleId: string, circleName: string, ownerUid: string) => {
    // Check if already a member
    const memberCheck = await getDocs(
      query(collection(db, "circleMembers"), where("Circle_ID", "==", circleId), where("User_ID", "==", uid))
    );
    if (!memberCheck.empty) {
      Alert.alert("Already a member", `You are already in "${circleName}".`);
      return;
    }
    await addDoc(collection(db, "circleRequests"), {
      Circle_ID: circleId,
      Circle_Name: circleName,
      Requester_UID: uid,
      Requester_Name: fullName,
      Owner_UID: ownerUid,
      Status: "pending",
      Created_At: new Date().toISOString(),
    });
    Alert.alert("Request sent", `Your request to join "${circleName}" was sent.`);
    setJoinModalVisible(false);
    setSearchTerm("");
    setSearchResults([]);
    setSearchError(null);
  };

  const acceptRequest = async (req: Request) => {
    await addDoc(collection(db, "circleMembers"), {
      Circle_ID: req.Circle_ID,
      Circle_Name: req.Circle_Name,
      User_ID: req.Requester_UID,
      Joined_At: new Date().toISOString(),
    });
    await deleteDoc(doc(db, "circleRequests", req.id));
  };

  const rejectRequest = async (req: Request) => {
    await deleteDoc(doc(db, "circleRequests", req.id));
  };

  const openCheerModal = (targetUid: string, targetName: string) => {
    setCheerTargetUid(targetUid);
    setCheerTargetName(targetName);
    setCheerMessage("Keep going, you've got this! 💪");
    setCheerModalVisible(true);
  };

  const sendCheer = async () => {
    if (!cheerMessage.trim()) {
      Alert.alert("Empty message", "Please write a message of encouragement.");
      return;
    }
    await addDoc(collection(db, "encouragements"), {
      To_UID: cheerTargetUid,
      From_UID: uid,
      From_Name: fullName,
      Message: cheerMessage.trim(),
      Created_At: new Date().toISOString(),
    });
    Alert.alert("Cheer sent", `Your encouragement was sent to ${cheerTargetName}.`);
    setCheerModalVisible(false);
    setCheerMessage("");
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  // ---------- Loading ----------
  if (!authChecked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" />
      </View>
    );
  }
  if (!uid) return null;

  // ---------- Render ----------
  return (
    <View style={styles.container}>
      <Header
        fullName={fullName}
        onLogout={handleLogout}
        locationLabel={undefined}
        timeString={timeString}
        dateString={dateString}
        markedDates={markedDates}
      />

      <Text style={styles.title}>Prayer Circle</Text>

      {incomingRequests.length > 0 && (
        <View style={styles.requestsBox}>
          <Text style={styles.requestsTitle}>Join Requests</Text>
          {incomingRequests.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <Text style={styles.requestText}>
                {req.Requester_Name} wants to join {req.Circle_Name}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => acceptRequest(req)}>
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => rejectRequest(req)}>
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {myCircles.length > 0 && (
        <View style={styles.circleTabs}>
          {myCircles.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.circleTab, selectedCircle?.id === c.id && styles.circleTabActive]}
              onPress={() => setSelectedCircle(c)}
            >
              <Text
                style={
                  selectedCircle?.id === c.id ? styles.circleTabTextActive : styles.circleTabText
                }
              >
                {c.Circle_Name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={members}
        keyExtractor={(m) => m.uid}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{item.Full_Name?.charAt(0) ?? "?"}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.memberName}>
                {item.Full_Name} {item.uid === uid ? "(You)" : ""}
              </Text>
              <Text style={styles.memberStreak}>{item.Current_Streak} day streak</Text>
            </View>
            {item.uid !== uid && (
              <TouchableOpacity
                style={styles.cheerButton}
                onPress={() => openCheerModal(item.uid, item.Full_Name)}
              >
                <Text style={styles.cheerText}>Cheer +</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {myCircles.length === 0
              ? "You're not in a circle yet. Create one or join with a circle name."
              : "No members yet."}
          </Text>
        }
      />

      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={() => setCreateModalVisible(true)}>
          <Text style={styles.actionButtonText}>+ Create Circle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setJoinModalVisible(true);
            setSearchTerm("");
            setSearchResults([]);
            setSearchError(null);
          }}
        >
          <Text style={styles.actionButtonText}>Join by Name</Text>
        </TouchableOpacity>
      </View>

      {encouragements.length > 0 && (
        <TouchableOpacity
          style={styles.encouragementBadge}
          onPress={() => setViewEncouragementsVisible(true)}
        >
          <Text style={styles.encouragementBadgeText}>💬 {encouragements.length}</Text>
        </TouchableOpacity>
      )}

      {/* --- Modals --- */}

      {/* Create Circle Modal */}
      <Modal visible={createModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create a Circle</Text>
            <TextInput
              style={styles.input}
              placeholder="Circle name"
              placeholderTextColor="#6b7280"
              value={newCircleName}
              onChangeText={setNewCircleName}
            />
            <TouchableOpacity style={styles.actionButton} onPress={createCircle}>
              <Text style={styles.actionButtonText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Join by Circle Name Modal */}
      <Modal visible={joinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join a Circle</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter circle name (prefix)"
              placeholderTextColor="#6b7280"
              autoCapitalize="words"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            <TouchableOpacity style={styles.actionButton} onPress={searchByCircleName}>
              <Text style={styles.actionButtonText}>{searching ? "Searching..." : "Search"}</Text>
            </TouchableOpacity>

            {searchError && <Text style={styles.searchError}>{searchError}</Text>}

            {searchResults.map((result) => (
              <View key={result.circleId} style={styles.resultCard}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultCircleName}>{result.circleName}</Text>
                  <Text style={styles.resultOwner}>by {result.ownerName}</Text>
                </View>
                <TouchableOpacity
                  style={styles.resultActionButton}
                  onPress={() =>
                    sendJoinRequest(result.circleId, result.circleName, result.ownerUid)
                  }
                >
                  <Text style={styles.resultActionText}>Request to Join</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => {
                setJoinModalVisible(false);
                setSearchResults([]);
                setSearchTerm("");
                setSearchError(null);
              }}
            >
              <Text style={styles.modalCancel}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cheer Modal */}
      <Modal visible={cheerModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send Encouragement</Text>
            <Text style={styles.modalLabel}>To: {cheerTargetName}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write a short note of encouragement..."
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={4}
              value={cheerMessage}
              onChangeText={setCheerMessage}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.actionButton, { flex: 1 }]} onPress={sendCheer}>
                <Text style={styles.actionButtonText}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { flex: 1, backgroundColor: "#2a2e37" }]}
                onPress={() => setCheerModalVisible(false)}
              >
                <Text style={[styles.actionButtonText, { color: "#9ca3af" }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Encouragements Modal */}
      <Modal visible={viewEncouragementsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>Encouragements Received</Text>
            {encouragements.length === 0 ? (
              <Text style={styles.emptyText}>No encouragements yet.</Text>
            ) : (
              <FlatList
                data={encouragements}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.encouragementItem}>
                    <Text style={styles.encouragementFrom}>From {item.From_Name}</Text>
                    <Text style={styles.encouragementMessage}>“{item.Message}”</Text>
                    <Text style={styles.encouragementDate}>
                      {new Date(item.Created_At).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              />
            )}
            <TouchableOpacity onPress={() => setViewEncouragementsVisible(false)}>
              <Text style={styles.modalCancel}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115", padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#0f1115", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  requestsBox: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  requestsTitle: { color: "#f59e0b", fontWeight: "bold", marginBottom: 8 },
  requestRow: { marginBottom: 8 },
  requestText: { color: "#fff", fontSize: 13, marginBottom: 4 },
  acceptText: { color: "#22c55e", fontWeight: "bold" },
  rejectText: { color: "#f87171", fontWeight: "bold" },
  circleTabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  circleTab: {
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  circleTabActive: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  circleTabText: { color: "#9ca3af", fontSize: 12 },
  circleTabTextActive: { color: "#0f1115", fontSize: 12, fontWeight: "bold" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#22c55e", fontWeight: "bold" },
  memberName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  memberStreak: { color: "#6b7280", fontSize: 12 },
  cheerButton: { borderWidth: 1, borderColor: "#22c55e", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  cheerText: { color: "#22c55e", fontSize: 12, fontWeight: "bold" },
  emptyText: { color: "#6b7280", textAlign: "center", marginTop: 20 },
  bottomButtons: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#1a3d2a",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  actionButtonText: { color: "#22c55e", fontWeight: "bold", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#1a1d23", borderRadius: 12, padding: 20, width: "85%", maxHeight: "80%" },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginBottom: 16 },
  modalLabel: { color: "#9ca3af", fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: "#0f1115",
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 8,
    padding: 10,
    color: "#fff",
    marginBottom: 12,
  },
  textArea: { height: 80, textAlignVertical: "top" },
  modalCancel: { color: "#6b7280", marginTop: 12, textAlign: "center" },
  searchError: { color: "#f87171", fontSize: 13, marginTop: 8, textAlign: "center" },
  resultCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2e37",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  resultInfo: { flex: 1 },
  resultCircleName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  resultOwner: { color: "#6b7280", fontSize: 12 },
  resultActionButton: {
    backgroundColor: "#1a3d2a",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultActionText: { color: "#22c55e", fontSize: 12, fontWeight: "bold" },
  encouragementBadge: {
    position: "absolute",
    top: 110,
    right: 20,
    backgroundColor: "#22c55e",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  encouragementBadgeText: { color: "#0f1115", fontWeight: "bold" },
  encouragementItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#2a2e37",
    paddingVertical: 10,
  },
  encouragementFrom: { color: "#22c55e", fontWeight: "bold", fontSize: 13 },
  encouragementMessage: { color: "#fff", fontSize: 14, marginTop: 2 },
  encouragementDate: { color: "#6b7280", fontSize: 10, marginTop: 4 },
});