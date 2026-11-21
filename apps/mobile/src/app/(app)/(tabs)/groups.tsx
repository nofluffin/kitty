import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Header } from '@/ui/components';
import { GroupsList } from '@/ui/groups-list';
import { colors, page } from '@/ui/theme';

/** The Groups tab (Raj, 20 Nov 2026): your saved groups, to star, share or leave, and New group. */
export default function Groups() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Groups" />
      <ScrollView contentContainerStyle={styles.body}>
        <GroupsList />
      </ScrollView>
      <View style={styles.footer}>
        <Button onPress={() => router.push('/new-group')}>New group</Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  body: page.body,
  footer: page.footer,
});
