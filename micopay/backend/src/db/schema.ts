import pg from "pg";
const { Pool } = pg;
import { config } from "../config.js";
import { randomUUID } from "crypto";

// ── In-memory store (fallback when PostgreSQL is unavailable) ─────────────
const mem: Record<string, any[]> = {
  users: [],
  wallets: [],
  trades: [],
  secret_access_log: [],
  audit_log: [],
};

function memNow() {
  return new Date().toISOString();
}

/** Resolve a value token: $N → params[N-1], NOW() → timestamp, NULL → null, 'str' → str */
function resolveVal(token: string, params: any[]): any {
  const t = token.trim();
  const pMatch = t.match(/^\$(\d+)$/);
  if (pMatch) return params[parseInt(pMatch[1]) - 1];
  if (t.toUpperCase() === "NOW()") return memNow();
  if (t.toUpperCase() === "NULL") return null;
  const strMatch = t.match(/^'(.*)'$/s);
  if (strMatch) return strMatch[1];
  return t;
}

function colName(token: string) {
  return token.includes(".") ? token.split(".").pop()! : token;
}

function evalCondition(row: any, clause: string, params: any[]): boolean {
  // Remove outer parentheses
  const trimmed = clause.trim().replace(/^\((.+)\)$/, "$1");

  // Try OR split (lowest precedence)
  const orParts = splitByKeyword(trimmed, "OR");
  if (orParts.length > 1)
    return orParts.some((p) => evalCondition(row, p, params));

  // Try AND split
  const andParts = splitByKeyword(trimmed, "AND");
  if (andParts.length > 1)
    return andParts.every((p) => evalCondition(row, p, params));

  // IN clause
  const inMatch = trimmed.match(/^([\w.]+)\s+IN\s*\(([^)]+)\)$/i);
  if (inMatch) {
    const col = colName(inMatch[1]);
    const vals = inMatch[2]
      .split(",")
      .map((v) => v.trim().replace(/^'|'$/g, ""));
    return vals.includes(String(row[col]));
  }

  // IS NULL / IS NOT NULL
  const nullMatch = trimmed.match(/^([\w.]+)\s+IS\s+(NOT\s+)?NULL$/i);
  if (nullMatch) {
    const col = colName(nullMatch[1]);
    const isNot = Boolean(nullMatch[2]);
    return isNot
      ? row[col] !== null && row[col] !== undefined
      : row[col] === null || row[col] === undefined;
  }

  // Equality
  const eqMatch = trimmed.match(/^([\w.]+)\s*=\s*(.+)$/i);
  if (eqMatch) {
    const col = colName(eqMatch[1]);
    return row[col] === resolveVal(eqMatch[2], params);
  }

  return true;
}

/** Split SQL by keyword (AND/OR) respecting parentheses */
function splitByKeyword(sql: string, kw: string): string[] {
  const parts: string[] = [];
  let depth = 0,
    start = 0;
  const re = new RegExp(`\\b${kw}\\b`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const before = sql.slice(start, m.index);
    for (const ch of before) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    if (depth === 0) {
      parts.push(before.trim());
      start = m.index + kw.length;
    }
  }
  parts.push(sql.slice(start).trim());
  return parts.length > 1 ? parts : [sql.trim()];
}

function memQuery(sql: string, params: any[] = []): any[] {
  const s = sql.trim().replace(/\s+/g, " ");
  const upper = s.toUpperCase();

  // ── SELECT ──────────────────────────────────────────────────────────────
  if (upper.startsWith("SELECT")) {
    const fromMatch = s.match(/\bFROM\s+([\w]+)(?:\s+\w+)?/i);
    if (!fromMatch) return [];
    const tableName = fromMatch[1].toLowerCase();
    let rows = [...(mem[tableName] ?? [])];

    // LEFT JOIN (only handles wallets join for users)
    const joinMatch = s.match(
      /LEFT JOIN\s+(\w+)\s+(\w+)\s+ON\s+([\w.]+)\s*=\s*([\w.]+)/i,
    );
    if (joinMatch) {
      const joinTable = joinMatch[1].toLowerCase();
      const onLeft = colName(joinMatch[3]);
      const onRight = colName(joinMatch[4]);
      rows = rows.map((row) => {
        const jRow = (mem[joinTable] ?? []).find(
          (j) => j[onLeft] === row[onRight] || j[onRight] === row[onLeft],
        );
        return { ...row, wallet_type: jRow?.wallet_type ?? null };
      });
    }

    // WHERE
    const whereMatch = s.match(
      /\bWHERE\b\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i,
    );
    if (whereMatch) {
      rows = rows.filter((row) => evalCondition(row, whereMatch[1], params));
    }

    // ORDER BY
    const orderMatch = s.match(/ORDER BY\s+([\w.]+)\s+(ASC|DESC)/i);
    if (orderMatch) {
      const col = colName(orderMatch[1]);
      const dir = orderMatch[2].toUpperCase() === "DESC" ? -1 : 1;
      rows.sort((a, b) => (a[col] < b[col] ? -dir : a[col] > b[col] ? dir : 0));
    }

    // LIMIT
    const limitMatch = s.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]));

    return rows;
  }

  // ── INSERT ───────────────────────────────────────────────────────────────
  if (upper.startsWith("INSERT INTO")) {
    const tableMatch = s.match(
      /INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
    );
    if (!tableMatch) return [];
    const tableName = tableMatch[1].toLowerCase();
    const cols = tableMatch[2].split(",").map((c) => c.trim());
    const vals = tableMatch[3].split(",").map((v) => v.trim());

    const newRow: any = { id: randomUUID(), created_at: memNow() };
    cols.forEach((col, i) => {
      newRow[col] = resolveVal(vals[i], params);
    });

    if (!mem[tableName]) mem[tableName] = [];
    mem[tableName].push(newRow);

    // RETURNING
    const retMatch = s.match(/RETURNING\s+(.+)$/i);
    if (retMatch) {
      const spec = retMatch[1].trim();
      if (spec === "*") return [newRow];
      const retCols = spec.split(",").map((c) => c.trim());
      const partial: any = {};
      retCols.forEach((c) => {
        partial[c] = newRow[c];
      });
      return [partial];
    }
    return [];
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────
  if (upper.startsWith("UPDATE")) {
    const tableMatch = s.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
    if (!tableMatch) return [];
    const tableName = tableMatch[1].toLowerCase();
    const setStr = tableMatch[2];
    const whereStr = tableMatch[3];

    const updates: Record<string, any> = {};
    // Split SET by comma, but careful with function calls — split only on ", col ="
    const setPairs = setStr.split(/,\s*(?=\w+\s*=)/);
    for (const pair of setPairs) {
      const m = pair.trim().match(/^(\w+)\s*=\s*(.+)$/i);
      if (m) updates[m[1].trim()] = resolveVal(m[2].trim(), params);
    }

    const rows = (mem[tableName] ?? []).filter((row) =>
      evalCondition(row, whereStr, params),
    );
    rows.forEach((row) => Object.assign(row, updates));
    return [];
  }

  return [];
}

// ── Try PostgreSQL; fall back to in-memory ────────────────────────────────
let pgPool: InstanceType<typeof Pool> | null = null;
let pgAvailable = false;

async function initPg() {
  try {
    const p = new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 2000,
    });
    await p.query("SELECT 1");
    pgPool = p;
    pgAvailable = true;
    console.log("✅ PostgreSQL connected");
  } catch {
    pgAvailable = false;
    console.warn(
      "⚠️  PostgreSQL unavailable — using in-memory store (data resets on restart)",
    );
  }
}

await initPg();

export const pool = pgPool;

export async function query(text: string, params?: any[]) {
  if (pgAvailable && pgPool) return pgPool.query(text, params);
  return { rows: memQuery(text, params ?? []) };
}

export async function getOne<T = any>(
  text: string,
  params?: any[],
): Promise<T | null> {
  if (pgAvailable && pgPool) {
    const r = await pgPool.query(text, params);
    return r.rows[0] ?? null;
  }
  return (memQuery(text, params ?? [])[0] as T) ?? null;
}

export async function getMany<T = any>(
  text: string,
  params?: any[],
): Promise<T[]> {
  if (pgAvailable && pgPool) {
    const r = await pgPool.query(text, params);
    return r.rows;
  }
  return memQuery(text, params ?? []) as T[];
}

export async function execute(text: string, params?: any[]) {
  if (pgAvailable && pgPool) return pgPool.query(text, params);
  memQuery(text, params ?? []);
  return { rows: [] };
}

export default { pool, query, getOne, getMany, execute };
