import type { Diet } from './types';

/**
 * Adding people by voice (Raj, 20 Nov 2026): "Devika, veg, alcohol, Kabir non-veg
 * no alcohol and Meera" becomes three people. Food and drink are only set when said;
 * anything missing is asked on screen, or filled in from the organiser's groups.
 */
export interface SpokenPerson {
  name: string;
  diet?: Diet;
  drinks?: boolean;
}

const NO_DRINK = [
  /\bno (alcohol|drinks?|drinking|booze)\b/g,
  /\b(doesn'?t|does not|don'?t|do not|won'?t|will not) drink\b/g,
  /\bnot (a )?drink(ing|er)?\b/g,
  /\bnon[- ]?(alcoholic|drinker)\b/g,
  /\b(teetotal(l?er)?|sober|dry)\b/g,
];
const DRINK = [/\b(alcohol|drinks?|drinker|drinking|beer|wine|booze)\b/g];
const NON_VEG = [/\bnon[- ]?veg(etarian|gie)?\b/g, /\b(meat|eats meat|chicken|fish)\b/g];
const VEG = [/\b(veg|vegetarian|veggie|vegan|jain)\b/g];
const FILLER = /\b(and|is|are|she|he|they|who|eats|eat|also|plus|with|my|friend|please|add|um|uh)\b/g;

function take(text: string, patterns: RegExp[]): { found: boolean; rest: string } {
  let found = false;
  let rest = text;
  for (const p of patterns) {
    rest = rest.replace(p, () => {
      found = true;
      return ' ';
    });
  }
  return { found, rest };
}

const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase('en-IN') + w.slice(1))
    .join(' ');

export function parseSpokenPeople(spoken: string): SpokenPerson[] {
  // Pieces between commas, full stops and "and"/"then". A piece with only food or
  // drink words belongs to the person before it ("Devika, veg, alcohol").
  const pieces = spoken
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[,.;\n]+|\s+(?:and|then|also)\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const people: SpokenPerson[] = [];
  for (const piece of pieces) {
    const noDrink = take(piece, NO_DRINK);
    const drink = take(noDrink.rest, DRINK);
    const nonVeg = take(drink.rest, NON_VEG);
    const veg = take(nonVeg.rest, VEG);
    const name = titleCase(veg.rest.replace(FILLER, ' ').replace(/[^\p{L}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim());

    const tags: Omit<SpokenPerson, 'name'> = {
      ...(nonVeg.found ? { diet: 'nonveg' as const } : veg.found ? { diet: 'veg' as const } : {}),
      ...(noDrink.found ? { drinks: false } : drink.found ? { drinks: true } : {}),
    };

    if (name) {
      people.push({ name, ...tags });
    } else if (people.length > 0) {
      Object.assign(people[people.length - 1]!, tags);
    }
  }
  return people;
}
