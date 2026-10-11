import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(directory, 'data.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shape TEXT NOT NULL,
    location_label TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    radius REAL NOT NULL,
    start_lat REAL NOT NULL,
    start_lng REAL NOT NULL,
    end_lat REAL NOT NULL,
    end_lng REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL,
    expected_duration TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insertStatement = db.prepare(`
  INSERT INTO reports (
    shape, location_label, lat, lng, radius,
    start_lat, start_lng, end_lat, end_lng,
    category, description, severity, expected_duration
  ) VALUES (
    @shape, @locationLabel, @lat, @lng, @radius,
    @startLat, @startLng, @endLat, @endLng,
    @category, @description, @severity, @expectedDuration
  )
`);

const selectAllStatement = db.prepare('SELECT * FROM reports ORDER BY created_at DESC, id DESC');
const selectByIdStatement = db.prepare('SELECT * FROM reports WHERE id = ?');
const resolveStatement = db.prepare('UPDATE reports SET resolved = 1 WHERE id = ?');

export function getReports() {
    return selectAllStatement.all();
}

export function insertReport(report) {
    const result = insertStatement.run({
        locationLabel: null,
        description: null,
        expectedDuration: null,
        ...report
    });
    return selectByIdStatement.get(result.lastInsertRowid);
}

export function resolveReport(id) {
    resolveStatement.run(id);
    return selectByIdStatement.get(id);
}
