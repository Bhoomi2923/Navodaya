import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { CLUSTER_PNG, GalaxyCluster } from '@/components/GalaxyCluster';
import { ELLIPTICAL_PNG, GalaxyElliptical } from '@/components/GalaxyElliptical';
import { GalaxySpiral, SPIRAL_PNG } from '@/components/GalaxySpiral';
import type { GalaxyColors, GalaxyType } from '@/constants/galaxies';

const GALAXY_ART_SOURCE = {
  spiral: SPIRAL_PNG,
  elliptical: ELLIPTICAL_PNG,
  cluster: CLUSTER_PNG,
};

/** Resolve a galaxy type to its bundled PNG and warm the expo-image cache. */
export function prefetchGalaxyArt(type: GalaxyType) {
  const asset = Asset.fromModule(GALAXY_ART_SOURCE[type]);
  const url = asset.localUri ?? asset.uri;
  if (url) void Image.prefetch(url);
}

export interface GalaxyArtProps {
  type: GalaxyType;
  /** Section palette; accepted for API compatibility (art colours are baked in). */
  colors?: GalaxyColors;
  /** Width & height of the square artwork. */
  size: number;
  /** Seed for the deterministic particle layout. */
  seed?: number;
  /** Pause/resume the art's animation loops. */
  active?: boolean;
  /** expo-image load priority (high for the first card, low for the rest). */
  imagePriority?: 'low' | 'normal' | 'high' | null;
}

/**
 * Dispatches to the procedurally rendered galaxy PNG for each type.
 * No photos, no disc mask — the galaxy floats on the space background.
 */
export function GalaxyArt({
  type,
  size,
  seed = 11,
  active = true,
  imagePriority,
}: GalaxyArtProps) {
  return (
    <View style={{ width: size, height: size }}>
      {type === 'spiral' ? (
        <GalaxySpiral size={size} seed={seed} active={active} imagePriority={imagePriority} />
      ) : type === 'elliptical' ? (
        <GalaxyElliptical size={size} seed={seed} active={active} imagePriority={imagePriority} />
      ) : (
        <GalaxyCluster size={size} seed={seed} active={active} imagePriority={imagePriority} />
      )}
    </View>
  );
}
