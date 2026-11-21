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

let contactsAccess: 'all' | 'limited' | 'none' | null = null;

/** Whether the phone gave Kitty all contacts, only some (iPhone "limited"), or none. */
export function contactsAccessLevel() {
  return contactsAccess;
}

/**
 * Contacts on this phone matching a spoken name (Raj, 20–21 Nov 2026). Asks for contacts
 * permission the first time. The search runs on the phone; only the people the organiser
 * adds are saved. Contacts matching every spoken word come first ("Biba Bajaj"), then
 * ones matching the first name ("Biba B").
 */
export async function searchContacts(name: string): Promise<(ContactMatch & { exact: boolean })[]> {
  if (Platform.OS === 'web') return [];
  const Contacts = await import('expo-contacts/legacy');
  if (contactsAccess === null) {
    const permission = await Contacts.requestPermissionsAsync();
    contactsAccess = permission.status !== 'granted' ? 'none' : permission.accessPrivileges === 'limited' ? 'limited' : 'all';
  }
  if (contactsAccess === 'none') return [];
  const wanted = name.toLowerCase().split(/\s+/).filter(Boolean);
  const first = wanted[0] ?? '';
  const { data } = await Contacts.getContactsAsync({ name: first, fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
  return data
    .map((c) => {
      const full = (c.name ?? '').toLowerCase();
      const hits = wanted.filter((w) => full.includes(w)).length;
      const phone =
        (c.phoneNumbers ?? []).map((p) => normaliseIndianMobile(p.number ?? p.digits ?? '')).find((n): n is string => !!n) ?? null;
      return { name: c.name ?? name, phone, hits, exact: hits === wanted.length };
    })
    .filter((c) => c.hits > 0)
    .sort((a, b) => b.hits - a.hits || Number(!!b.phone) - Number(!!a.phone))
    .slice(0, 8)
    .map(({ hits: _hits, ...c }) => c);
}

/** "Pick from contacts" on a voice card: the system picker, one person, no search permission needed. */
export async function pickContact(): Promise<ContactMatch | null> {
  if (Platform.OS === 'web') return null;
  const { presentContactPickerAsync } = await import('expo-contacts/legacy');
  const c = await presentContactPickerAsync();
  if (!c) return null;
  const phones = [...(c.phoneNumbers ?? [])].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  return {
    name: c.name || [c.firstName, c.lastName].filter(Boolean).join(' '),
    phone: phones.map((p) => normaliseIndianMobile(p.number ?? p.digits ?? '')).find((n): n is string => !!n) ?? null,
  };
}
