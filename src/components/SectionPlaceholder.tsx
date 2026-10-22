import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sparkle, StarField } from '@/components/StarField';
import { FontFamily } from '@/constants/config';

/** Simple "coming soon" screen with the same night-sky backdrop and a back button. */
export function SectionPlaceholder({ name, color }: { name: string; color: string }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#070420', '#140B33', '#1E0B45']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <StarField />
      <SafeAreaView style={styles.center}>
        <Sparkle size={30} color={color} />
        <Text style={[styles.name, { color }]}>{name}</Text>
        <Text style={styles.subtitle}>Coming next</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            tintColor="#FFFFFF"
            size={15}
            style={styles.backIcon}
          />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#070420',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
  },
  name: {
    fontFamily: FontFamily.extraBold,
    fontSize: 32,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    color: 'rgba(226, 232, 255, 0.7)',
    fontSize: 14,
    letterSpacing: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  backIcon: {
    width: 15,
    height: 15,
  },
  backText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: 15,
  },
});
