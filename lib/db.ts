import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const SOURCE_PATH = path.join(process.cwd(), "data.db");
// On Vercel the deployed filesystem is read-only; copy to /tmp on first use
const DB_PATH = process.env.VERCEL ? "/tmp/data.db" : SOURCE_PATH;

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    if (process.env.VERCEL && !fs.existsSync(DB_PATH)) {
      fs.copyFileSync(SOURCE_PATH, DB_PATH);
    }
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}
