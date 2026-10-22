import { StyleSheet, Text, View } from 'react-native';

import { Sparkle } from '@/components/StarField';
import { FontFamily, getDaysToExam } from '@/constants/config';

/** Centred countdown block under the top bar. */
export function Hero() {
  const days = getDaysToExam();

  return (
    <View style={styles.wrap}>
      <View style={styles.kickerRow}>
        <Sparkle size={10} color="#A78BFA" />
        <Text style={styles.kicker}>READY, SET... EXPLORE!</Text>
      </View>
      <Text style={styles.title}>{days === 0 ? 'Exam day!' : `${days} days to go`}</Text>
      <View style={styles.kickerRow}>
        <Text style={styles.subtitle}>One small step. One bright discovery.</Text>
        <Sparkle size={9} color="#8BE9FD" opacity={0.8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 8,
    gap: 10,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kicker: {
    fontFamily: FontFamily.semiBold,
    color: '#B794F6',
    fontSize: 11,
    letterSpacing: 4,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    color: '#FFFFFF',
    fontSize: 40,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    color: 'rgba(226, 232, 255, 0.72)',
    fontSize: 13,
    textAlign: 'center',
  },
});
