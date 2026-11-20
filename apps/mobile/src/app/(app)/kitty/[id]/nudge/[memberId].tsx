import { describeDay, formatRupees, groupReminderMessage, nudgeMessage, whatsAppUrl } from '@kitty/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { config } from '@/lib/config';
import { explainFailure } from '@/lib/errors';
import { loadFeed, setReminder, type FeedKitty, type FeedMember } from '@/lib/feed';
import { Body, Button, CenteredState, ErrorText, Label, Note, Screen, SmallButton, TextLink } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

/**
 * Screen 23. Kitty doesn't message anyone itself in v1 (spec section 9):
 * it opens WhatsApp with the text ready, and the organiser sends it.
 */
export default function Nudge() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId: string }>();
  const [data, setData] = useState<{ kitty: FeedKitty; member: FeedMember } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    loadFeed(id)
      .then((kitty) => {
        const member = kitty.members.find((m) => m.id === memberId);
        if (!current) return;
        if (member) setData({ kitty, member });
        else setFailed(true);
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [id, memberId]);

  if (!data) {
    return (
      <Screen title="Nudge" back>
        {failed ? <CenteredState title="Couldn’t load this kitty" body="Go back and try again." /> : <CenteredState />}
      </Screen>
    );
  }
  return <NudgeReady kitty={data.kitty} member={data.member} />;
}

/** Opens WhatsApp. Falls back to the phone's share sheet when WhatsApp can't open. */
async function openWhatsApp(url: string, text: string) {
  try {
    await Linking.openURL(url);
  } catch {
    if (Platform.OS !== 'web') await Share.share({ message: text });
  }
}

function NudgeReady({ kitty, member }: { kitty: FeedKitty; member: FeedMember }) {
  const link = `${config.memberPageUrl}/k/${kitty.slug}`;
  const [words, setWords] = useState(
    nudgeMessage({
      memberName: member.name,
      title: kitty.title,
      amountPaise: member.parts?.next?.amountPaise ?? member.askPaise,
      link,
      part: member.parts?.next ? { partNumber: member.parts.next.partNumber, partsCount: member.parts.total, dueDate: member.parts.next.dueDate } : undefined,
    }).slice(0, -link.length).trimEnd(),
  );
  const [editing, setEditing] = useState(false);
  const [dayBefore, setDayBefore] = useState(kitty.remindDayBefore);
  const [onDay, setOnDay] = useState(kitty.remindOnDay);
  const [error, setError] = useState<string | null>(null);
  const text = `${words.trim()} ${link}`;

  const opened = member.lastOpenedAt
    ? `${member.name} opened the link ${describeDay(new Date(member.lastOpenedAt))} but hasn’t paid.`
    : `${member.name} hasn’t opened the link yet.`;

  async function toggle(which: 'dayBefore' | 'onDay', on: boolean) {
    setError(null);
    (which === 'dayBefore' ? setDayBefore : setOnDay)(on);
    const e = await setReminder(kitty.id, which, on);
    if (e) {
      (which === 'dayBefore' ? setDayBefore : setOnDay)(!on);
      setError(await explainFailure(e, 'save the reminder'));
    }
  }

  const direct = member.phone ? whatsAppUrl(member.phone, text) : null;

  return (
    <Screen title={`Nudge ${member.name}`} back>
      <Body>{opened}</Body>

      <View style={styles.section}>
        <Label>Message preview</Label>
        <View style={styles.preview}>
          {editing ? (
            <TextInput value={words} onChangeText={setWords} multiline autoFocus accessibilityLabel="Message" style={[type.bodyInk, styles.editor]} />
          ) : (
            <Text style={[type.bodyInk, styles.message]}>{text}</Text>
          )}
          <View style={styles.editButton}>
            <SmallButton onPress={() => setEditing((e) => !e)}>{editing ? 'Done editing' : 'Edit message'}</SmallButton>
          </View>
        </View>
      </View>

      <View style={styles.buttons}>
        <Button onPress={() => openWhatsApp(direct ?? `https://wa.me/?text=${encodeURIComponent(text)}`, text)}>
          {`Send to ${member.name} on WhatsApp`}
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            const group = groupReminderMessage({ title: kitty.title, link });
            openWhatsApp(`https://wa.me/?text=${encodeURIComponent(group)}`, group);
          }}
        >
          Post a reminder in the group instead
        </Button>
        <View style={styles.cash}>
          <TextLink onPress={() => router.replace({ pathname: '/kitty/[id]/confirm/[memberId]', params: { id: kitty.id, memberId: member.id } })}>
            {`${member.name} paid you another way? Confirm ${formatRupees(member.parts?.next?.amountPaise ?? member.askPaise)}`}
          </TextLink>
        </View>
      </View>

      <View style={styles.reminders}>
        <Label>Reminders</Label>
        <ToggleRow label="Remind me the day before" on={dayBefore} onChange={(v) => toggle('dayBefore', v)} />
        <ToggleRow label="Remind me on the day" on={onDay} onChange={(v) => toggle('onDay', v)} />
        <ErrorText>{error}</ErrorText>
      </View>

      <View style={styles.note}>
        <Note>Kitty doesn’t message friends itself in v1. It prompts you, and you send the nudge from your own WhatsApp.</Note>
      </View>
    </Screen>
  );
}

/** On/Off pill, 63 x 43 (screen 23). */
function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[type.bodyInk, styles.flex]}>{label}</Text>
      <Pressable
        onPress={() => onChange(!on)}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: on }}
        style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
      >
        <Text style={[type.meta, on && styles.onDark]}>{on ? 'On' : 'Off'}</Text>
      </Pressable>
    </View>
  );
}

// Measured from screen 23.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: 24 },
  preview: { marginTop: 12, backgroundColor: colors.surface, borderWidth: layout.border, borderColor: colors.line, padding: layout.cardPadding },
  message: { lineHeight: 24 },
  editor: { minHeight: 96, textAlignVertical: 'top', lineHeight: 24 },
  editButton: { marginTop: 16, alignSelf: 'flex-start' },
  buttons: { marginTop: 12, gap: 12 },
  cash: { alignItems: 'center', marginTop: 4 },
  reminders: { marginTop: 28 },
  toggleRow: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: layout.border,
    borderBottomColor: colors.line,
  },
  pill: { width: 63, height: 43, borderRadius: 21.5, alignItems: 'center', justifyContent: 'center', borderWidth: layout.border },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillOff: { backgroundColor: colors.surface, borderColor: colors.line },
  onDark: { color: colors.inkOnDark },
  note: { marginTop: 28 },
});
