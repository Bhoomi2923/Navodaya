import { useLocalSearchParams } from 'expo-router';

import { StarSession } from '@/components/star/StarSession';

export default function StarScreen() {
  const { galaxy, index } = useLocalSearchParams<{ galaxy: string; index: string }>();
  return <StarSession galaxyId={String(galaxy)} starIndex={Number(index)} />;
}
