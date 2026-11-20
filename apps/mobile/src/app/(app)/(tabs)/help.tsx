import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { config } from '@/lib/config';
import { Header, TextLink } from '@/ui/components';
import { colors, layout, type } from '@/ui/theme';

/** "Help and how to" (Raj, 20 Nov 2026; not in the wires): how Kitty works, in sections you tap to open. */

const CONTACT = 'hello@thekitty.app';

interface Topic {
  q: string;
  a: string[];
}

const SECTIONS: { title: string; topics: Topic[] }[] = [
  {
    title: 'Getting started',
    topics: [
      {
        q: 'What Kitty does',
        a: [
          'Kitty collects everyone’s share before the bill arrives. You start a kitty, share one link on WhatsApp, and each friend pays you their share by UPI.',
          'Kitty never holds the money. It goes straight from each friend’s UPI app to your UPI ID.',
        ],
      },
      {
        q: 'Who needs the app',
        a: ['Only you, the organiser. Your friends open the link in their browser, pick their name and pay. They don’t install anything or sign up.'],
      },
    ],
  },
  {
    title: 'Starting a kitty',
    topics: [
      {
        q: 'Moment or goal',
        a: [
          'A moment is one occasion, like a dinner, a cab or tickets.',
          'A goal is something you save towards over weeks, like a trip or a gift. Friends can pay a goal in one go or in monthly parts.',
        ],
      },
      {
        q: 'Adding people',
        a: [
          'Tap “Add or edit people”. Pick from your contacts or type a name. Their mobile number is optional; it lets you message them on WhatsApp.',
          'Set each person’s food (veg or non-veg) and whether they drink. Kitty uses this when you scan the bill.',
          'Paying for someone else, like a child? Under “Who pays for them”, pick the person who pays. They’re asked for both shares together.',
        ],
      },
      {
        q: 'Changing amounts',
        a: [
          'Kitty splits the total equally. Tap “Adjust” to set someone’s amount by hand; the rest is split among everyone else.',
          'Have the bill already? Scan it before sharing and Kitty works out exact shares: veg eaters don’t pay for non-veg dishes, and only drinkers pay for alcohol.',
        ],
      },
    ],
  },
  {
    title: 'Sharing and getting paid',
    topics: [
      {
        q: 'Sharing the link',
        a: ['Tap “Share on WhatsApp” and pick your group, or copy the link. Everyone gets the same link and picks their own name.'],
      },
      {
        q: 'Confirming payments',
        a: [
          'When a friend taps “I’ve paid”, you get a notification and they show in Activity. Check your UPI app, then tap “Yes, it arrived”.',
          'If it hasn’t arrived, tap “Not yet”. They’re asked to check and can send you their UPI reference.',
        ],
      },
      {
        q: 'Nudging',
        a: [
          'In a kitty, tap “Nudge” next to anyone who hasn’t paid. Kitty opens WhatsApp with a friendly message and a link that opens with their name ready.',
          'Switch on reminders to get a notification the day before and on the pay by date, listing who still has to pay.',
        ],
      },
      {
        q: 'Seeing someone’s share',
        a: ['Tap anyone’s name in a kitty to see their food and drink, their share, and how it was worked out.'],
      },
      {
        q: 'Changing a kitty after sharing',
        a: [
          'Until anyone pays, tap “Edit the amounts or people” in the kitty. The link stays the same and everyone sees the new amounts.',
          'Once someone has paid, amounts lock. Use the final bill to settle up instead.',
        ],
      },
    ],
  },
  {
    title: 'The bill and settling up',
    topics: [
      {
        q: 'Scanning the bill',
        a: [
          'Tap “Scan the bill” and photograph it, up to three photos for a long one. Kitty reads each line and sorts it into veg, non-veg or alcohol.',
          'Check the lines and tap a tag if Kitty got one wrong. Lines Kitty isn’t sure about are asked first.',
        ],
      },
      {
        q: 'Top-ups and refunds',
        a: [
          'After the meal, scan or type the final bill. Kitty works out who owes a bit more and who gets money back.',
          'Tap “Ask” to message someone for a top-up. For refunds, send the money by UPI and tap “Mark sent”.',
          'If nobody has paid yet, scanning the bill simply replaces everyone’s share.',
        ],
      },
    ],
  },
  {
    title: 'Goals and monthly parts',
    topics: [
      {
        q: 'How parts work',
        a: [
          'Choose “In parts” and how many months. Each share is split into equal monthly parts, the last on the pay by date.',
          'Friends pay one part at a time, and you confirm each one. You get a reminder three days before each part is due.',
        ],
      },
    ],
  },
  {
    title: 'What your friends see',
    topics: [
      {
        q: 'Paying',
        a: [
          'They pick their name and see their share. The easiest way to pay is the QR code: take a screenshot, then scan it from photos in GPay, PhonePe or Paytm.',
          'Some UPI apps refuse payment buttons to personal UPI IDs with a “bank limit” message. Scanning the QR code works.',
        ],
      },
      {
        q: 'How their share was worked out',
        a: ['They see the breakdown by veg, non-veg and alcohol, can view the receipt, and see everyone’s share before paying.'],
      },
    ],
  },
  {
    title: 'Your account',
    topics: [
      {
        q: 'Your details and UPI ID',
        a: ['Tap the You picture at the top right to change your name, mobile number or UPI ID, log out, or delete your account.'],
      },
      {
        q: 'Updates',
        a: ['Kitty updates itself. A new version downloads when you open the app and starts the next time. Your details screen shows which version you have.'],
      },
    ],
  },
];

export default function Help() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Help" />
      <ScrollView contentContainerStyle={styles.body}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[type.label, styles.sectionTitle]}>{section.title.toUpperCase()}</Text>
            <View style={styles.list}>
              {section.topics.map((t) => {
                const key = `${section.title}:${t.q}`;
                const isOpen = open === key;
                return (
                  <View key={key} style={styles.topic}>
                    <Pressable
                      onPress={() => setOpen(isOpen ? null : key)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      style={styles.question}
                    >
                      <Text style={[type.bodyInk, styles.flex]}>{t.q}</Text>
                      <Text style={type.bodyInk}>{isOpen ? '−' : '+'}</Text>
                    </Pressable>
                    {isOpen ? (
                      <View style={styles.answer}>
                        {t.a.map((p) => (
                          <Text key={p} style={type.body}>
                            {p}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={[type.label, styles.sectionTitle]}>PRIVACY AND CONTACT</Text>
          <Text style={[type.body, styles.contact]}>Questions, problems or ideas? Email us and a person replies.</Text>
          <View style={styles.links}>
            <TextLink onPress={() => Linking.openURL(`mailto:${CONTACT}`)}>{CONTACT}</TextLink>
            <TextLink onPress={() => Linking.openURL(`${config.memberPageUrl}/privacy`)}>Privacy policy</TextLink>
            <TextLink onPress={() => Linking.openURL(`${config.memberPageUrl}/terms`)}>Terms of use</TextLink>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  body: { padding: layout.gutter, paddingBottom: 40 },
  flex: { flex: 1 },
  section: { marginBottom: 28 },
  sectionTitle: { marginBottom: 10 },
  list: { borderTopWidth: layout.border, borderTopColor: colors.line },
  topic: { borderBottomWidth: layout.border, borderBottomColor: colors.line },
  question: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 12 },
  answer: { paddingBottom: 14, gap: 10 },
  contact: { marginBottom: 12 },
  links: { gap: 12, alignItems: 'flex-start' },
});
