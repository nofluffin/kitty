import { normaliseIndianMobile, type Diet } from '@kitty/core';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Someone with this name in the organiser's groups or past kitties: their tags come too. */
export interface KnownPerson {
  name: string;
  phone: string | null;
  diet: Diet;
  drinks: boolean;
}

/** A contact on the phone whose name matches what was said. */
export interface ContactMatch {
  name: string;
  phone: string | null;
}

export async function findKnown(name: string): Promise<KnownPerson[]> {
  const [g, k] = await Promise.all([
    supabase.from('group_members').select('name, phone, diet, drinks, profile_id').ilike('name', name),
    supabase.from('members').select('name, phone, diet, drinks, is_organiser, created_at').ilike('name', name).order('created_at', { ascending: false }).limit(20),
  ]);
  const all: KnownPerson[] = [
    ...(g.data ?? []).filter((p) => !p.profile_id).map((p) => ({ name: p.name, phone: p.phone, diet: p.diet as Diet, drinks: p.drinks })),
    ...(k.data ?? []).filter((p) => !p.is_organiser).map((p) => ({ name: p.name, phone: p.phone, diet: p.diet as Diet, drinks: p.drinks })),
  ];
  // One entry per person: the same number, or the same name with no number.
  const seen = new Map<string, KnownPerson>();
  for (const p of all) {
    const key = p.phone ?? `name:${p.name.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
}

let contactsAllowed: boolean | null = null;

/**
 * Contacts on this phone matching a spoken name (Raj, 20 Nov 2026). Asks for contacts
 * permission the first time. The search runs on the phone; only the people the
 * organiser adds are saved.
 */
export async function searchContacts(name: string): Promise<ContactMatch[]> {
  if (Platform.OS === 'web') return [];
  const Contacts = await import('expo-contacts/legacy');
  if (contactsAllowed === null) {
    const { status } = await Contacts.requestPermissionsAsync();
    contactsAllowed = status === 'granted';
  }
  if (!contactsAllowed) return [];
  const first = name.split(/\s+/)[0] ?? name;
  const { data } = await Contacts.getContactsAsync({ name: first, fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
  const wanted = name.toLowerCase().split(/\s+/);
  return data
    .filter((c) => {
      const full = (c.name ?? '').toLowerCase();
      return wanted.every((w) => full.includes(w));
    })
    .slice(0, 8)
    .map((c) => ({
      name: c.name ?? name,
      phone: (c.phoneNumbers ?? []).map((p) => normaliseIndianMobile(p.number ?? p.digits ?? '')).find((n): n is string => !!n) ?? null,
    }));
}
