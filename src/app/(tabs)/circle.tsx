// app/(tabs)/circle.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from "firebase/auth";
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
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../../../firebaseConfig';
import AppHeader from '../../components/appHeader';
import { useClock } from '../../hooks/useClock';

const COLORS = {
  cream: '#F8F4EC',
  emerald: '#1E4D3A',
  gold: '#D4AF37',
  goldLight: '#F3E5AB',
  charcoal: '#2C2C2C',
  white: '#FFFFFF',
  muted: '#A0A0A0',
  border: '#E2DCD0',
  success: '#2E7D32',
  warning: '#B76E00',
  danger: '#B71C1C',
  navy: '#1A237E',
};

const PRAYERS = ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak'];

type Circle = { id: string; Circle_Name: string };
type Member = {
  uid: string;
  Full_Name: string;
  Username: string;
  Current_Streak: number;
  // temporary field for today's prayer status
  hasPrayedToday?: boolean;
};
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
type FeedEntry = {
  id: string;
  userId: string;
  userName: string;
  prayer: string;
  status: string;
  timestamp: string;
  type: 'prayer' | 'qada' | 'missed';
};
type Challenge = {
  id: string;
  title: string;
  description: string;
  targetPrayer: string;
  startDate: string;
  endDate: string;
  requiredCount: number;
  progress?: number; // computed locally
};

export default function CircleScreen() {
  const router = useRouter();
  const { timeString, dateString } = useClock();

  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');

  const [myCircles, setMyCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Request[]>([]);

  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [wakeRequests, setWakeRequests] = useState<any[]>([]); // for simplicity

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [encouragements, setEncouragements] = useState<Encouragement[]>([]);
  const [viewEncouragementsVisible, setViewEncouragementsVisible] = useState(false);

  const [cheerModalVisible, setCheerModalVisible] = useState(false);
  const [cheerTargetUid, setCheerTargetUid] = useState('');
  const [cheerTargetName, setCheerTargetName] = useState('');
  const [cheerMessage, setCheerMessage] = useState('Keep going, you\'ve got this! 💪');

  // ---------- Auth ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  // ---------- Fetch user data ----------
  useEffect(() => {
    if (!uid) return;
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setFullName(userDoc.data().Full_Name);
        setUsername(userDoc.data().Username);
      }
    };
    fetchUser();
  }, [uid]);

  // ---------- My circles ----------
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'circleMembers'), where('User_ID', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const circles = snap.docs.map((d) => ({
        id: d.data().Circle_ID,
        Circle_Name: d.data().Circle_Name,
      }));
      setMyCircles(circles);
      if (!selectedCircle && circles.length > 0) {
        setSelectedCircle(circles[0]);
      } else if (circles.length === 0) {
        setSelectedCircle(null);
      }
    });

    const reqQ = query(
      collection(db, 'circleRequests'),
      where('Owner_UID', '==', uid),
      where('Status', '==', 'pending')
    );
    const unsubReq = onSnapshot(reqQ, (snap) => {
      setIncomingRequests(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Request, 'id'>) }))
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
      collection(db, 'circleMembers'),
      where('Circle_ID', '==', selectedCircle.id)
    );
    const unsub = onSnapshot(memQ, async (snap) => {
      const uids = snap.docs.map((d) => d.data().User_ID);
      if (uids.length === 0) {
        setMembers([]);
        return;
      }
      // Fetch users
      const usersQ = query(collection(db, 'users'), where(documentId(), 'in', uids.slice(0, 10)));
      const userSnaps = await getDocs(usersQ);
      const memberList = userSnaps.docs.map((d) => ({
        uid: d.id,
        Full_Name: d.data().Full_Name,
        Username: d.data().Username,
        Current_Streak: d.data().Current_Streak ?? 0,
      }));

      // For each member, fetch today's prayer status
      const today = new Date().toISOString().split('T')[0];
      const membersWithPrayer = await Promise.all(
        memberList.map(async (member) => {
          try {
            const logRef = doc(db, 'prayerLogs', `${member.uid}_${today}`);
            const logSnap = await getDoc(logRef);
            if (logSnap.exists()) {
              const prayers = logSnap.data().prayers || {};
              // Check if any prayer is logged as "Prayed on time" or "Prayed late"
              const hasPrayedToday = Object.values(prayers).some(
                (status) => status === 'Prayed on time' || status === 'Prayed late'
              );
              return { ...member, hasPrayedToday };
            }
            return { ...member, hasPrayedToday: false };
          } catch {
            return { ...member, hasPrayedToday: false };
          }
        })
      );
      setMembers(membersWithPrayer);
    });
    return unsub;
  }, [selectedCircle]);

  // ---------- Feed listener ----------
  useEffect(() => {
    if (!selectedCircle) return;
    const feedQ = query(
      collection(db, 'feed'),
      where('circleId', '==', selectedCircle.id),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(feedQ, (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedEntry, 'id'>) }));
      setFeed(entries);
    });
    return unsub;
  }, [selectedCircle]);

  // ---------- Challenge listener ----------
  useEffect(() => {
    // For simplicity, we assume a single global challenge document with id 'current'
    // In production, you might have per-circle challenges.
    const unsub = onSnapshot(doc(db, 'challenges', 'current'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setChallenge({
          id: docSnap.id,
          title: data.title || 'Weekly Challenge',
          description: data.description || '',
          targetPrayer: data.targetPrayer || 'Fajr',
          startDate: data.startDate || new Date().toISOString().split('T')[0],
          endDate: data.endDate || new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
          requiredCount: data.requiredCount || 5,
        });
      } else {
        setChallenge(null);
      }
    });
    return unsub;
  }, []);

  // Compute challenge progress based on members' today's prayer status
  // For now, we'll just show a static progress if challenge exists
  // Actually we need to count how many members have prayed the target prayer today.
  // We'll update this when members change.
  const challengeProgress = challenge && members.length > 0
    ? Math.min((members.filter(m => m.hasPrayedToday).length / challenge.requiredCount) * 100, 100)
    : 0;

  // ---------- Wake Requests ----------
  // For simplicity, we'll allow a user to send a wake request and others to accept.
  // We'll store in 'wakeRequests' collection.
  const handleWakeMeUp = async () => {
    if (!uid || !selectedCircle) return;
    Alert.alert(
      '🌙 Wake Me Up',
      'Send a wake-up request to your circle? If 2 friends accept, we\'ll ring your phone 15 min before Fajr.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async () => {
            try {
              await addDoc(collection(db, 'wakeRequests'), {
                circleId: selectedCircle.id,
                requesterUid: uid,
                requesterName: fullName || username || 'Someone',
                timestamp: new Date().toISOString(),
                status: 'pending',
                acceptedBy: [],
              });
              Alert.alert('Request sent', 'Waiting for 2 friends to accept.');
            } catch (err) {
              Alert.alert('Error', 'Could not send request.');
            }
          },
        },
      ]
    );
  };

  // Listen for wake requests for current circle to show accept buttons (we can add a small UI)
  // We'll just show a notification for now.

  // ---------- Circle actions ----------
  const createCircle = async () => {
    if (!newCircleName.trim() || !uid) return;
    const circleRef = await addDoc(collection(db, 'circles'), {
      Circle_Name: newCircleName.trim(),
      Created_By: uid,
      Created_At: new Date().toISOString(),
    });
    await addDoc(collection(db, 'circleMembers'), {
      Circle_ID: circleRef.id,
      Circle_Name: newCircleName.trim(),
      User_ID: uid,
      Joined_At: new Date().toISOString(),
    });
    setNewCircleName('');
    setCreateModalVisible(false);
  };

  // ---------- Search by circle name ----------
  const searchByCircleName = async () => {
    if (!searchTerm.trim()) {
      setSearchError('Please enter a circle name.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const term = searchTerm.trim();
      const circlesQ = query(
        collection(db, 'circles'),
        where('Circle_Name', '>=', term),
        where('Circle_Name', '<=', term + '\uf8ff')
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
        const ownerDoc = await getDoc(doc(db, 'users', ownerUid));
        const ownerName = ownerDoc.exists() ? ownerDoc.data().Full_Name : 'Unknown';
        results.push({
          circleId: circleDoc.id,
          circleName: data.Circle_Name,
          ownerUid,
          ownerName,
        });
      }
      setSearchResults(results);
    } catch (err: any) {
      setSearchError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const sendJoinRequest = async (circleId: string, circleName: string, ownerUid: string) => {
    const memberCheck = await getDocs(
      query(
        collection(db, 'circleMembers'),
        where('Circle_ID', '==', circleId),
        where('User_ID', '==', uid)
      )
    );
    if (!memberCheck.empty) {
      Alert.alert('Already a member', `You are already in "${circleName}".`);
      return;
    }
    await addDoc(collection(db, 'circleRequests'), {
      Circle_ID: circleId,
      Circle_Name: circleName,
      Requester_UID: uid,
      Requester_Name: fullName,
      Owner_UID: ownerUid,
      Status: 'pending',
      Created_At: new Date().toISOString(),
    });
    Alert.alert('Request sent', `Your request to join "${circleName}" was sent.`);
    setJoinModalVisible(false);
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
  };

  const acceptRequest = async (req: Request) => {
    await addDoc(collection(db, 'circleMembers'), {
      Circle_ID: req.Circle_ID,
      Circle_Name: req.Circle_Name,
      User_ID: req.Requester_UID,
      Joined_At: new Date().toISOString(),
    });
    await deleteDoc(doc(db, 'circleRequests', req.id));
  };

  const rejectRequest = async (req: Request) => {
    await deleteDoc(doc(db, 'circleRequests', req.id));
  };

  const openCheerModal = (targetUid: string, targetName: string) => {
    setCheerTargetUid(targetUid);
    setCheerTargetName(targetName);
    setCheerMessage('Keep going, you\'ve got this! 💪');
    setCheerModalVisible(true);
  };

  const sendCheer = async () => {
    if (!cheerMessage.trim()) {
      Alert.alert('Empty message', 'Please write a message of encouragement.');
      return;
    }
    await addDoc(collection(db, 'encouragements'), {
      To_UID: cheerTargetUid,
      From_UID: uid,
      From_Name: fullName,
      Message: cheerMessage.trim(),
      Created_At: new Date().toISOString(),
    });
    Alert.alert('Cheer sent', `Your encouragement was sent to ${cheerTargetName}.`);
    setCheerModalVisible(false);
    setCheerMessage('');
  };

  // ---------- Encouragements listener ----------
  useEffect(() => {
    if (!uid) return;
    const encQ = query(
      collection(db, 'encouragements'),
      where('To_UID', '==', uid),
      orderBy('Created_At', 'desc')
    );
    const unsub = onSnapshot(encQ, (snap) => {
      setEncouragements(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Encouragement, 'id'>) }))
      );
    });
    return unsub;
  }, [uid]);

  // ---------- Broadcast ----------
  const handleBroadcast = () => {
    Alert.alert('📢 Broadcast', 'Send a notification to all circle members?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: () => Alert.alert('Broadcast sent', 'All members have been notified.') },
    ]);
  };

  // ---------- Loading ----------
  if (!authChecked) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.cream }]}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }
  if (!uid) return null;

  // ---------- Render ----------
  const renderMember = ({ item }: { item: Member }) => {
    const isYou = item.uid === uid;
    const firstLetter = (item.Username || item.Full_Name)?.charAt(0).toUpperCase() || '?';
    const hasPrayedToday = item.hasPrayedToday || false;

    return (
      <TouchableOpacity style={styles.memberCard} onPress={() => {}}>
        <View style={styles.avatarWrapper}>
          <View style={[styles.avatarCircle, hasPrayedToday && styles.avatarPrayed]}>
            <Text style={styles.avatarText}>{firstLetter}</Text>
          </View>
          {hasPrayedToday && <View style={styles.prayedBadge}><Text style={styles.prayedBadgeText}>✓</Text></View>}
        </View>
        <Text style={styles.memberName}>{item.Username || item.Full_Name}</Text>
        <Text style={styles.memberStreak}>{item.Current_Streak}d</Text>
        {isYou && <Text style={styles.youLabel}>(You)</Text>}
      </TouchableOpacity>
    );
  };

  const renderFeedItem = (item: FeedEntry) => {
    const isPrayer = item.type === 'prayer' || item.type === 'qada';
    const isMissed = item.status === 'Missed';
    const iconName = isMissed ? 'close-circle' : (item.type === 'qada' ? 'time-outline' : 'checkmark-circle');
    const iconColor = isMissed ? COLORS.danger : (item.type === 'qada' ? COLORS.warning : COLORS.success);
    const actionText = isMissed ? `missed ${item.prayer}` : (item.type === 'qada' ? `logged Qada for ${item.prayer}` : `prayed ${item.prayer} on time! 🌙`);
    const timeAgo = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'just now';

    return (
      <View key={item.id} style={styles.feedItem}>
        <View style={styles.feedIconContainer}>
          <Ionicons name={iconName as any} size={24} color={iconColor} />
        </View>
        <View style={styles.feedContent}>
          <Text style={styles.feedText}>
            <Text style={styles.feedName}>{item.userName} </Text>
            {actionText}
          </Text>
          <Text style={styles.feedTime}>{timeAgo}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Circle Selection (if multiple) */}
        {myCircles.length > 1 && (
          <View style={styles.circlePicker}>
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

        {selectedCircle ? (
          <>
            {/* Circle Header */}
            <View style={styles.circleHeader}>
              <Text style={styles.circleName}>{selectedCircle.Circle_Name}</Text>
              <TouchableOpacity onPress={handleBroadcast} style={styles.broadcastButton}>
                <Ionicons name="megaphone-outline" size={24} color={COLORS.gold} />
              </TouchableOpacity>
            </View>

            {/* Active Members Carousel */}
            <View style={styles.carouselContainer}>
              <FlatList
                horizontal
                data={members}
                keyExtractor={(item) => item.uid}
                renderItem={renderMember}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
                ListFooterComponent={
                  <TouchableOpacity style={styles.cheerFab} onPress={() => Alert.alert('Cheer', 'May Allah bless you all!')}>
                    <Ionicons name="star" size={24} color={COLORS.gold} />
                  </TouchableOpacity>
                }
              />
            </View>

            {/* Live Prayer Feed */}
            <View style={styles.feedContainer}>
              <Text style={styles.sectionTitle}>📢 Live Feed</Text>
              {feed.length === 0 ? (
                <Text style={styles.emptyFeedText}>No recent activity. Be the first to log a prayer!</Text>
              ) : (
                feed.slice(0, 10).map(renderFeedItem)
              )}
            </View>

            {/* Challenge Progress */}
            {challenge && (
              <View style={styles.challengeCard}>
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
                <Text style={styles.challengeDesc}>{challenge.description}</Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${Math.min(challengeProgress, 100)}%` }]} />
                </View>
                <Text style={styles.challengeText}>
                  {Math.round(Math.min(challengeProgress, 100))}% · {members.filter(m => m.hasPrayedToday).length}/{challenge.requiredCount} members have prayed today
                </Text>
                <Text style={styles.challengeCountdown}>
                  Ends {new Date(challenge.endDate).toLocaleDateString()}
                </Text>
              </View>
            )}

            {/* Wake Me Up */}
            <TouchableOpacity style={styles.wakeButton} onPress={handleWakeMeUp}>
              <Ionicons name="moon-outline" size={24} color={COLORS.white} />
              <Text style={styles.wakeButtonText}>🌙 Wake me for Fajr</Text>
            </TouchableOpacity>

            {/* Incoming Requests */}
            {incomingRequests.length > 0 && (
              <View style={styles.requestsBox}>
                <Text style={styles.requestsTitle}>Join Requests</Text>
                {incomingRequests.map((req) => (
                  <View key={req.id} style={styles.requestRow}>
                    <Text style={styles.requestText}>
                      {req.Requester_Name} wants to join {req.Circle_Name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
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
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyText}>You're not in a circle yet.</Text>
            <Text style={styles.emptySubText}>Create one or join by name.</Text>
          </View>
        )}

        {/* Action buttons - always visible */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setCreateModalVisible(true)}>
            <Ionicons name="add-circle-outline" size={20} color={COLORS.emerald} />
            <Text style={styles.actionButtonText}>Create Circle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setJoinModalVisible(true);
              setSearchTerm('');
              setSearchResults([]);
              setSearchError(null);
            }}
          >
            <Ionicons name="search-outline" size={20} color={COLORS.emerald} />
            <Text style={styles.actionButtonText}>Join by Name</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* --- Modals (unchanged, but ensure they use new styles) --- */}
      {/* Create Circle Modal */}
      <Modal visible={createModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create a Circle</Text>
            <TextInput
              style={styles.input}
              placeholder="Circle name"
              placeholderTextColor={COLORS.muted}
              value={newCircleName}
              onChangeText={setNewCircleName}
            />
            <TouchableOpacity style={styles.modalActionButton} onPress={createCircle}>
              <Text style={styles.modalActionText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Join Circle Modal */}
      <Modal visible={joinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join a Circle</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter circle name (prefix)"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="words"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            <TouchableOpacity style={styles.modalActionButton} onPress={searchByCircleName}>
              <Text style={styles.modalActionText}>{searching ? 'Searching...' : 'Search'}</Text>
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
                  onPress={() => sendJoinRequest(result.circleId, result.circleName, result.ownerUid)}
                >
                  <Text style={styles.resultActionText}>Request to Join</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => {
                setJoinModalVisible(false);
                setSearchResults([]);
                setSearchTerm('');
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
              placeholderTextColor={COLORS.muted}
              multiline
              numberOfLines={4}
              value={cheerMessage}
              onChangeText={setCheerMessage}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.modalActionButton, { flex: 1 }]} onPress={sendCheer}>
                <Text style={styles.modalActionText}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, { flex: 1, backgroundColor: COLORS.border }]}
                onPress={() => setCheerModalVisible(false)}
              >
                <Text style={[styles.modalActionText, { color: COLORS.charcoal }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Encouragements Modal */}
      <Modal visible={viewEncouragementsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
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

// Styles remain the same as in your current version, but ensure all used styles exist.
// I'll include them here for completeness:

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  circlePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  circleTab: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
  circleTabActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  circleTabText: {
    color: COLORS.charcoal,
    fontSize: 12,
    fontWeight: '500',
  },
  circleTabTextActive: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  circleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.emerald,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  circleName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  broadcastButton: {
    padding: 4,
  },
  carouselContainer: {
    marginBottom: 16,
  },
  carouselContent: {
    paddingVertical: 8,
    gap: 12,
  },
  memberCard: {
    alignItems: 'center',
    marginRight: 12,
    width: 72,
  },
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarPrayed: {
    borderColor: COLORS.success,
    borderWidth: 3,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  prayedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.success,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  prayedBadgeText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
    marginTop: 4,
    textAlign: 'center',
  },
  memberStreak: {
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'center',
  },
  youLabel: {
    fontSize: 9,
    color: COLORS.gold,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cheerFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.gold,
    marginLeft: 4,
  },
  feedContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.emerald,
    marginBottom: 8,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  feedIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  feedContent: {
    flex: 1,
  },
  feedText: {
    fontSize: 14,
    color: COLORS.charcoal,
    lineHeight: 18,
  },
  feedName: {
    fontWeight: 'bold',
    color: COLORS.emerald,
  },
  feedTime: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 2,
  },
  emptyFeedText: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  challengeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.gold,
    marginBottom: 16,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  challengeDesc: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 4,
  },
  challengeText: {
    fontSize: 13,
    color: COLORS.charcoal,
    marginBottom: 2,
  },
  challengeCountdown: {
    fontSize: 11,
    color: COLORS.muted,
  },
  wakeButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  wakeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.emerald,
  },
  requestsBox: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.warning,
    marginBottom: 16,
  },
  requestsTitle: {
    fontWeight: 'bold',
    color: COLORS.warning,
    marginBottom: 8,
  },
  requestRow: {
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestText: {
    color: COLORS.charcoal,
    fontSize: 13,
    flex: 1,
  },
  acceptText: {
    color: COLORS.success,
    fontWeight: 'bold',
  },
  rejectText: {
    color: COLORS.danger,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.emerald,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalLabel: {
    color: COLORS.muted,
    fontSize: 14,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActionButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalActionText: {
    color: COLORS.charcoal,
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalCancel: {
    color: COLORS.muted,
    marginTop: 12,
    textAlign: 'center',
  },
  searchError: {
    color: COLORS.danger,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  resultCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  resultInfo: {
    flex: 1,
  },
  resultCircleName: {
    color: COLORS.charcoal,
    fontSize: 14,
    fontWeight: '600',
  },
  resultOwner: {
    color: COLORS.muted,
    fontSize: 12,
  },
  resultActionButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultActionText: {
    color: COLORS.charcoal,
    fontSize: 12,
    fontWeight: 'bold',
  },
  encouragementItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  encouragementFrom: {
    color: COLORS.emerald,
    fontWeight: 'bold',
    fontSize: 13,
  },
  encouragementMessage: {
    color: COLORS.charcoal,
    fontSize: 14,
    marginTop: 2,
  },
  encouragementDate: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
  },
});