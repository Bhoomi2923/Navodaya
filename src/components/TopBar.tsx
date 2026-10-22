import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sparkle } from '@/components/StarField';
import { FontFamily } from '@/constants/config';
import { useStarsTotal } from '@/lib/progress';

/** Fixed dark-translucent bar: logo on the left, actions on the right. */
export function TopBar() {
  const starsTotal = useStarsTotal();
  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <Sparkle size={26} color="#FFD66E" />
        <View>
          <Text style={styles.brandName}>NAVODAYA</Text>
          <Text style={styles.brandSub}>COSMOS</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Music"
          hitSlop={8}>
          <SymbolView
            name={{ ios: 'music.note', android: 'music_note', web: 'music_note' }}
            tintColor="#C7D2FE"
            size={18}
            style={styles.symbol}
          />
        </Pressable>

        <View style={styles.coinPill}>
          <Sparkle size={13} color="#FFD66E" />
          <Text style={styles.coinText}>{starsTotal}</Text>
        </View>

        <Pressable
          style={styles.profileButton}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          hitSlop={8}>
          <Sparkle size={15} color="#E9D5FF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(8, 5, 26, 0.72)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontFamily: FontFamily.extraBold,
    color: '#FFFFFF',
    fontSize: 15,
    letterSpacing: 2,
  },
  brandSub: {
    fontFamily: FontFamily.medium,
    color: '#A78BFA',
    fontSize: 9,
    letterSpacing: 5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    width: 18,
    height: 18,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 214, 110, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 110, 0.35)',
  },
  coinText: {
    fontFamily: FontFamily.bold,
    color: '#FFE9B3',
    fontSize: 13,
  },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(216, 180, 254, 0.4)',
  },
});
