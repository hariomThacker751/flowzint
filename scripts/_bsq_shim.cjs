/* TEST-ONLY shim: exposes a better-sqlite3-compatible surface backed by Node's
 * built-in node:sqlite. Used solely by the sandbox test harness because the
 * project's prebuilt better-sqlite3 binary is macOS-only. The real application
 * continues to use better-sqlite3 unchanged. */
const { DatabaseSync } = require("node:sqlite");

class Stmt {
  constructor(s) { this._s = s; }
  get(...p) { return this._s.get(...p); }
  all(...p) { return this._s.all(...p); }
  run(...p) { return this._s.run(...p); }
}

class Database {
  constructor(path) { this._db = new DatabaseSync(path); }
  pragma(s) { try { this._db.exec(`PRAGMA ${s}`); } catch { /* ignore */ } return []; }
  exec(sql) { this._db.exec(sql); return this; }
  prepare(sql) { return new Stmt(this._db.prepare(sql)); }
  transaction(fn) {
    const db = this._db;
    return (...args) => {
      db.exec("BEGIN");
      try { const r = fn(...args); db.exec("COMMIT"); return r; }
      catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
    };
  }
  close() { this._db.close(); }
}

module.exports = Database;
