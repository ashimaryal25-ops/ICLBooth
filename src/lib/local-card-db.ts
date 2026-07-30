import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";

export type LocalCardRecord = {
  id: string;
  displayName: string;
  rarity: string;
  traitScores: Record<string, number>;
  campusPower: number;
  knownFor: string;
  specialAbility: string;
  cardPngPath: string;
  cardUrl: string;
  createdAt: string;
  expiresAt: string;
};

type LocalCardRow = {
  id: string;
  display_name: string;
  rarity: string;
  trait_scores_json: string;
  campus_power: number;
  known_for: string;
  special_ability: string;
  card_png_path: string;
  card_url: string;
  created_at: string;
  expires_at: string;
};

const storageRoot = path.join(process.cwd(), ".booth-storage");
const dbPath = path.join(storageRoot, "cardifybooth.db");

let db: Database.Database | null = null;

export function getLocalCardDb() {
  mkdirSync(storageRoot, { recursive: true });

  if (!db) {
    db = new Database(dbPath);

    db.exec(`
      create table if not exists local_cards (
        id text primary key,
        display_name text not null,
        rarity text not null,
        trait_scores_json text not null,
        campus_power integer not null,
        known_for text not null,
        special_ability text not null,
        card_png_path text not null,
        card_url text not null,
        created_at text not null,
        expires_at text not null
      );
    `);
  }

  return db;
}

export function insertLocalCardRecord(record: LocalCardRecord) {
  const database = getLocalCardDb();

  database
    .prepare(
      `
      insert or replace into local_cards (
        id,
        display_name,
        rarity,
        trait_scores_json,
        campus_power,
        known_for,
        special_ability,
        card_png_path,
        card_url,
        created_at,
        expires_at
      )
      values (
        @id,
        @displayName,
        @rarity,
        @traitScoresJson,
        @campusPower,
        @knownFor,
        @specialAbility,
        @cardPngPath,
        @cardUrl,
        @createdAt,
        @expiresAt
      )
    `,
    )
    .run({
      ...record,
      traitScoresJson: JSON.stringify(record.traitScores),
    });
}

export function getLocalCardRecord(id: string) {
  const database = getLocalCardDb();

  const row = database
    .prepare(
      `
      select
        id,
        display_name,
        rarity,
        trait_scores_json,
        campus_power,
        known_for,
        special_ability,
        card_png_path,
        card_url,
        created_at,
        expires_at
      from local_cards
      where id = ?
    `,
    )
    .get(id) as LocalCardRow | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    displayName: row.display_name,
    rarity: row.rarity,
    traitScores: JSON.parse(row.trait_scores_json) as Record<string, number>,
    campusPower: row.campus_power,
    knownFor: row.known_for,
    specialAbility: row.special_ability,
    cardPngPath: row.card_png_path,
    cardUrl: row.card_url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  } satisfies LocalCardRecord;
}
