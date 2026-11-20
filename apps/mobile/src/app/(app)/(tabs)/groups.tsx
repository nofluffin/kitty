import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@/ui/components';
import { GroupsList } from '@/ui/groups-list';
import { colors, layout } from '@/ui/theme';

/** The Groups tab (Raj, 20 Nov 2026): your saved groups, to star, share or leave. */
export default function Groups() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Groups" />
      <ScrollView contentContainerStyle={styles.body}>
        <GroupsList />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  body: { padding: layout.gutter, paddingBottom: 40, flexGrow: 1 },
});
