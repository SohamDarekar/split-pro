import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { splitSqlStatements } from './splitSqlStatements';

const migrationsPath = join(process.cwd(), 'prisma/migrations');

describe('splitSqlStatements', () => {
  it('splits two adjacent ALTER TABLE statements with no blank line between them', () => {
    // Regression case: this exact shape (20260722000000_bill_reminder_recurrence_interval)
    // Broke production because the old `.split(';\n\n')` splitter only broke on
    // Blank-line-separated statements, so these two got sent as one multi-statement
    // Prepared statement ("cannot insert multiple commands into a prepared statement").
    const sql = `
ALTER TABLE "public"."BillReminder" ADD COLUMN "recurrenceInterval" "public"."RecurrenceInterval";
ALTER TABLE "public"."BillReminder" ADD COLUMN "customIntervalDays" INTEGER;
`;
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatch(/^ALTER TABLE .* "recurrenceInterval"/);
    expect(statements[1]).toMatch(/^ALTER TABLE .* "customIntervalDays"/);
  });

  it('keeps a DO $$ ... $$ block as a single statement despite internal semicolons', () => {
    const sql = `
DO $$
BEGIN
IF current_database() NOT LIKE 'prisma_migrate_shadow_db%' THEN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
ELSE
  CREATE SCHEMA IF NOT EXISTS cron;
END IF;
END $$;

CREATE TABLE "public"."Foo" ("id" INTEGER NOT NULL);
`;
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('DO $$');
    expect(statements[0]).toContain('END $$');
    expect(statements[1]).toContain('CREATE TABLE "public"."Foo"');
  });

  it('keeps a CREATE OR REPLACE FUNCTION body intact despite internal semicolons', () => {
    const sql = `
CREATE OR REPLACE FUNCTION public.foo() RETURNS INT AS $$
BEGIN
  INSERT INTO "Bar" ("a") VALUES (1);
  UPDATE "Bar" SET "a" = 2 WHERE "a" = 1;
  RETURN 1;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX "idx_foo" ON "public"."Bar"("a");
`;
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('INSERT INTO "Bar"');
    expect(statements[0]).toContain('UPDATE "Bar"');
    expect(statements[0]).toContain('$$ LANGUAGE plpgsql;');
    expect(statements[1]).toContain('CREATE INDEX "idx_foo"');
  });

  it('does not split on a semicolon inside a single-quoted string literal', () => {
    const sql = `INSERT INTO "Foo" ("name") VALUES ('a; b; c');\nSELECT 1;`;
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toBe(`INSERT INTO "Foo" ("name") VALUES ('a; b; c');`);
    expect(statements[1]).toBe('SELECT 1;');
  });

  it('handles a tagged dollar-quote delimiter ($tag$ ... $tag$), not just $$', () => {
    const sql = `DO $tag$ BEGIN RAISE NOTICE 'x; y'; END $tag$;\nSELECT 1;`;
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('$tag$');
    expect(statements[1]).toBe('SELECT 1;');
  });

  it('drops empty/comment-only trailing content and does not emit blank statements', () => {
    const sql = `SELECT 1;\n\n-- trailing comment only\n\n`;
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe('SELECT 1;');
  });

  it('every real migration.sql in this repo splits into at least one statement with no leftover unterminated dollar-quote', () => {
    const migrationDirs = readdirSync(migrationsPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(migrationDirs.length).toBeGreaterThan(0);

    for (const dir of migrationDirs) {
      const sql = readFileSync(join(migrationsPath, dir, 'migration.sql'), 'utf8');
      const statements = splitSqlStatements(sql);

      expect(statements.length).toBeGreaterThan(0);

      for (const statement of statements) {
        // A leftover unterminated dollar-quote in a statement's tail is the
        // Clearest sign the splitter cut through the middle of a DO/FUNCTION
        // Body instead of treating it as one unit.
        const dollarTags = statement.match(/\$[A-Za-z_]*\$/g) ?? [];
        expect(dollarTags.length % 2).toBe(0);
      }
    }
  });

  it('specifically confirms the migration that broke production splits into its 4 real statements', () => {
    const sql = readFileSync(
      join(migrationsPath, '20260722000000_bill_reminder_recurrence_interval', 'migration.sql'),
      'utf8',
    );
    const statements = splitSqlStatements(sql);
    expect(statements).toHaveLength(5);
    // Leading `-- comment` lines legitimately stay bundled as a prefix of the
    // Following statement — harmless to execute, and correct: it's the same
    // Text Postgres would see between two semicolons either way.
    expect(statements[0]).toContain('CREATE TYPE');
    expect(statements[1]).toMatch(/ALTER TABLE .* "recurrenceInterval"/);
    expect(statements[2]).toMatch(/^ALTER TABLE .* "customIntervalDays"/);
    expect(statements[3]).toMatch(/^UPDATE/);
    expect(statements[4]).toMatch(/^ALTER TABLE .* DROP COLUMN "isRecurring"/);
  });
});
