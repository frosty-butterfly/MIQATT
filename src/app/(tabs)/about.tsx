// app/(tabs)/about.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../../../firebaseConfig';
import AppHeader from '../../components/appHeader';

const COLORS = {
  cream: "#F8F4EC",
  emerald: "#1E4D3A",
  gold: "#D4AF37",
  goldLight: "#F3E5AB",
  charcoal: "#2C2C2C",
  white: "#FFFFFF",
  muted: "#A0A0A0",
  border: "#E2DCD0",
  success: "#2E7D32",  
  warning: "#B76E00",
};

type Feature = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
};

const FEATURES: Feature[] = [
  {
    id: 'log',
    icon: 'checkmark-circle-outline',
    title: 'Log Prayers',
    description: 'Mark your prayers on time, late, or missed with a single tap.',
    color: COLORS.success,
  },
  {
    id: 'streak',
    icon: 'flame-outline',
    title: 'Track Streaks',
    description: 'Build consistency with daily streaks and recovery tracking.',
    color: COLORS.warning,
  },
  {
    id: 'circle',
    icon: 'people-outline',
    title: 'Prayer Circles',
    description: 'Join circles with friends, encourage each other, and stay accountable.',
    color: COLORS.emerald,
  },
  {
    id: 'qada',
    icon: 'time-outline',
    title: 'Qada Ledger',
    description: 'Keep track of missed prayers and clear them efficiently.',
    color: COLORS.gold,
  },
  {
    id: 'calendar',
    icon: 'calendar-outline',
    title: 'Calendar History',
    description: 'View your prayer history with color-coded dots for each day.',
    color: COLORS.emerald,
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const sendFeedback = () => {
    const email = 'aqilahmadiha128@gmail.com';
    const subject = 'MIQAT Feedback';
    const body = 'I have some feedback about MIQAT:';
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      .catch(() => {
        Alert.alert('Error', 'Could not open email client. Please email us at support@miqat.app');
      });
  };

  if (!authChecked) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.cream }]}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }
  if (!uid) return null;

  const toggleFeature = (id: string) => {
    setExpandedFeature(expandedFeature === id ? null : id);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <AppHeader />
      <View style={styles.headerContainer}>
        <Text style={styles.title}>About MIQAT</Text>
        <Text style={styles.subtitle}>Your prayer companion</Text>
      </View>

      {/* Version Card */}
      <View style={styles.versionCard}>
        <Ionicons name="information-circle-outline" size={24} color={COLORS.emerald} />
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>

      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.description}>
          MIQAT is your prayer companion – track your daily prayers, manage missed (qada) prayers,
          and stay connected with your circle.
        </Text>
      </View>

      {/* Features Accordion */}
      <Text style={styles.sectionTitle}>✨ Features</Text>
      {FEATURES.map((feature) => {
        const isExpanded = expandedFeature === feature.id;
        return (
          <TouchableOpacity
            key={feature.id}
            style={[styles.featureCard, isExpanded && styles.featureCardExpanded]}
            onPress={() => toggleFeature(feature.id)}
            activeOpacity={0.7}
          >
            <View style={styles.featureHeader}>
              <View style={[styles.iconContainer, { backgroundColor: feature.color + '20' }]}>
                <Ionicons name={feature.icon} size={22} color={feature.color} />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Ionicons
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color={COLORS.muted}
                style={styles.chevron}
              />
            </View>
            {isExpanded && (
              <View style={styles.featureBody}>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Feedback Button */}
      <TouchableOpacity style={styles.feedbackButton} onPress={sendFeedback}>
        <Ionicons name="mail-outline" size={20} color={COLORS.charcoal} style={styles.feedbackIcon} />
        <Text style={styles.feedbackText}>Send Feedback</Text>
      </TouchableOpacity>

      {/* Footer */}
      <Text style={styles.footerText}>
        Made with ❤️ · Fajr to Isha, together
      </Text>
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
  headerContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.emerald,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 2,
  },
  versionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  versionText: {
    fontSize: 14,
    color: COLORS.charcoal,
    fontWeight: "500",
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.charcoal,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.emerald,
    marginBottom: 12,
  },
  featureCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  featureCardExpanded: {
    borderColor: COLORS.gold,
  },
  featureHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.charcoal,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
  featureBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  feedbackButton: {
    flexDirection: "row",
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 8,
  },
  feedbackIcon: {
    marginRight: 4,
  },
  feedbackText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.charcoal,
  },
  footerText: {
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 20,
  },
});