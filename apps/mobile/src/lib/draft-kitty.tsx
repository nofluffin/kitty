import {
  adjustedSplit,
  formatRupees,
  isEqualSplit,
  parseRupees,
  type AdjustError,
  type Diet,
  type KittyKind,
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
  /** The database row, when editing a kitty that already exists. */
  memberId?: string;
  /** Someone else in the kitty pays this person's share, e.g. a parent for a child. */
  paidByKey: string | null;
}

export type DraftPersonInput = Omit<DraftPerson, 'key' | 'fixedPaise' | 'memberId'>;

/** A person from a saved group: who pays for them is a place in the group's list. */
export type GroupPersonInput = Omit<DraftPersonInput, 'paidByKey' | 'isOrganiser'> & {
  paidByIndex: number | null;
  /** This is the organiser using the group: they're already in, as You. */
  isMe: boolean;
};

/** A saved kitty loaded back into the form, to edit it until someone pays. */
export interface ExistingKitty {
  id: string;
  status: 'draft' | 'shared';
  kind: KittyKind;
  goalPlan: GoalPlan;
  partsCount: number | null;
  title: string;
  totalPaise: Paise;
  dueDate: string;
  upiId: string;
  people: (Omit<DraftPerson, 'key' | 'paidByKey'> & { paidByMemberId: string | null })[];
}

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

export type GoalPlan = 'single' | 'parts';

interface DraftKitty {
  /** Set when editing a saved kitty instead of making a new one. */
  editing: Pick<ExistingKitty, 'id' | 'status'> | null;
  /** Screen 2 (moment) or screen 22 (goal). */
  kind: KittyKind;
  setKind: (k: KittyKind) => void;
  /** Goals only: one payment or monthly parts. */
  goalPlan: GoalPlan;
  setGoalPlan: (p: GoalPlan) => void;
  /** Goals in parts: how many monthly parts. Null until the organiser picks, or a pay by date allows. */
  partsCount: number | null;
  setPartsCount: (n: number | null) => void;
  /** Set by "Scan the bill" on screen 4; screen 2 picks it up and starts the scan. */
  scanRequested: boolean;
  setScanRequested: (v: boolean) => void;
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
  /** Adds a saved group's people, skipping names already in the kitty. Returns how many were added. */
  addGroup: (people: GroupPersonInput[]) => number;
  updatePerson: (key: string, p: DraftPersonInput) => void;
  removePerson: (key: string) => void;
  setFixed: (key: string, paise: Paise | null) => void;
  resetFixed: () => void;
  split: Split;
}

const Context = createContext<DraftKitty | null>(null);

let nextKey = 1;
const newKey = () => `p${nextKey++}`;

export function describePerson(p: Pick<DraftPerson, 'diet' | 'drinks'>, paidByName?: string | null): string {
  const food = `${p.diet === 'veg' ? 'Veg' : 'Non-veg'}, ${p.drinks ? 'drinks' : "doesn't drink"}`;
  return paidByName ? `${food}, ${paidByName} pays` : food;
}

export function DraftKittyProvider({
  organiserName,
  upiId: initialUpi,
  existing,
  children,
}: {
  organiserName: string;
  upiId: string;
  existing?: ExistingKitty | null;
  children: ReactNode;
}) {
  const [kind, setKind] = useState<KittyKind>(existing?.kind ?? 'moment');
  const [goalPlan, setGoalPlan] = useState<GoalPlan>(existing?.goalPlan ?? 'single');
  const [partsCount, setPartsCount] = useState<number | null>(existing?.partsCount ?? null);
  const [scanRequested, setScanRequested] = useState(false);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [totalText, setTotalText] = useState(existing ? formatRupees(existing.totalPaise).replace('₹', '') : '');
  const [dueDate, setDueDate] = useState<string | null>(existing?.dueDate ?? null);
  const [upiId, setUpiId] = useState(existing?.upiId ?? initialUpi);
  // The organiser is in their own kitty by default and can remove themselves (spec section 3).
  const [people, setPeople] = useState<DraftPerson[]>(() => {
    if (!existing) {
      return [{ key: newKey(), name: organiserName || 'You', phone: null, isOrganiser: true, diet: 'veg', drinks: false, fixedPaise: null, paidByKey: null }];
    }
    const keyed = existing.people.map(({ paidByMemberId, ...p }) => ({ ...p, key: newKey(), paidByMemberId }));
    const keyFor = new Map(keyed.map((p) => [p.memberId, p.key]));
    return keyed.map(({ paidByMemberId, ...p }) => ({ ...p, paidByKey: paidByMemberId ? (keyFor.get(paidByMemberId) ?? null) : null }));
  });
  const editing = useMemo(() => (existing ? { id: existing.id, status: existing.status } : null), [existing]);

  const totalPaise = useMemo(() => {
    const p = parseRupees(totalText);
    return p && p > 0 ? p : null;
  }, [totalText]);

  const addPerson = useCallback((p: DraftPersonInput) => {
    setPeople((list) => [...list, { ...p, key: newKey(), fixedPaise: null }]);
  }, []);
  const addGroup = useCallback(
    (group: GroupPersonInput[]) => {
      const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
      // Everyone in the group gets a key (an existing person's if the name is already in), so
      // "who pays for whom" can point at the right person.
      const organiserKey = people.find((p) => p.isOrganiser)?.key;
      const keys = group.map((g) =>
        g.isMe ? (organiserKey ?? newKey()) : (people.find((p) => !p.isOrganiser && sameName(p.name, g.name))?.key ?? newKey()),
      );
      const fresh = group
        .map((g, i) => ({ g, key: keys[i]! }))
        .filter(({ g }) => !g.isMe && !people.some((p) => !p.isOrganiser && sameName(p.name, g.name)))
        .map(({ g, key }) => ({
          key,
          name: g.name,
          phone: g.phone,
          isOrganiser: false,
          diet: g.diet,
          drinks: g.drinks,
          fixedPaise: null,
          paidByKey: g.paidByIndex !== null ? (keys[g.paidByIndex] ?? null) : null,
        }));
      setPeople((list) => [...list, ...fresh]);
      return fresh.length;
    },
    [people],
  );
  const updatePerson = useCallback((key: string, p: DraftPersonInput) => {
    setPeople((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));
  }, []);
  const removePerson = useCallback((key: string) => {
    // Anyone they paid for goes back to paying for themselves.
    setPeople((list) => list.filter((x) => x.key !== key).map((x) => (x.paidByKey === key ? { ...x, paidByKey: null } : x)));
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
      editing,
      kind,
      setKind,
      goalPlan,
      setGoalPlan,
      partsCount,
      setPartsCount,
      scanRequested,
      setScanRequested,
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
      addGroup,
      updatePerson,
      removePerson,
      setFixed,
      resetFixed,
      split,
    }),
    [editing, kind, goalPlan, partsCount, scanRequested, title, totalText, totalPaise, dueDate, upiId, people, addPerson, addGroup, updatePerson, removePerson, setFixed, resetFixed, split],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDraftKitty(): DraftKitty {
  const v = useContext(Context);
  if (!v) throw new Error('useDraftKitty must be used inside DraftKittyProvider');
  return v;
}
