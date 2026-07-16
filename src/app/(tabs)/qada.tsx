// app/(tabs)/qada.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { auth, db } from '../../../firebaseConfig';
import AppHeader from '../../components/appHeader';
import { useClock } from '../../hooks/useClock';

const PRAYERS = ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak'];

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
  danger: '#B71C1C',
  warning: '#B76E00',
};

type QadaEntry = {
  id: string;
  Prayer_Name: string;
  Original_Date: string;
  Is_Completed: boolean;
  Completed_At: string | null;
};

type DateGroup = {
  date: string;
  entries: QadaEntry[];
  uncompletedCount: number;
};

type MonthSection = {
  title: string; // "July 2026"
  data: DateGroup[];
};

export default function QadaScreen() {
  const router = useRouter();
  const { timeString, dateString } = useClock();

  const [uid, setUid] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [entries, setEntries] = useState<QadaEntry[]>([]);
  const [sections, setSections] = useState<MonthSection[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded state: map date string -> boolean
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedPrayer, setSelectedPrayer] = useState(PRAYERS[0]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // ---------- Auth ----------
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsubscribeAuth;
  }, []);

  // ---------- Snapshot for qada entries ----------
  useEffect(() => {
    if (!uid) {
      if (authChecked) setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'qadaDebts'),
      where('User_ID', '==', uid),
      orderBy('Original_Date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<QadaEntry, 'id'>),
      }));
      setEntries(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid, authChecked]);

  // ---------- Group entries by month and date ----------
  useEffect(() => {
    if (entries.length === 0) {
      setSections([]);
      return;
    }

    // Group by date
    const dateMap = new Map<string, QadaEntry[]>();
    entries.forEach((entry) => {
      const date = entry.Original_Date;
      if (!dateMap.has(date)) dateMap.set(date, []);
      dateMap.get(date)!.push(entry);
    });

    // Build date groups
    const dateGroups: DateGroup[] = [];
    for (const [date, entries] of dateMap) {
      const uncompletedCount = entries.filter((e) => !e.Is_Completed).length;
      dateGroups.push({ date, entries, uncompletedCount });
    }

    // Sort by date descending (newest first)
    dateGroups.sort((a, b) => b.date.localeCompare(a.date));

    // Group by month
    const monthMap = new Map<string, DateGroup[]>();
    dateGroups.forEach((group) => {
      const dateObj = new Date(group.date + 'T00:00:00');
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!monthMap.has(monthLabel)) monthMap.set(monthLabel, []);
      monthMap.get(monthLabel)!.push(group);
    });

    // Build sections
    const sectionList: MonthSection[] = [];
    for (const [title, data] of monthMap) {
      sectionList.push({ title, data });
    }

    setSections(sectionList);
  }, [entries]);

  // ---------- CRUD operations ----------
  const addEntry = async () => {
    if (!uid) {
      Alert.alert('Not signed in', 'Please log in again.');
      return;
    }
    if (!selectedDate) {
      Alert.alert('Missing date', 'Please select the original date.');
      return;
    }

    const entryId = `${uid}_${selectedDate}_${selectedPrayer}`;
    const entryRef = doc(db, 'qadaDebts', entryId);

    try {
      const existing = await getDoc(entryRef);
      if (existing.exists()) {
        Alert.alert(
          'Already logged',
          `You've already logged a missed ${selectedPrayer} for ${selectedDate}.`
        );
        return;
      }

      await setDoc(entryRef, {
        User_ID: uid,
        Prayer_Name: selectedPrayer,
        Original_Date: selectedDate,
        Is_Completed: false,
        Completed_At: null,
        Source: 'manual',
      });
      setAddModalVisible(false);
    } catch (err: any) {
      console.error('Failed to add qada entry:', err);
      Alert.alert('Error', err.message ?? 'Could not save this entry.');
    }
  };

  const markDone = async (id: string) => {
    try {
      await updateDoc(doc(db, 'qadaDebts', id), {
        Is_Completed: true,
        Completed_At: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to mark done:', err);
      Alert.alert('Error', 'Could not update this entry.');
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'qadaDebts', id));
    } catch (err) {
      console.error('Failed to remove entry:', err);
      Alert.alert('Error', 'Could not delete this entry.');
    }
  };

  const toggleExpand = (date: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const handleLogout = async () => {
  await AsyncStorage.removeItem('rememberMe');
  await AsyncStorage.removeItem('savedUsername');
  await signOut(auth);
  router.replace("/");
};

  // ---------- Loading ----------
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.cream }]}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }

  // ---------- Render ----------
  const renderDateRow = ({ item }: { item: DateGroup }) => {
    const isExpanded = expandedDates[item.date] || false;
    const isAllDone = item.uncompletedCount === 0;
    const dateObj = new Date(item.date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    return (
      <View style={styles.dateRowContainer}>
        <TouchableOpacity
          style={[styles.dateRow, isAllDone && styles.dateRowAllDone]}
          onPress={() => toggleExpand(item.date)}
          activeOpacity={0.7}
        >
          <View style={styles.dateRowLeft}>
            <Text style={[styles.dateText, isAllDone && styles.dateTextAllDone]}>
              {formattedDate}
            </Text>
            {isAllDone ? (
              <View style={styles.allDoneBadge}>
                <Text style={styles.allDoneText}>All done ✅</Text>
              </View>
            ) : (
              <Text style={styles.missedCount}>
                {item.uncompletedCount} Missed Prayer{item.uncompletedCount > 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={20}
            color={isAllDone ? COLORS.success : COLORS.muted}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContainer}>
            {item.entries.map((entry) => {
              const isDone = entry.Is_Completed;
              return (
                <View key={entry.id} style={[styles.entryItem, isDone && styles.entryItemDone]}>
                  <Text style={[styles.entryName, isDone && styles.entryNameDone]}>
                    {entry.Prayer_Name}
                  </Text>
                  {isDone ? (
                    <Text style={styles.completedText}>Completed ✓</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.doneButton}
                      onPress={() => markDone(entry.id)}
                    >
                      <Text style={styles.doneButtonText}>Mark Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: MonthSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <AppHeader />
        <Text style={styles.pageTitle}>🕌 Qada Ledger</Text>

        {/* Outstanding count card */}
        <View style={styles.outstandingCard}>
          <Text style={styles.outstandingLabel}>Outstanding Qada</Text>
          <Text style={styles.outstandingValue}>
            {entries.filter((e) => !e.Is_Completed).length} prayers
          </Text>
        </View>

        {sections.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.success} />
            <Text style={styles.emptyText}>No qada entries — you're all caught up!</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => item.date + index}
            renderItem={renderDateRow}
            renderSectionHeader={renderSectionHeader}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Add Button */}
        <TouchableOpacity style={styles.addButton} onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add-circle-outline" size={20} color={COLORS.charcoal} />
          <Text style={styles.addButtonText}>Add Missed Prayer</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Missed Prayer</Text>

            <Text style={styles.modalLabel}>Prayer</Text>
            <View style={styles.prayerPicker}>
              {PRAYERS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.prayerChip, selectedPrayer === p && styles.prayerChipActive]}
                  onPress={() => setSelectedPrayer(p)}
                >
                  <Text
                    style={
                      selectedPrayer === p ? styles.prayerChipTextActive : styles.prayerChipText
                    }
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Original Date</Text>
            <Calendar
              current={selectedDate}
              onDayPress={(day: any) => setSelectedDate(day.dateString)}
              maxDate={new Date().toISOString().split('T')[0]}
              markedDates={{
                [selectedDate]: { selected: true, selectedColor: COLORS.gold },
              }}
              theme={{
                backgroundColor: COLORS.white,
                calendarBackground: COLORS.white,
                textSectionTitleColor: COLORS.charcoal,
                dayTextColor: COLORS.charcoal,
                monthTextColor: COLORS.charcoal,
                todayTextColor: COLORS.gold,
                arrowColor: COLORS.emerald,
                selectedDayBackgroundColor: COLORS.gold,
                selectedDayTextColor: COLORS.charcoal,
              }}
              style={styles.calendar}
            />

            <TouchableOpacity style={styles.modalSaveButton} onPress={addEntry}>
              <Text style={styles.addButtonText}>Save Entry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setAddModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, paddingHorizontal: 20, paddingTop: 0 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.emerald,
    textAlign: 'center',
    marginVertical: 16,
  },
  outstandingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.gold,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  outstandingLabel: {
    fontSize: 14,
    color: COLORS.muted,
  },
  outstandingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 8,
  },
  sectionHeader: {
    backgroundColor: COLORS.cream,
    paddingVertical: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.emerald,
  },
  dateRowContainer: {
    marginBottom: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.white,
  },
  dateRowAllDone: {
    backgroundColor: COLORS.success + '15',
    borderColor: COLORS.success,
  },
  dateRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  dateTextAllDone: {
    color: COLORS.success,
  },
  missedCount: {
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '500',
  },
  allDoneBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  allDoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  expandedContainer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: COLORS.cream,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  entryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  entryItemDone: {
    opacity: 0.6,
  },
  entryName: {
    fontSize: 14,
    color: COLORS.charcoal,
    fontWeight: '500',
  },
  entryNameDone: {
    textDecorationLine: 'line-through',
    color: COLORS.muted,
  },
  doneButton: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  doneButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  completedText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.charcoal,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.emerald,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 6,
  },
  prayerPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  prayerChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  prayerChipActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  prayerChipText: {
    fontSize: 13,
    color: COLORS.charcoal,
  },
  prayerChipTextActive: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  calendar: {
    borderRadius: 12,
    marginBottom: 16,
  },
  modalSaveButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCancelButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  modalCancel: {
    fontSize: 14,
    color: COLORS.muted,
  },
});