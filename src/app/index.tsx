import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { prefetchGalaxyArt } from '@/components/GalaxyArt';
import { GalaxyCard } from '@/components/GalaxyCard';
import { Hero } from '@/components/Hero';
import { StarField } from '@/components/StarField';
import { TopBar } from '@/components/TopBar';
import { GALAXIES } from '@/constants/galaxies';
import { useLazyCards } from '@/lib/useLazyCards';

const MAX_COLUMN_WIDTH = 480;

export default function HomeScreen() {
  const { width, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columnWidth = Math.min(width, MAX_COLUMN_WIDTH);
  const artSize = Math.min(columnWidth * 0.52, 220);
  // The spiral card's art runs a bit larger than the others.
  const spiralSize = Math.min(columnWidth * 0.9, 360);
  const ellipticalSize = Math.min(columnWidth * 0.9, 360);
  const clusterSize = Math.min(columnWidth * 0.9, 360);
  const [bg, setBg] = useState({ width: 0, height: 0 });
  const [skyReady, setSkyReady] = useState(false);
  const [skyFade] = useState(() => new Animated.Value(0));

  const lazy = useLazyCards(GALAXIES.length, windowHeight);

  // Render the shared star layer two frames in, then fade it in, so the hero
  // and the first card appear immediately. A plain timeout guarantees the sky
  // can never stay hidden if the frames are delayed.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setSkyReady(true);
        Animated.timing(skyFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }).start();
      });
    });
    const failSafe = setTimeout(() => {
      setSkyReady(true);
      skyFade.setValue(1);
    }, 600);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(failSafe);
    };
  }, [skyFade]);

  // Warm the next card's image cache slightly early to avoid pop-in.
  useEffect(() => {
    lazy.mounted.forEach((m, i) => {
      const next = GALAXIES[i + 1];
      if (m && next) prefetchGalaxyArt(next.type);
    });
  }, [lazy.mounted]);

  return (
    <View style={styles.root}>
      {/* Deep indigo-to-purple backdrop filling the whole window. */}
      <LinearGradient
        colors={['#07031A', '#120A3A', '#1E0F4F', '#2A1470', '#1B1550']}
        locations={[0, 0.25, 0.55, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <TopBar />
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={lazy.onScroll}
          scrollEventThrottle={64}>
          <View
            style={[styles.page, { paddingBottom: insets.bottom + 16 }]}
            onLayout={(e) =>
              setBg({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
            }>
            {/* One shared space layer spanning the whole scrollable page. */}
            {bg.height > 0 && skyReady && (
              <Animated.View
                style={[StyleSheet.absoluteFill, { opacity: skyFade }]}
                pointerEvents="none">
                <StarField width={bg.width} height={bg.height} />
              </Animated.View>
            )}
            <View style={[styles.column, { width: columnWidth }]}>
              <Hero />
              {GALAXIES.map((galaxy, index) => (
                <View
                  key={galaxy.id}
                  style={[styles.cardWrap, index === 0 && { marginTop: 8 }]}
                  onLayout={(e) =>
                    lazy.registerLayout(
                      index,
                      e.nativeEvent.layout.y,
                      e.nativeEvent.layout.height
                    )
                  }>
                  <GalaxyCard
                    galaxy={galaxy}
                    size={
                      galaxy.type === 'spiral'
                        ? spiralSize
                        : galaxy.type === 'elliptical'
                          ? ellipticalSize
                          : galaxy.type === 'cluster'
                            ? clusterSize
                            : artSize
                    }
                    isLast={index === GALAXIES.length - 1}
                    mounted={lazy.mounted[index]}
                    active={lazy.active[index]}
                    imagePriority={index === 0 ? 'high' : 'low'}
                  />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#070420',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  page: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  column: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    overflow: 'visible',
  },
  cardWrap: {
    alignSelf: 'stretch',
    overflow: 'visible',
  },
});
