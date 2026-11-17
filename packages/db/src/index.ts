import type { Database } from './database.types';

export type { Database, Json } from './database.types';

type PublicTables = Database['public']['Tables'];

/** A row as read from the database, e.g. Row<'kitties'>. */
export type Row<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type Insert<T extends keyof PublicTables> = PublicTables[T]['Insert'];
export type Update<T extends keyof PublicTables> = PublicTables[T]['Update'];
