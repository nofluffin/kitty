import type { Diet } from './types';

/**
 * Adding people by voice (Raj, 20–21 Nov 2026). Natural speech becomes a list:
 * "Please add Biba Bajaj vegetarian drinks, alcohol. Add a Api Bajaj non-vegetarian
 * doesn't drink alcohol, Gaurav Shrawat alcohol, veg etc" gives three people.
 * Food and drink are only set when said; anything missing is asked on screen,
 * or filled in from the organiser's groups.
 */
export interface SpokenPerson {
  name: string;
  diet?: Diet;
  drinks?: boolean;
}

type Tag = { diet: Diet } | { drinks: boolean };

// Longest phrases first, so "doesn't drink alcohol" wins over "alcohol".
const PHRASES: [string, Tag][] = (
  [
    ["doesn't drink alcohol", { drinks: false }],
    ['does not drink alcohol', { drinks: false }],
    ["don't drink alcohol", { drinks: false }],
    ["doesn't drink", { drinks: false }],
    ['does not drink', { drinks: false }],
    ["don't drink", { drinks: false }],
    ["won't drink", { drinks: false }],
    ['no alcohol', { drinks: false }],
    ['no drinks', { drinks: false }],
    ['no drink', { drinks: false }],
    ['not drinking', { drinks: false }],
    ['non alcoholic', { drinks: false }],
    ['non drinker', { drinks: false }],
    ['teetotaller', { drinks: false }],
    ['teetotaler', { drinks: false }],
    ['teetotal', { drinks: false }],
    ['sober', { drinks: false }],
    ['non vegetarian', { diet: 'nonveg' }],
    ['non veggie', { diet: 'nonveg' }],
    ['non veg', { diet: 'nonveg' }],
    ['nonveg', { diet: 'nonveg' }],
    ['eats meat', { diet: 'nonveg' }],
    ['meat', { diet: 'nonveg' }],
    ['chicken', { diet: 'nonveg' }],
    ['fish', { diet: 'nonveg' }],
    ['vegetarian', { diet: 'veg' }],
    ['veggie', { diet: 'veg' }],
    ['vegan', { diet: 'veg' }],
    ['jain', { diet: 'veg' }],
    ['veg', { diet: 'veg' }],
    ['alcohol', { drinks: true }],
    ['drinker', { drinks: true }],
    ['drinking', { drinks: true }],
    ['drinks', { drinks: true }],
    ['drink', { drinks: true }],
    ['beer', { drinks: true }],
    ['wine', { drinks: true }],
    ['booze', { drinks: true }],
  ] as [string, Tag][]
).map(([p, t]) => [p, t] as [string, Tag]);

/** Words that start a new person after them ("Kabir and Meera", "add Devika"). */
const BOUNDARY = new Set(['and', 'then', 'also', 'plus', 'add', 'please', 'next', ',']);
/** Words that are never part of a name. */
const FILLER = new Set([
  'a', 'an', 'the', 'is', 'are', 'she', 'he', 'they', 'who', 'eats', 'eat', 'my', 'friend', 'friends',
  'um', 'uh', 'etc', 'etcetera', 'ok', 'okay', 'so', 'on', 'with', 'person', 'people', 'too', 'both',
]);

const titleCase = (s: string) => s.charAt(0).toLocaleUpperCase('en-IN') + s.slice(1);

export function parseSpokenPeople(spoken: string): SpokenPerson[] {
  const words = spoken
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/-/g, ' ')
    .replace(/[,.;:!?\n]+/g, ' , ')
    .replace(/[^\p{L}\s',]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const people: SpokenPerson[] = [];
  let current: SpokenPerson | null = null;
  // A name word starts a new person after a boundary or after food and drink words.
  let startNew = true;

  for (let i = 0; i < words.length; ) {
    const phrase = PHRASES.find(([p]) => {
      const parts = p.split(' ');
      return parts.every((w, j) => words[i + j] === w);
    });
    if (phrase) {
      if (current) Object.assign(current, phrase[1]);
      startNew = true;
      i += phrase[0].split(' ').length;
      continue;
    }
    const word = words[i]!;
    i += 1;
    if (BOUNDARY.has(word)) {
      startNew = true;
      continue;
    }
    if (FILLER.has(word)) continue;
    if (startNew || !current) {
      current = { name: titleCase(word) };
      people.push(current);
      startNew = false;
    } else {
      current.name += ` ${titleCase(word)}`;
    }
  }
  return people;
}
