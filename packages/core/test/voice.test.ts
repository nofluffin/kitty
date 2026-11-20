import { describe, expect, it } from 'vitest';
import { parseSpokenPeople } from '../src';

describe('parseSpokenPeople', () => {
  it('reads Raj’s example', () => {
    expect(parseSpokenPeople('Devika, veg, alcohol')).toEqual([{ name: 'Devika', diet: 'veg', drinks: true }]);
  });

  it('reads several people, with and without tags', () => {
    expect(parseSpokenPeople('Devika veg alcohol, Kabir non veg no alcohol and Meera')).toEqual([
      { name: 'Devika', diet: 'veg', drinks: true },
      { name: 'Kabir', diet: 'nonveg', drinks: false },
      { name: 'Meera' },
    ]);
  });

  it('understands the ways people say it', () => {
    expect(parseSpokenPeople("Anil is vegetarian and doesn't drink. Sara eats meat, drinks")).toEqual([
      { name: 'Anil', diet: 'veg', drinks: false },
      { name: 'Sara', diet: 'nonveg', drinks: true },
    ]);
    expect(parseSpokenPeople('Tani Sadarangani non-veg teetotal')).toEqual([{ name: 'Tani Sadarangani', diet: 'nonveg', drinks: false }]);
  });

  it('keeps full names and ignores empty speech', () => {
    expect(parseSpokenPeople('Arpreet Bajaj')).toEqual([{ name: 'Arpreet Bajaj' }]);
    expect(parseSpokenPeople('  ')).toEqual([]);
  });
});
