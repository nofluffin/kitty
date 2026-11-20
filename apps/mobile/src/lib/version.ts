import { formatClock } from '@kitty/core';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Which version is running, for the You tab (Raj, 20 Nov 2026), so it's easy to tell
 * whether an over-the-air update has arrived. Three lines: app version, build, update.
 */
export function versionLines(): string[] {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  if (Platform.OS === 'web') return [`Kitty ${version}, web`];

  const build = Updates.runtimeVersion ? `Build ${Updates.runtimeVersion.slice(0, 7)}` : 'Development build';
  if (Updates.isEmbeddedLaunch || !Updates.updateId || !Updates.createdAt) {
    return [`Kitty ${version}`, build, 'No over-the-air update yet'];
  }
  const d = Updates.createdAt;
  const when = `${d.getDate()} ${MONTHS[d.getMonth()]}, ${formatClock(d)}`;
  return [`Kitty ${version}`, build, `Update from ${when} (${Updates.updateId.slice(0, 7)})`];
}
