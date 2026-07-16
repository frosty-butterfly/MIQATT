// components/AppHeader.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

type Encouragement = {
  id: string;
  From_Name: string;
  Message: string;
  Created_At: string;
};

export default function AppHeader() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [encouragementCount, setEncouragementCount] = useState(0);
  const [viewEncouragementsVisible, setViewEncouragementsVisible] = useState(false);
  const [encouragements, setEncouragements] = useState<Encouragement[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data().Username || 'User');
        }
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  // Listen for encouragements
  useEffect(() => {
    if (!user) return;
    const encQ = query(
      collection(db, 'encouragements'),
      where('To_UID', '==', user.uid)
    );
    const unsub = onSnapshot(encQ, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Encouragement[];
      setEncouragements(list);
      setEncouragementCount(list.length);
    });
    return unsub;
  }, [user]);

  const handlePress = () => {
    router.push('/(tabs)/profile');
  };

  const handleBadgePress = () => {
    setViewEncouragementsVisible(true);
  };

  if (!user) return null;

  const firstLetter = username.charAt(0).toUpperCase();

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View style={styles.left}>
          <Ionicons name="moon-outline" size={20} color={COLORS.emerald} />
          <Text style={styles.appName}>MIQAT</Text>
        </View>
        <View style={styles.right}>
          {/* Encouragement Badge */}
          {encouragementCount > 0 && (
            <TouchableOpacity style={styles.badge} onPress={handleBadgePress}>
              <Text style={styles.badgeText}>💬 {encouragementCount}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.userSection} onPress={handlePress}>
            <Text style={styles.username}>{username}</Text>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{firstLetter}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Encouragements Modal */}
      <Modal visible={viewEncouragementsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>💬 Encouragements Received</Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: COLORS.cream,
  borderBottomWidth: 1,
  borderBottomColor: '#E2DCD0',
},
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.emerald,
    marginLeft: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 14,
    color: COLORS.charcoal,
    marginRight: 8,
    fontWeight: '500',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
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
  emptyText: {
    color: COLORS.muted,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
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
  modalCancel: {
    color: COLORS.muted,
    marginTop: 12,
    textAlign: 'center',
  },
});