#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";

type Options = {
  dbPath: string;
  limit: number;
  json: boolean;
  color: boolean;
  truncate: boolean;
  latestRun: boolean;
};

const DEFAULT_DB = "idea_processor.db";
const DEFAULT_LIMIT = 10;
const MAX_CELL_WIDTH = 40;

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const usage = `
Usage:
  idea-db [command] [options]

Commands:
  overview                     Show tables, row counts, and columns (default)
  tables                       List tables with row counts
  schema <table>               Show CREATE TABLE and columns
  rows <table> [limit]         Preview rows (default limit ${DEFAULT_LIMIT})
  search <table> <column> <term>  Search rows by LIKE
  stats                        Database summary
  agg <type>                   Aggregations: tools, scores, quality, files, errors, days

Options:
  -d, --db <path>              Path to sqlite db (default: ${DEFAULT_DB})
  -l, --limit <n>              Row limit for rows/search (default: ${DEFAULT_LIMIT})
  --latest-run                 Filter results to the most recent run
  --full                       Do not truncate cell values
  --json                       Output JSON
  --no-color                   Disable ANSI colors
  -h, --help                   Show help
`;

function parseArgs(argv: string[]): {
  command: string | null;
  params: string[];
  options: Options;
  showHelp: boolean;
  errors: string[];
} {
  const options: Options = {
    dbPath: DEFAULT_DB,
    limit: DEFAULT_LIMIT,
    json: false,
    color: true,
    truncate: true,
    latestRun: false,
  };
  const params: string[] = [];
  const errors: string[] = [];
  let showHelp = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--db" || arg === "-d") {
      const next = argv[i + 1];
      if (!next) {
        errors.push("Missing value for --db");
      } else {
        options.dbPath = next;
        i += 1;
      }
      continue;
    }
    if (arg === "--limit" || arg === "-l") {
      const next = argv[i + 1];
      if (!next) {
        errors.push("Missing value for --limit");
      } else {
        const parsed = Number(next);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          errors.push(`Invalid --limit: ${next}`);
        } else {
          options.limit = Math.floor(parsed);
        }
        i += 1;
      }
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--latest-run") {
      options.latestRun = true;
      continue;
    }
    if (arg === "--no-color") {
      options.color = false;
      continue;
    }
    if (arg === "--full") {
      options.truncate = false;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      showHelp = true;
      continue;
    }
    if (arg.startsWith("-")) {
      errors.push(`Unknown option: ${arg}`);
      continue;
    }
    params.push(arg);
  }

  const [command, ...rest] = params;
  return {
    command: command ?? null,
    params: rest,
    options,
    showHelp,
    errors,
  };
}

function colorize(text: string, color: string, useColor: boolean): string {
  if (!useColor) {
    return text;
  }
  return `${color}${text}${colors.reset}`;
}

function quoteIdentifier(value: string): string {
  // Escape " inside identifiers for safe interpolation.
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return value.toFixed(digits).replace(/\.00$/, "");
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function truncateValue(value: string, maxWidth: number, truncate: boolean): string {
  if (!truncate || value.length <= maxWidth) {
    return value;
  }
  if (maxWidth <= 3) {
    return value.slice(0, maxWidth);
  }
  return `${value.slice(0, maxWidth - 3)}...`;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return `<buffer:${value.length}>`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function padRight(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }
  return value + " ".repeat(width - value.length);
}

function listTables(db: Database.Database): string[] {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function getRowCount(
  db: Database.Database,
  table: string,
  runId?: string | null,
  columns?: ColumnInfo[]
): number {
  const tableColumns = columns ?? getColumns(db, table);
  if (runId && columnExists(tableColumns, "run_id")) {
    const row = db
      .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)} WHERE run_id = ?`)
      .get(runId) as { count: number };
    return row.count;
  }
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`)
    .get() as { count: number };
  return row.count;
}

type ColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

function getColumns(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as ColumnInfo[];
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name = ?"
    )
    .get(table) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function columnExists(columns: ColumnInfo[], column: string): boolean {
  return columns.some((col) => col.name === column);
}

type PredicateParts = {
  predicate: string;
  params: Array<string>;
};

function buildWhereClause(basePredicate: string, extraPredicate: string): string {
  if (!basePredicate && !extraPredicate) {
    return "";
  }
  if (!extraPredicate) {
    return `WHERE ${basePredicate}`;
  }
  if (!basePredicate) {
    return `WHERE ${extraPredicate}`;
  }
  return `WHERE ${basePredicate} AND ${extraPredicate}`;
}

function buildRunPredicate(runId: string | null, tableAlias?: string): PredicateParts {
  if (!runId) {
    return { predicate: "", params: [] };
  }
  const column = tableAlias ? `${tableAlias}.run_id` : "run_id";
  return { predicate: `${column} = ?`, params: [runId] };
}

function getLatestRunId(db: Database.Database): string | null {
  const row = db
    .prepare(
      `SELECT run_id, MAX(timestamp) AS latest_ts
        FROM tool_calls
        WHERE run_id IS NOT NULL
        GROUP BY run_id
        ORDER BY latest_ts DESC
        LIMIT 1`
    )
    .get() as { run_id?: string | null } | undefined;
  return row?.run_id ?? null;
}

function printTable(
  columns: string[],
  rows: Array<Record<string, unknown>>,
  options: Options,
  useColor: boolean
): void {
  if (rows.length === 0) {
    if (columns.length === 0) {
      console.log(colorize("No rows found.", colors.yellow, useColor));
      return;
    }
    const widths = columns.map((col) => Math.min(Math.max(col.length, 3), MAX_CELL_WIDTH));
    const header = columns
      .map((col, index) => padRight(col, widths[index]))
      .join(" | ");
    const separator = widths.map((width) => "-".repeat(width)).join("-+-");
    console.log(colorize(header, colors.bold + colors.cyan, useColor));
    console.log(colorize(separator, colors.gray, useColor));
    console.log(colorize("No rows found.", colors.yellow, useColor));
    return;
  }

  const widths = columns.map((col) => {
    const maxDataWidth = Math.max(
      col.length,
      ...rows.map((row) => {
        const value = stringifyValue(row[col]);
        return truncateValue(value, MAX_CELL_WIDTH, options.truncate).length;
      })
    );
    return Math.min(Math.max(maxDataWidth, 3), MAX_CELL_WIDTH);
  });

  const header = columns
    .map((col, index) => padRight(col, widths[index]))
    .join(" | ");
  const separator = widths.map((width) => "-".repeat(width)).join("-+-");

  console.log(colorize(header, colors.bold + colors.cyan, useColor));
  console.log(colorize(separator, colors.gray, useColor));

  for (const row of rows) {
    const line = columns
      .map((col, index) => {
        const value = stringifyValue(row[col]);
        const cell = truncateValue(value, MAX_CELL_WIDTH, options.truncate);
        return padRight(cell, widths[index]);
      })
      .join(" | ");
    console.log(line);
  }
}

function printColumns(columns: ColumnInfo[], useColor: boolean): void {
  if (columns.length === 0) {
    console.log(colorize("No columns found.", colors.yellow, useColor));
    return;
  }
  const formatted = columns.map((col) => {
    const parts = [col.name, col.type || "UNKNOWN"];
    if (col.pk) {
      parts.push("pk");
    }
    if (col.notnull) {
      parts.push("notnull");
    }
    if (col.dflt_value !== null) {
      parts.push(`default=${col.dflt_value}`);
    }
    return parts.join(" ");
  });
  for (const line of formatted) {
    console.log(`- ${line}`);
  }
}

function outputJson(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

function main(): void {
  const { command, params, options, showHelp, errors } = parseArgs(process.argv.slice(2));
  const useColor = options.color && process.stdout.isTTY && !options.json;

  if (showHelp) {
    console.log(usage.trimEnd());
    return;
  }
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(colorize(`Error: ${error}`, colors.red, useColor));
    }
    console.error(usage.trimEnd());
    process.exit(1);
  }

  const resolvedDbPath = path.isAbsolute(options.dbPath)
    ? options.dbPath
    : path.join(process.cwd(), options.dbPath);
  if (!fs.existsSync(resolvedDbPath)) {
    console.error(colorize(`Database not found: ${resolvedDbPath}`, colors.red, useColor));
    process.exit(1);
  }

  const db = new Database(resolvedDbPath, { readonly: true });

  try {
    const effectiveCommand = command ?? "overview";
    let latestRunId: string | null = null;

    if (options.latestRun) {
      if (!tableExists(db, "tool_calls")) {
        console.error(
          colorize("Error: tool_calls table not found; --latest-run requires tool_calls.", colors.red, useColor)
        );
        process.exit(1);
      }
      const toolCallsColumns = getColumns(db, "tool_calls");
      if (!columnExists(toolCallsColumns, "run_id")) {
        console.error(
          colorize(
            "Error: --latest-run requires tool_calls.run_id. Run the processor to add it.",
            colors.red,
            useColor
          )
        );
        process.exit(1);
      }
      if (tableExists(db, "scores")) {
        const scoresColumns = getColumns(db, "scores");
        if (!columnExists(scoresColumns, "run_id")) {
          console.error(
            colorize(
              "Error: --latest-run requires scores.run_id. Run the processor to add it.",
              colors.red,
              useColor
            )
          );
          process.exit(1);
        }
      }
      latestRunId = getLatestRunId(db);
      if (!latestRunId) {
        console.error(
          colorize(
            "Error: no runs found with run_id. Run the processor to record a run.",
            colors.red,
            useColor
          )
        );
        process.exit(1);
      }
    }
    const runLabel = latestRunId ? ` (latest run ${latestRunId})` : "";

    if (effectiveCommand === "overview") {
      const tables = listTables(db);
      const dbSize = fs.statSync(resolvedDbPath).size;
      const summary = {
        dbPath: resolvedDbPath,
        size: dbSize,
        runId: latestRunId ?? undefined,
        tables: tables.map((name) => {
          const columns = getColumns(db, name);
          return {
            name,
            rowCount: getRowCount(db, name, latestRunId, columns),
            columns: columns.map((col) => ({
              name: col.name,
              type: col.type,
              pk: Boolean(col.pk),
              notnull: Boolean(col.notnull),
              default: col.dflt_value,
            })),
          };
        }),
      };

      if (options.json) {
        outputJson(summary);
        return;
      }

      console.log(
        `${colorize("Database:", colors.bold + colors.blue, useColor)} ${resolvedDbPath} ${colorize(
          `(${formatBytes(dbSize)})`,
          colors.gray,
          useColor
        )}`
      );
      if (latestRunId) {
        console.log(colorize(`Latest run: ${latestRunId}`, colors.gray, useColor));
      }
      console.log(
        `${colorize("Tables:", colors.bold + colors.cyan, useColor)} ${colorize(
          `${tables.length}`,
          colors.yellow,
          useColor
        )}`
      );
      for (const table of summary.tables) {
        console.log(
          `${colorize("- " + table.name, colors.magenta, useColor)} ${colorize(
            `(${table.rowCount} rows)`,
            colors.gray,
            useColor
          )}`
        );
        const columnLine = table.columns
          .map((col) => {
            const flags = [
              col.pk ? "pk" : null,
              col.notnull ? "notnull" : null,
            ].filter(Boolean);
            const flagText = flags.length > 0 ? ` ${flags.join(",")}` : "";
            return `${col.name} ${col.type || "UNKNOWN"}${flagText}`;
          })
          .join(", ");
        console.log(colorize(`  Columns: ${columnLine}`, colors.gray, useColor));
      }
      return;
    }

    if (effectiveCommand === "tables") {
      const tables = listTables(db).map((name) => ({
        name,
        rowCount: getRowCount(db, name, latestRunId),
      }));

      if (options.json) {
        outputJson({ dbPath: resolvedDbPath, runId: latestRunId ?? undefined, tables });
        return;
      }

      if (latestRunId) {
        console.log(colorize(`Latest run: ${latestRunId}`, colors.gray, useColor));
      }
      console.log(colorize("Tables", colors.bold + colors.cyan, useColor));
      for (const table of tables) {
        console.log(
          `${colorize("- " + table.name, colors.magenta, useColor)} ${colorize(
            `(${table.rowCount} rows)`,
            colors.gray,
            useColor
          )}`
        );
      }
      return;
    }

    if (effectiveCommand === "schema") {
      const table = params[0];
      if (!table) {
        console.error(colorize("Error: schema requires a table name.", colors.red, useColor));
        process.exit(1);
      }
      if (!tableExists(db, table)) {
        console.error(colorize(`Error: table not found: ${table}`, colors.red, useColor));
        process.exit(1);
      }
      const row = db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table) as { sql: string | null };
      const columns = getColumns(db, table);

      if (options.json) {
        outputJson({
          table,
          sql: row.sql,
          columns,
        });
        return;
      }

      console.log(colorize(`Schema for ${table}`, colors.bold + colors.cyan, useColor));
      if (row.sql) {
        console.log(colorize(row.sql, colors.gray, useColor));
      }
      printColumns(columns, useColor);
      return;
    }

    if (effectiveCommand === "rows") {
      const table = params[0];
      if (!table) {
        console.error(colorize("Error: rows requires a table name.", colors.red, useColor));
        process.exit(1);
      }
      if (!tableExists(db, table)) {
        console.error(colorize(`Error: table not found: ${table}`, colors.red, useColor));
        process.exit(1);
      }
      const columns = getColumns(db, table);
      if (latestRunId && !columnExists(columns, "run_id")) {
        console.error(
          colorize(
            `Error: --latest-run requires ${table}.run_id. Run the processor to add it.`,
            colors.red,
            useColor
          )
        );
        process.exit(1);
      }
      const limitArg = params[1] ? Number(params[1]) : options.limit;
      const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : options.limit;
      const runFilter = buildRunPredicate(latestRunId);
      const whereClause = buildWhereClause("", runFilter.predicate);
      const rows = db
        .prepare(`SELECT * FROM ${quoteIdentifier(table)} ${whereClause} LIMIT ?`)
        .all(...runFilter.params, limit) as Array<Record<string, unknown>>;
      const fallbackColumns = rows.length === 0 ? columns.map((col) => col.name) : [];

      if (options.json) {
        outputJson({ table, runId: latestRunId ?? undefined, limit, rows });
        return;
      }

      console.log(
        colorize(`Rows from ${table} (limit ${limit})${runLabel}`, colors.bold + colors.cyan, useColor)
      );
      const headerColumns = rows.length > 0 ? Object.keys(rows[0]) : fallbackColumns;
      printTable(headerColumns, rows, options, useColor);
      return;
    }

    if (effectiveCommand === "search") {
      const [table, column, ...termParts] = params;
      if (!table || !column || termParts.length === 0) {
        console.error(
          colorize("Error: search requires <table> <column> <term>.", colors.red, useColor)
        );
        process.exit(1);
      }
      if (!tableExists(db, table)) {
        console.error(colorize(`Error: table not found: ${table}`, colors.red, useColor));
        process.exit(1);
      }
      const columns = getColumns(db, table);
      if (!columnExists(columns, column)) {
        console.error(
          colorize(`Error: column not found: ${column} in ${table}`, colors.red, useColor)
        );
        process.exit(1);
      }
      if (latestRunId && !columnExists(columns, "run_id")) {
        console.error(
          colorize(
            `Error: --latest-run requires ${table}.run_id. Run the processor to add it.`,
            colors.red,
            useColor
          )
        );
        process.exit(1);
      }
      const term = termParts.join(" ");
      const runFilter = buildRunPredicate(latestRunId);
      const whereClause = buildWhereClause(`${quoteIdentifier(column)} LIKE ?`, runFilter.predicate);
      const rows = db
        .prepare(
          `SELECT * FROM ${quoteIdentifier(table)} ${whereClause} LIMIT ?`
        )
        .all(`%${term}%`, ...runFilter.params, options.limit) as Array<Record<string, unknown>>;
      const fallbackColumns = rows.length === 0 ? columns.map((col) => col.name) : [];

      if (options.json) {
        outputJson({ table, column, term, runId: latestRunId ?? undefined, limit: options.limit, rows });
        return;
      }

      console.log(
        colorize(
          `Search ${table}.${column} for "${term}" (limit ${options.limit})${runLabel}`,
          colors.bold + colors.cyan,
          useColor
        )
      );
      const headerColumns = rows.length > 0 ? Object.keys(rows[0]) : fallbackColumns;
      printTable(headerColumns, rows, options, useColor);
      return;
    }

    if (effectiveCommand === "stats") {
      const tables = listTables(db);
      const counts = tables.map((name) => ({
        name,
        rowCount: getRowCount(db, name, latestRunId),
      }));
      const totalRows = counts.reduce((sum, table) => sum + table.rowCount, 0);
      const dbSize = fs.statSync(resolvedDbPath).size;

      if (options.json) {
        outputJson({
          dbPath: resolvedDbPath,
          size: dbSize,
          tableCount: tables.length,
          totalRows,
          runId: latestRunId ?? undefined,
          tables: counts,
        });
        return;
      }

      console.log(
        `${colorize("Database:", colors.bold + colors.blue, useColor)} ${resolvedDbPath} ${colorize(
          `(${formatBytes(dbSize)})`,
          colors.gray,
          useColor
        )}`
      );
      if (latestRunId) {
        console.log(colorize(`Latest run: ${latestRunId}`, colors.gray, useColor));
      }
      console.log(
        `${colorize("Tables:", colors.bold + colors.cyan, useColor)} ${colorize(
          `${tables.length}`,
          colors.yellow,
          useColor
        )}`
      );
      console.log(
        `${colorize("Total rows:", colors.bold + colors.cyan, useColor)} ${colorize(
          `${totalRows}`,
          colors.yellow,
          useColor
        )}`
      );
      for (const table of counts) {
        console.log(
          `${colorize("- " + table.name, colors.magenta, useColor)} ${colorize(
            `(${table.rowCount} rows)`,
            colors.gray,
            useColor
          )}`
        );
      }
      return;
    }

    if (effectiveCommand === "agg" || effectiveCommand.startsWith("agg-")) {
      const subcommand = effectiveCommand === "agg" ? params[0] : effectiveCommand.slice(4);
      if (!subcommand) {
        console.error(
          colorize(
            "Error: agg requires a type (tools, scores, quality, files, errors, days).",
            colors.red,
            useColor
          )
        );
        process.exit(1);
      }
      if (latestRunId && !options.json) {
        console.log(colorize(`Latest run: ${latestRunId}`, colors.gray, useColor));
      }

      if (subcommand === "tools") {
        const runFilter = buildRunPredicate(latestRunId);
        const whereClause = buildWhereClause("", runFilter.predicate);
        const totalRow = db
          .prepare(`SELECT COUNT(*) AS count FROM tool_calls ${whereClause}`)
          .get(...runFilter.params) as {
          count: number;
        };
        const totalCalls = totalRow.count;
        const rows = db
          .prepare(
            `SELECT tool_name AS tool_name, COUNT(*) AS calls
             FROM tool_calls
             ${whereClause}
             GROUP BY tool_name
             ORDER BY calls DESC`
          )
          .all(...runFilter.params) as Array<{ tool_name: string; calls: number }>;
        const displayRows = rows.map((row) => ({
          tool_name: row.tool_name,
          calls: row.calls,
          percent: totalCalls > 0 ? formatPercent((row.calls / totalCalls) * 100) : "0.0%",
        }));

        if (options.json) {
          outputJson({ totalCalls, runId: latestRunId ?? undefined, tools: rows });
          return;
        }

        console.log(colorize("Tool usage", colors.bold + colors.cyan, useColor));
        printTable(["tool_name", "calls", "percent"], displayRows, options, useColor);
        return;
      }

      if (subcommand === "scores") {
        const runFilter = buildRunPredicate(latestRunId);
        const scorePredicate = "overall_score IN (-1, 0, 1)";
        const distributionWhere = buildWhereClause(scorePredicate, runFilter.predicate);
        const distribution = db
          .prepare(
            `SELECT overall_score AS score, COUNT(*) AS count
             FROM scores
             ${distributionWhere}
             GROUP BY overall_score
             ORDER BY overall_score DESC`
          )
          .all(...runFilter.params) as Array<{ score: number; count: number }>;
        const totalScores = distribution.reduce((sum, row) => sum + row.count, 0);
        const distributionDisplay = distribution.map((row) => ({
          score: row.score,
          count: row.count,
          percent: totalScores > 0 ? formatPercent((row.count / totalScores) * 100) : "0.0%",
        }));
        const missingWhere = buildWhereClause("overall_score = -2", runFilter.predicate);
        const missingRow = db
          .prepare(`SELECT COUNT(*) AS count FROM scores ${missingWhere}`)
          .get(...runFilter.params) as { count: number };
        const missingCount = missingRow.count;

        const averagesWhere = buildWhereClause("", runFilter.predicate);
        const averages = db
          .prepare(
            `SELECT
              AVG(CASE WHEN comprehensive != -2 THEN comprehensive END) AS comprehensive,
              AVG(CASE WHEN detailed != -2 THEN detailed END) AS detailed,
              AVG(CASE WHEN confident != -2 THEN confident END) AS confident,
              AVG(CASE WHEN too_long != -2 THEN too_long END) AS too_long,
              AVG(CASE WHEN too_short != -2 THEN too_short END) AS too_short,
              AVG(CASE WHEN fully_answered != -2 THEN fully_answered END) AS fully_answered,
              AVG(CASE WHEN overall_score != -2 THEN overall_score END) AS overall_score
            FROM scores
            ${averagesWhere}`
          )
          .get(...runFilter.params) as {
          comprehensive: number | null;
          detailed: number | null;
          confident: number | null;
          too_long: number | null;
          too_short: number | null;
          fully_answered: number | null;
          overall_score: number | null;
        };

        if (options.json) {
          outputJson({
            distribution,
            missingCount,
            averages,
            runId: latestRunId ?? undefined,
          });
          return;
        }

        console.log(colorize("Score distribution (overall_score)", colors.bold + colors.cyan, useColor));
        printTable(["score", "count", "percent"], distributionDisplay, options, useColor);
        if (missingCount > 0) {
          console.log(
            colorize(
              `Missing scores (-2): ${missingCount}`,
              colors.gray,
              useColor
            )
          );
        }

        const averageDisplay = [
          {
            comprehensive: formatNumber(averages.comprehensive),
            detailed: formatNumber(averages.detailed),
            confident: formatNumber(averages.confident),
            too_long: formatNumber(averages.too_long),
            too_short: formatNumber(averages.too_short),
            fully_answered: formatNumber(averages.fully_answered),
            overall_score: formatNumber(averages.overall_score),
          },
        ];
        console.log(colorize("Average scores (missing ignored)", colors.bold + colors.cyan, useColor));
        printTable(
          [
            "comprehensive",
            "detailed",
            "confident",
            "too_long",
            "too_short",
            "fully_answered",
            "overall_score",
          ],
          averageDisplay,
          options,
          useColor
        );
        return;
      }

      if (subcommand === "quality") {
        const runFilter = buildRunPredicate(latestRunId, "tc");
        const whereClause = buildWhereClause("", runFilter.predicate);
        const rows = db
          .prepare(
            `SELECT
              tc.tool_name AS tool_name,
              COUNT(*) AS calls,
              SUM(CASE WHEN s.overall_score != -2 THEN 1 ELSE 0 END) AS scored_calls,
              AVG(CASE WHEN s.comprehensive != -2 THEN s.comprehensive END) AS avg_comprehensive,
              AVG(CASE WHEN s.detailed != -2 THEN s.detailed END) AS avg_detailed,
              AVG(CASE WHEN s.confident != -2 THEN s.confident END) AS avg_confident,
              AVG(CASE WHEN s.too_long != -2 THEN s.too_long END) AS avg_too_long,
              AVG(CASE WHEN s.too_short != -2 THEN s.too_short END) AS avg_too_short,
              AVG(CASE WHEN s.fully_answered != -2 THEN s.fully_answered END) AS avg_fully_answered,
              AVG(CASE WHEN s.overall_score != -2 THEN s.overall_score END) AS avg_overall
            FROM tool_calls tc
            JOIN scores s ON tc.id = s.call_id
            ${whereClause}
            GROUP BY tc.tool_name
            ORDER BY avg_overall IS NULL, avg_overall DESC`
          )
          .all(...runFilter.params) as Array<{
          tool_name: string;
          calls: number;
          scored_calls: number;
          avg_comprehensive: number | null;
          avg_detailed: number | null;
          avg_confident: number | null;
          avg_too_long: number | null;
          avg_too_short: number | null;
          avg_fully_answered: number | null;
          avg_overall: number | null;
        }>;

        if (options.json) {
          outputJson({ runId: latestRunId ?? undefined, tools: rows });
          return;
        }

        const displayRows = rows.map((row) => ({
          tool_name: row.tool_name,
          calls: row.calls,
          scored_calls: row.scored_calls,
          avg_comprehensive: formatNumber(row.avg_comprehensive),
          avg_detailed: formatNumber(row.avg_detailed),
          avg_confident: formatNumber(row.avg_confident),
          avg_too_long: formatNumber(row.avg_too_long),
          avg_too_short: formatNumber(row.avg_too_short),
          avg_fully_answered: formatNumber(row.avg_fully_answered),
          avg_overall: formatNumber(row.avg_overall),
        }));
        console.log(colorize("Average scores by tool", colors.bold + colors.cyan, useColor));
        printTable(
          [
            "tool_name",
            "calls",
            "scored_calls",
            "avg_comprehensive",
            "avg_detailed",
            "avg_confident",
            "avg_too_long",
            "avg_too_short",
            "avg_fully_answered",
            "avg_overall",
          ],
          displayRows,
          options,
          useColor
        );
        return;
      }

      if (subcommand === "files") {
        const runFilter = buildRunPredicate(latestRunId, "tc");
        const whereClause = buildWhereClause("", runFilter.predicate);
        const rows = db
          .prepare(
            `SELECT
              tc.source_file AS source_file,
              COUNT(*) AS calls,
              SUM(CASE WHEN tc.tool_name = 'NO_TOOL_MATCH' THEN 1 ELSE 0 END) AS no_tool,
              SUM(CASE WHEN s.overall_score != -2 THEN 1 ELSE 0 END) AS scored_calls,
              AVG(CASE WHEN s.overall_score != -2 THEN s.overall_score END) AS avg_overall
            FROM tool_calls tc
            LEFT JOIN scores s ON tc.id = s.call_id
            ${whereClause}
            GROUP BY tc.source_file
            ORDER BY calls DESC`
          )
          .all(...runFilter.params) as Array<{
          source_file: string;
          calls: number;
          no_tool: number;
          scored_calls: number;
          avg_overall: number | null;
        }>;

        if (options.json) {
          outputJson({ runId: latestRunId ?? undefined, files: rows });
          return;
        }

        const displayRows = rows.map((row) => ({
          source_file: row.source_file,
          calls: row.calls,
          no_tool: row.no_tool,
          no_tool_pct: row.calls > 0 ? formatPercent((row.no_tool / row.calls) * 100) : "0.0%",
          scored_calls: row.scored_calls,
          avg_overall: formatNumber(row.avg_overall),
        }));
        console.log(colorize("Source files overview", colors.bold + colors.cyan, useColor));
        printTable(
          ["source_file", "calls", "no_tool", "no_tool_pct", "scored_calls", "avg_overall"],
          displayRows,
          options,
          useColor
        );
        return;
      }

      if (subcommand === "errors") {
        const runFilter = buildRunPredicate(latestRunId);
        const whereClause = buildWhereClause("", runFilter.predicate);
        const rows = db
          .prepare(
            `SELECT
              tool_name AS tool_name,
              COUNT(*) AS calls,
              SUM(CASE WHEN tool_output LIKE 'Error:%' THEN 1 ELSE 0 END) AS errors
            FROM tool_calls
            ${whereClause}
            GROUP BY tool_name
            HAVING errors > 0
            ORDER BY errors DESC`
          )
          .all(...runFilter.params) as Array<{ tool_name: string; calls: number; errors: number }>;

        if (options.json) {
          outputJson({ runId: latestRunId ?? undefined, tools: rows });
          return;
        }

        const displayRows = rows.map((row) => ({
          tool_name: row.tool_name,
          calls: row.calls,
          errors: row.errors,
          error_rate: row.calls > 0 ? formatPercent((row.errors / row.calls) * 100) : "0.0%",
        }));
        console.log(colorize("Tool errors", colors.bold + colors.cyan, useColor));
        printTable(["tool_name", "calls", "errors", "error_rate"], displayRows, options, useColor);
        return;
      }

      if (subcommand === "days") {
        const runFilter = buildRunPredicate(latestRunId, "tc");
        const whereClause = buildWhereClause("", runFilter.predicate);
        const rows = db
          .prepare(
            `SELECT
              substr(tc.timestamp, 1, 10) AS day,
              COUNT(*) AS calls,
              SUM(CASE WHEN s.overall_score != -2 THEN 1 ELSE 0 END) AS scored_calls,
              AVG(CASE WHEN s.overall_score != -2 THEN s.overall_score END) AS avg_overall
            FROM tool_calls tc
            LEFT JOIN scores s ON tc.id = s.call_id
            ${whereClause}
            GROUP BY day
            ORDER BY day`
          )
          .all(...runFilter.params) as Array<{
          day: string;
          calls: number;
          scored_calls: number;
          avg_overall: number | null;
        }>;

        if (options.json) {
          outputJson({ runId: latestRunId ?? undefined, days: rows });
          return;
        }

        const displayRows = rows.map((row) => ({
          day: row.day,
          calls: row.calls,
          scored_calls: row.scored_calls,
          avg_overall: formatNumber(row.avg_overall),
        }));
        console.log(colorize("Daily volume and quality", colors.bold + colors.cyan, useColor));
        printTable(["day", "calls", "scored_calls", "avg_overall"], displayRows, options, useColor);
        return;
      }

      console.error(colorize(`Error: unknown agg type "${subcommand}".`, colors.red, useColor));
      console.error(usage.trimEnd());
      process.exit(1);
    }

    console.error(colorize(`Error: unknown command "${effectiveCommand}".`, colors.red, useColor));
    console.error(usage.trimEnd());
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
