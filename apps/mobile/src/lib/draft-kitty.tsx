import {
  adjustedSplit,
  isEqualSplit,
  parseRupees,
  type AdjustError,
  type Diet,
  type MemberShare,
  type Paise,
} from '@kitty/core';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * The kitty being made on screens 2, 3 and 4. Nothing is saved until
 * "Create kitty", so leaving the flow throws it away.
 */

export interface DraftPerson {
  /** Local id for lists and editing. Not a database id. */
  key: string;
  name: string;
  /** E.164, e.g. +919876543210. Optional. */
  phone: string | null;
  isOrganiser: boolean;
  diet: Diet;
  drinks: boolean;
  /** Set when the organiser typed this person's amount on screen 4. */
  fixedPaise: Paise | null;
}

export type DraftPersonInput = Omit<DraftPerson, 'key' | 'fixedPaise'>;

export type Split =
  | { state: 'no-total' }
  | { state: 'no-people' }
  | { state: 'error'; error: AdjustError }
  | {
      state: 'ok';
      shares: (MemberShare & { fixed: boolean })[];
      equal: boolean;
      remainderPaise: Paise;
      unfixedCount: number;
    };

interface DraftKitty {
  title: string;
  setTitle: (t: string) => void;
  totalText: string;
  setTotalText: (t: string) => void;
  totalPaise: Paise | null;
  dueDate: string | null;
  setDueDate: (d: string) => void;
  upiId: string;
  setUpiId: (u: string) => void;
  people: DraftPerson[];
  addPerson: (p: DraftPersonInput) => void;
  updatePerson: (key: string, p: DraftPersonInput) => void;
  removePerson: (key: string) => void;
  setFixed: (key: string, paise: Paise | null) => void;
  resetFixed: () => void;
  split: Split;
}

const Context = createContext<DraftKitty | null>(null);

let nextKey = 1;
const newKey = () => `p${nextKey++}`;

export function describePerson(p: Pick<DraftPerson, 'diet' | 'drinks'>): string {
  return `${p.diet === 'veg' ? 'Veg' : 'Non-veg'}, ${p.drinks ? 'drinks' : "doesn't drink"}`;
}

export function DraftKittyProvider({
  organiserName,
  upiId: initialUpi,
  children,
}: {
  organiserName: string;
  upiId: string;
  children: ReactNode;
}) {
  const [title, setTitle] = useState('');
  const [totalText, setTotalText] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [upiId, setUpiId] = useState(initialUpi);
  // The organiser is in their own kitty by default and can remove themselves (spec section 3).
  const [people, setPeople] = useState<DraftPerson[]>(() => [
    { key: newKey(), name: organiserName || 'You', phone: null, isOrganiser: true, diet: 'veg', drinks: false, fixedPaise: null },
  ]);

  const totalPaise = useMemo(() => {
    const p = parseRupees(totalText);
    return p && p > 0 ? p : null;
  }, [totalText]);

  const addPerson = useCallback((p: DraftPersonInput) => {
    setPeople((list) => [...list, { ...p, key: newKey(), fixedPaise: null }]);
  }, []);
  const updatePerson = useCallback((key: string, p: DraftPersonInput) => {
    setPeople((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));
  }, []);
  const removePerson = useCallback((key: string) => {
    setPeople((list) => list.filter((x) => x.key !== key));
  }, []);
  const setFixed = useCallback((key: string, paise: Paise | null) => {
    setPeople((list) => list.map((x) => (x.key === key ? { ...x, fixedPaise: paise } : x)));
  }, []);
  const resetFixed = useCallback(() => {
    setPeople((list) => list.map((x) => ({ ...x, fixedPaise: null })));
  }, []);

  const split = useMemo<Split>(() => {
    if (people.length === 0) return { state: 'no-people' };
    if (totalPaise === null) return { state: 'no-total' };
    const r = adjustedSplit(
      totalPaise,
      people.map((p) => ({ id: p.key, fixedPaise: p.fixedPaise })),
    );
    if (!r.ok) return { state: 'error', error: r.error };
    return {
      state: 'ok',
      shares: r.value.shares,
      equal: isEqualSplit(r.value.shares.map((s) => s.sharePaise)),
      remainderPaise: r.value.remainderPaise,
      unfixedCount: r.value.unfixedCount,
    };
  }, [people, totalPaise]);

  const value = useMemo(
    () => ({
      title,
      setTitle,
      totalText,
      setTotalText,
      totalPaise,
      dueDate,
      setDueDate,
      upiId,
      setUpiId,
      people,
      addPerson,
      updatePerson,
      removePerson,
      setFixed,
      resetFixed,
      split,
    }),
    [title, totalText, totalPaise, dueDate, upiId, people, addPerson, updatePerson, removePerson, setFixed, resetFixed, split],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDraftKitty(): DraftKitty {
  const v = useContext(Context);
  if (!v) throw new Error('useDraftKitty must be used inside DraftKittyProvider');
  return v;
}
