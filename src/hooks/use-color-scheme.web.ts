import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * useSyncExternalStore returns false during the server/static render and true after hydration.
 */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const colorScheme = useRNColorScheme();

  if (hydrated) {
    return colorScheme;
  }

  return 'light';
}
