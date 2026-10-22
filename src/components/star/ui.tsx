import { Pressable, StyleSheet, Text } from 'react-native';

import { FontFamily } from '@/constants/config';

/** Big friendly pill button used across star phases. */
export function PrimaryButton({
  label,
  onPress,
  tone = 'gold',
}: {
  label: string;
  onPress: () => void;
  tone?: 'gold' | 'violet' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        tone === 'gold' && styles.gold,
        tone === 'violet' && styles.violet,
        tone === 'ghost' && styles.ghost,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}>
      <Text style={[styles.label, tone === 'ghost' && styles.ghostLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    minWidth: 160,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  gold: {
    backgroundColor: 'rgba(255, 214, 110, 0.16)',
    borderColor: 'rgba(255, 214, 110, 0.65)',
    boxShadow: '0 0 22px rgba(255, 214, 110, 0.35)',
  },
  violet: {
    backgroundColor: 'rgba(155, 92, 255, 0.18)',
    borderColor: 'rgba(196, 181, 253, 0.55)',
    boxShadow: '0 0 22px rgba(155, 92, 255, 0.35)',
  },
  ghost: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  label: {
    fontFamily: FontFamily.bold,
    color: '#FFE9B3',
    fontSize: 16,
  },
  ghostLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: FontFamily.semiBold,
  },
});
