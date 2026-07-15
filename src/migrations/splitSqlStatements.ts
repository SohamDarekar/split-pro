/**
 * Splits a .sql file's raw text into individual top-level statements, safe to
 * send one-at-a-time via $executeRawUnsafe (Postgres extended query protocol
 * rejects multiple semicolon-separated commands in one prepared statement).
 *
 * A plain `.split(';')` is not safe: semicolons inside single-quoted strings,
 * quoted identifiers, or dollar-quoted blocks (`DO $$ ... $$`, `CREATE FUNCTION
 * ... $$ LANGUAGE plpgsql`) are not statement boundaries. This repo's migration
 * history contains real examples of all three (see prisma/migrations/
 * 20250920192654_recurrence, 20260201130853_add_app_metadata,
 * 20251119183616_switch_to_balance_view), so this must be handled correctly,
 * not assumed away.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = '';
  let i = 0;
  const n = sql.length;

  const flush = () => {
    const trimmed = buffer.trim();
    // A fragment can be non-empty but contain nothing but comments (e.g. a
    // Trailing "-- note" after the last real statement with no `;` after it).
    // Executing that as its own statement is pointless and, depending on the
    // Driver, can error on an effectively-empty command — drop it.
    const withoutComments = trimmed
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    if (withoutComments.length > 0) {
      statements.push(trimmed);
    }
    buffer = '';
  };

  while (i < n) {
    const ch = sql[i];

    // Line comment: -- ... \n
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? n : end + 1;
      buffer += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Block comment: /* ... */
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      buffer += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Single-quoted string literal, with '' as an escaped quote
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      buffer += sql.slice(i, j);
      i = j;
      continue;
    }

    // Double-quoted identifier, with "" as an escaped quote
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      buffer += sql.slice(i, j);
      i = j;
      continue;
    }

    // Dollar-quoted block: $$ ... $$  or  $tag$ ... $tag$
    if (ch === '$') {
      const tagMatch = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (tagMatch) {
        const delimiter = tagMatch[0];
        const closeIndex = sql.indexOf(delimiter, i + delimiter.length);
        const stop = closeIndex === -1 ? n : closeIndex + delimiter.length;
        buffer += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }

    // Top-level statement boundary
    if (ch === ';') {
      buffer += ch;
      flush();
      i += 1;
      continue;
    }

    buffer += ch;
    i += 1;
  }

  flush();

  return statements;
}
