import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations');
const OUTPUT_DBML = resolve(ROOT, 'docs/database/schema.dbml');
const OUTPUT_HTML = resolve(ROOT, 'docs/database/er-diagram.html');
const CHECK = process.argv.includes('--check');

function stripSqlComments(sql) {
  let out = '';
  let i = 0;
  let quote = null;
  let dollar = null;
  while (i < sql.length) {
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        out += dollar;
        i += dollar.length;
        dollar = null;
      } else {
        out += sql[i++];
      }
      continue;
    }
    if (quote) {
      const ch = sql[i];
      out += ch;
      if (ch === quote) {
        if (quote === "'" && sql[i + 1] === "'") {
          out += sql[i + 1];
          i += 2;
          continue;
        }
        quote = null;
      }
      i += 1;
      continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      quote = sql[i];
      out += sql[i++];
      continue;
    }
    if (sql[i] === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollar = match[0];
        out += dollar;
        i += dollar.length;
        continue;
      }
    }
    if (sql.startsWith('--', i)) {
      const nl = sql.indexOf('\n', i + 2);
      if (nl === -1) break;
      out += '\n';
      i = nl + 1;
      continue;
    }
    if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += ' ';
      continue;
    }
    out += sql[i++];
  }
  return out;
}

function splitStatements(sql) {
  const statements = [];
  let start = 0;
  let i = 0;
  let quote = null;
  let dollar = null;
  while (i < sql.length) {
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        i += dollar.length;
        dollar = null;
      } else i += 1;
      continue;
    }
    if (quote) {
      if (sql[i] === quote) {
        if (quote === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        quote = null;
      }
      i += 1;
      continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      quote = sql[i++];
      continue;
    }
    if (sql[i] === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollar = match[0];
        i += dollar.length;
        continue;
      }
    }
    if (sql[i] === ';') {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
    i += 1;
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function splitTopLevel(input, separator = ',') {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        if (quote === "'" && input[i + 1] === "'") i += 1;
        else quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === separator && depth === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = input.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function cleanIdentifier(value) {
  return value.trim().replace(/^"|"$/g, '').replace(/^public\./i, '').replace(/^"public"\./i, '');
}

function parseColumnList(value) {
  return splitTopLevel(value).map((part) => cleanIdentifier(part));
}

function ensureTable(schema, name) {
  const tableName = cleanIdentifier(name);
  if (!schema.tables.has(tableName)) {
    schema.tables.set(tableName, {
      name: tableName,
      columns: new Map(),
      primaryKey: [],
      uniques: [],
      foreignKeys: [],
      indexes: [],
      sourceMigrations: new Set(),
    });
  }
  return schema.tables.get(tableName);
}

function findConstraintStart(rest) {
  const keywords = [
    'constraint', 'not null', 'null', 'default', 'primary key', 'unique',
    'references', 'check', 'generated', 'collate'
  ];
  let depth = 0;
  let quote = null;
  for (let i = 0; i < rest.length; i += 1) {
    const ch = rest[i];
    if (quote) {
      if (ch === quote) {
        if (quote === "'" && rest[i + 1] === "'") i += 1;
        else quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '(' || ch === '[') { depth += 1; continue; }
    if (ch === ')' || ch === ']') { depth -= 1; continue; }
    if (depth !== 0) continue;
    const tail = rest.slice(i).toLowerCase();
    for (const keyword of keywords) {
      if (tail.startsWith(keyword) && (i === 0 || /\s/.test(rest[i - 1]))) return i;
    }
  }
  return rest.length;
}

function captureClause(rest, keyword, stopKeywords) {
  const lower = rest.toLowerCase();
  const start = lower.indexOf(keyword);
  if (start === -1) return null;
  const bodyStart = start + keyword.length;
  const body = rest.slice(bodyStart);
  let depth = 0;
  let quote = null;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      if (ch === quote) {
        if (quote === "'" && body[i + 1] === "'") i += 1;
        else quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '(' || ch === '[') { depth += 1; continue; }
    if (ch === ')' || ch === ']') { depth -= 1; continue; }
    if (depth !== 0) continue;
    const tail = body.slice(i).toLowerCase();
    for (const stop of stopKeywords) {
      if (tail.startsWith(stop) && (i === 0 || /\s/.test(body[i - 1]))) return body.slice(0, i).trim();
    }
  }
  return body.trim();
}

function parseReference(text) {
  const match = text.match(/references\s+(?:public\.)?"?([A-Za-z0-9_]+)"?\s*\(\s*"?([A-Za-z0-9_]+)"?\s*\)/i);
  if (!match) return null;
  const deleteMatch = text.match(/on\s+delete\s+(cascade|restrict|set\s+null|set\s+default|no\s+action)/i);
  return {
    table: cleanIdentifier(match[1]),
    column: cleanIdentifier(match[2]),
    onDelete: deleteMatch ? deleteMatch[1].toLowerCase().replace(/\s+/g, ' ') : null,
  };
}

function parseColumnDefinition(table, definition) {
  const first = definition.match(/^"?([A-Za-z_][A-Za-z0-9_]*)"?\s+([\s\S]+)$/);
  if (!first) return;
  const name = cleanIdentifier(first[1]);
  const rest = first[2].trim();
  const constraintStart = findConstraintStart(rest);
  const type = rest.slice(0, constraintStart).trim().replace(/\s+/g, ' ');
  const constraints = rest.slice(constraintStart).trim();
  const column = table.columns.get(name) ?? {
    name,
    type,
    notNull: false,
    primaryKey: false,
    unique: false,
    default: null,
    generated: false,
    references: null,
  };
  if (type) column.type = type;
  if (/\bnot\s+null\b/i.test(constraints)) column.notNull = true;
  if (/\bprimary\s+key\b/i.test(constraints)) {
    column.primaryKey = true;
    if (!table.primaryKey.includes(name)) table.primaryKey.push(name);
  }
  if (/\bunique\b/i.test(constraints)) column.unique = true;
  if (/\bgenerated\b/i.test(constraints)) column.generated = true;
  const defaultValue = captureClause(constraints, 'default', ['not null', 'null', 'primary key', 'unique', 'references', 'check', 'generated', 'constraint']);
  if (defaultValue) column.default = defaultValue.replace(/\s+/g, ' ').trim();
  const ref = parseReference(constraints);
  if (ref) {
    column.references = ref;
    table.foreignKeys = table.foreignKeys.filter((fk) => !(fk.columns.length === 1 && fk.columns[0] === name));
    table.foreignKeys.push({ columns: [name], ...ref });
  }
  table.columns.set(name, column);
}

function parseTableConstraint(table, definition) {
  let text = definition.trim();
  text = text.replace(/^constraint\s+"?[A-Za-z0-9_]+"?\s+/i, '');
  let match = text.match(/^primary\s+key\s*\(([^)]+)\)/i);
  if (match) {
    table.primaryKey = parseColumnList(match[1]);
    for (const columnName of table.primaryKey) {
      const column = table.columns.get(columnName);
      if (column) column.primaryKey = true;
    }
    return;
  }
  match = text.match(/^unique(?:\s+nulls\s+not\s+distinct)?\s*\(([^)]+)\)/i);
  if (match) {
    const columns = parseColumnList(match[1]);
    if (!table.uniques.some((item) => item.join('|') === columns.join('|'))) table.uniques.push(columns);
    return;
  }
  match = text.match(/^foreign\s+key\s*\(([^)]+)\)\s+references\s+(?:public\.)?"?([A-Za-z0-9_]+)"?\s*\(([^)]+)\)([\s\S]*)$/i);
  if (match) {
    const columns = parseColumnList(match[1]);
    const targetColumns = parseColumnList(match[3]);
    const deleteMatch = match[4].match(/on\s+delete\s+(cascade|restrict|set\s+null|set\s+default|no\s+action)/i);
    columns.forEach((columnName, index) => {
      const fk = {
        columns: [columnName],
        table: cleanIdentifier(match[2]),
        column: targetColumns[index] ?? targetColumns[0],
        onDelete: deleteMatch ? deleteMatch[1].toLowerCase().replace(/\s+/g, ' ') : null,
      };
      table.foreignKeys.push(fk);
      const column = table.columns.get(columnName);
      if (column) column.references = { table: fk.table, column: fk.column, onDelete: fk.onDelete };
    });
  }
}

function parseCreateTable(schema, statement, migrationName) {
  const match = statement.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([A-Za-z0-9_]+)"?\s*\(([\s\S]*)\)$/i);
  if (!match) return false;
  const table = ensureTable(schema, match[1]);
  table.sourceMigrations.add(migrationName);
  for (const definition of splitTopLevel(match[2])) {
    if (/^(?:constraint\s+\S+\s+)?(?:primary\s+key|unique|foreign\s+key|check)\b/i.test(definition)) {
      parseTableConstraint(table, definition);
    } else {
      parseColumnDefinition(table, definition);
    }
  }
  return true;
}

function parseAlterAction(table, action) {
  const trimmed = action.trim();
  if (/^enable\s+row\s+level\s+security$/i.test(trimmed)) return;
  let match = trimmed.match(/^add\s+column\s+(?:if\s+not\s+exists\s+)?([\s\S]+)$/i);
  if (match) {
    parseColumnDefinition(table, match[1]);
    return;
  }
  match = trimmed.match(/^drop\s+column\s+(?:if\s+exists\s+)?"?([A-Za-z0-9_]+)"?/i);
  if (match) {
    const name = cleanIdentifier(match[1]);
    table.columns.delete(name);
    table.primaryKey = table.primaryKey.filter((item) => item !== name);
    table.uniques = table.uniques.filter((item) => !item.includes(name));
    table.foreignKeys = table.foreignKeys.filter((item) => !item.columns.includes(name));
    return;
  }
  match = trimmed.match(/^alter\s+column\s+"?([A-Za-z0-9_]+)"?\s+drop\s+not\s+null/i);
  if (match) {
    const column = table.columns.get(cleanIdentifier(match[1]));
    if (column) column.notNull = false;
    return;
  }
  match = trimmed.match(/^alter\s+column\s+"?([A-Za-z0-9_]+)"?\s+set\s+not\s+null/i);
  if (match) {
    const column = table.columns.get(cleanIdentifier(match[1]));
    if (column) column.notNull = true;
    return;
  }
  match = trimmed.match(/^alter\s+column\s+"?([A-Za-z0-9_]+)"?\s+set\s+default\s+([\s\S]+)$/i);
  if (match) {
    const column = table.columns.get(cleanIdentifier(match[1]));
    if (column) column.default = match[2].trim().replace(/\s+/g, ' ');
    return;
  }
  match = trimmed.match(/^alter\s+column\s+"?([A-Za-z0-9_]+)"?\s+drop\s+default/i);
  if (match) {
    const column = table.columns.get(cleanIdentifier(match[1]));
    if (column) column.default = null;
    return;
  }
  match = trimmed.match(/^alter\s+column\s+"?([A-Za-z0-9_]+)"?\s+type\s+([^\s].*)$/i);
  if (match) {
    const column = table.columns.get(cleanIdentifier(match[1]));
    if (column) column.type = match[2].split(/\s+using\s+/i)[0].trim();
    return;
  }
  match = trimmed.match(/^rename\s+column\s+"?([A-Za-z0-9_]+)"?\s+to\s+"?([A-Za-z0-9_]+)"?/i);
  if (match) {
    const oldName = cleanIdentifier(match[1]);
    const newName = cleanIdentifier(match[2]);
    const column = table.columns.get(oldName);
    if (column) {
      table.columns.delete(oldName);
      column.name = newName;
      table.columns.set(newName, column);
    }
    table.primaryKey = table.primaryKey.map((item) => item === oldName ? newName : item);
    table.uniques = table.uniques.map((list) => list.map((item) => item === oldName ? newName : item));
    for (const fk of table.foreignKeys) fk.columns = fk.columns.map((item) => item === oldName ? newName : item);
    return;
  }
  match = trimmed.match(/^add\s+(?:constraint\s+"?[A-Za-z0-9_]+"?\s+)?([\s\S]+)$/i);
  if (match) {
    parseTableConstraint(table, match[1]);
    return;
  }
  match = trimmed.match(/^drop\s+constraint\s+(?:if\s+exists\s+)?"?([A-Za-z0-9_]+)"?/i);
  if (match) {
    // Constraint names are intentionally not retained. A replacement constraint
    // later in the migration updates the structural metadata that matters here.
  }
}

function parseAlterTable(schema, statement, migrationName) {
  const match = statement.match(/^alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?(?:public\.)?"?([A-Za-z0-9_]+)"?\s+([\s\S]+)$/i);
  if (!match) return false;
  const table = ensureTable(schema, match[1]);
  table.sourceMigrations.add(migrationName);
  for (const action of splitTopLevel(match[2])) parseAlterAction(table, action);
  return true;
}

function parseDropTable(schema, statement) {
  const match = statement.match(/^drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([A-Za-z0-9_]+)"?/i);
  if (!match) return false;
  schema.tables.delete(cleanIdentifier(match[1]));
  return true;
}

function parseIndex(schema, statement) {
  const match = statement.match(/^create\s+(unique\s+)?index\s+(?:if\s+not\s+exists\s+)?"?([A-Za-z0-9_]+)"?\s+on\s+(?:public\.)?"?([A-Za-z0-9_]+)"?\s*\(([^;]+?)\)(?:\s+where\s+([\s\S]+))?$/i);
  if (!match) return false;
  const table = schema.tables.get(cleanIdentifier(match[3]));
  if (!table) return true;
  const columns = splitTopLevel(match[4]).map((item) => item.trim());
  if (columns.every((item) => /^"?[A-Za-z_][A-Za-z0-9_]*"?(?:\s+(?:asc|desc))?(?:\s+nulls\s+(?:first|last))?$/i.test(item))) {
    table.indexes.push({
      name: cleanIdentifier(match[2]),
      columns: columns.map((item) => cleanIdentifier(item.replace(/\s+(?:asc|desc)(?:\s+nulls\s+(?:first|last))?$/i, ''))),
      unique: Boolean(match[1]),
      where: match[5]?.trim() ?? null,
    });
  }
  return true;
}

function parseMigration(schema, sql, migrationName) {
  const clean = stripSqlComments(sql);
  for (const statement of splitStatements(clean)) {
    if (parseCreateTable(schema, statement, migrationName)) continue;
    if (parseAlterTable(schema, statement, migrationName)) continue;
    if (parseDropTable(schema, statement)) continue;
    parseIndex(schema, statement);
  }
}

function finalizeSchema(schema) {
  for (const table of schema.tables.values()) {
    table.foreignKeys = table.foreignKeys.filter((fk, index, all) =>
      all.findIndex((candidate) => candidate.columns.join('|') === fk.columns.join('|') && candidate.table === fk.table && candidate.column === fk.column) === index
    );
    table.uniques = table.uniques.filter((value, index, all) => all.findIndex((candidate) => candidate.join('|') === value.join('|')) === index);
    table.indexes = table.indexes.filter((value, index, all) => all.findIndex((candidate) => candidate.name === value.name) === index);
  }
}

function dbmlType(type) {
  return type.replace(/^timestamp\s+with\s+time\s+zone$/i, 'timestamptz').replace(/^timestamp\s+without\s+time\s+zone$/i, 'timestamp');
}

function quoteDbmlDefault(value) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, ' ').trim();
  if (/^(?:true|false|null|-?\d+(?:\.\d+)?)$/i.test(compact)) return compact;
  return `\`${compact.replace(/`/g, '\\`')}\``;
}

function renderDbml(schema, migrationNames) {
  const lines = [
    '// GENERATED FILE — DO NOT EDIT DIRECTLY',
    '// Source of Truth: supabase/migrations/*.sql',
    `// Applied migrations: ${migrationNames[0]} .. ${migrationNames.at(-1)}`,
    '// Regenerate: npm run db:docs',
    '',
  ];
  const tables = [...schema.tables.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const table of tables) {
    lines.push(`Table ${table.name} {`);
    for (const column of table.columns.values()) {
      const attrs = [];
      if (column.primaryKey && table.primaryKey.length === 1) attrs.push('pk');
      if (column.notNull) attrs.push('not null');
      if (column.unique) attrs.push('unique');
      const defaultValue = quoteDbmlDefault(column.default);
      if (defaultValue) attrs.push(`default: ${defaultValue}`);
      if (column.references) attrs.push(`ref: > ${column.references.table}.${column.references.column}`);
      const suffix = attrs.length ? ` [${attrs.join(', ')}]` : '';
      lines.push(`  ${column.name} ${dbmlType(column.type)}${suffix}`);
    }
    const indexBlocks = [];
    if (table.primaryKey.length > 1) indexBlocks.push(`    (${table.primaryKey.join(', ')}) [pk]`);
    for (const unique of table.uniques) {
      if (unique.length === 1) {
        const column = table.columns.get(unique[0]);
        if (column) column.unique = true;
      } else indexBlocks.push(`    (${unique.join(', ')}) [unique]`);
    }
    for (const index of table.indexes) {
      if (index.unique && !index.where) indexBlocks.push(`    (${index.columns.join(', ')}) [unique, name: '${index.name}']`);
    }
    if (indexBlocks.length) lines.push('', '  indexes {', ...indexBlocks, '  }');
    lines.push('}', '');
  }
  return `${lines.join('\n').trim()}\n`;
}

function classifyTable(name) {
  if (['venues', 'artists', 'works', 'exhibitions'].includes(name)) return 'Core Master';
  if (/_field_sources$/.test(name) || ['data_sources', 'source_records', 'source_image_candidates', 'import_runs', 'official_venue_crawl_results'].includes(name)) return 'Source / Provenance';
  if (/_tags$/.test(name) || ['exhibition_occurrences', 'exhibition_artists', 'work_artists', 'collection_holdings', 'work_presentations'].includes(name)) return 'Relations';
  if (/candidate|mention|audit|search_keys/.test(name)) return 'Resolution / Audit';
  return 'Other';
}

function serializeSchema(schema, migrationNames) {
  const tables = [...schema.tables.values()].sort((a, b) => a.name.localeCompare(b.name)).map((table) => ({
    name: table.name,
    category: classifyTable(table.name),
    columns: [...table.columns.values()].map((column) => ({
      name: column.name,
      type: dbmlType(column.type),
      primaryKey: column.primaryKey,
      notNull: column.notNull,
      unique: column.unique || table.uniques.some((items) => items.length === 1 && items[0] === column.name),
      default: column.default,
      generated: column.generated,
      reference: column.references,
    })),
    primaryKey: table.primaryKey,
    uniques: table.uniques,
    foreignKeys: table.foreignKeys,
    sourceMigrations: [...table.sourceMigrations].sort(),
  }));
  return { migrations: migrationNames, tables };
}

function escapeHtmlJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
}

function renderHtml(schemaData) {
  const data = escapeHtmlJson(schemaData);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Muuzee Database ER Diagram</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#202124;background:#f6f3ee;--panel:#fffdf9;--line:#d8d2ca;--muted:#76716a;--accent:#a9456f;--master:#fff1f6;--relation:#f0f5ff;--source:#eff8f3;--audit:#fff8e8}*{box-sizing:border-box}body{margin:0;min-height:100vh}.app{display:grid;grid-template-columns:300px 1fr;min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;overflow:auto;padding:24px 18px;border-right:1px solid var(--line);background:rgba(255,253,249,.96);backdrop-filter:blur(10px);z-index:20}.brand{font-size:20px;font-weight:750;letter-spacing:-.02em}.meta{margin-top:6px;color:var(--muted);font-size:12px;line-height:1.5}.search{width:100%;margin:20px 0 10px;padding:12px 13px;border:1px solid var(--line);border-radius:12px;background:white;font-size:14px;outline:none}.search:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(169,69,111,.12)}.hint{font-size:11px;color:var(--muted);margin-bottom:14px}.results{display:flex;flex-direction:column;gap:4px}.result{border:0;background:transparent;text-align:left;padding:8px 9px;border-radius:8px;cursor:pointer;font-size:12px;color:#32302d}.result:hover{background:#f2ede7}.result strong{display:block;font-size:12px}.result span{color:var(--muted)}.main{position:relative;min-width:0}.toolbar{position:sticky;top:0;z-index:10;display:flex;gap:8px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--line);background:rgba(246,243,238,.92);backdrop-filter:blur(10px)}.chip{font-size:11px;padding:6px 9px;border-radius:999px;border:1px solid var(--line);background:var(--panel)}.canvas{position:relative;padding:22px;min-height:100vh}.cards{position:relative;z-index:2;display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px;align-items:start}.table{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 5px 20px rgba(50,40,30,.05);overflow:hidden;transition:opacity .15s,border-color .15s,box-shadow .15s}.table[data-category="Core Master"] .table-head{background:var(--master)}.table[data-category="Relations"] .table-head{background:var(--relation)}.table[data-category="Source / Provenance"] .table-head{background:var(--source)}.table[data-category="Resolution / Audit"] .table-head{background:var(--audit)}.table-head{padding:12px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}.table-name{font-weight:750;font-size:14px}.category{font-size:10px;color:var(--muted)}.column{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:7px 12px;border-bottom:1px solid #eee9e3;font-size:11px;scroll-margin-top:65px}.column:last-child{border-bottom:0}.col-main{min-width:0}.col-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:650;overflow-wrap:anywhere}.col-type{color:var(--muted);margin-top:2px;overflow-wrap:anywhere}.badges{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;max-width:120px}.badge{font-size:9px;padding:2px 5px;border:1px solid #ddd4cc;border-radius:999px;background:white;color:#5f5a54}.badge.fk{border-color:#d8a4bc;color:#8e315a}.column.match{background:#fff4bf}.table.dim{opacity:.28}.table.focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(169,69,111,.1),0 8px 28px rgba(50,40,30,.08)}svg.edges{position:absolute;inset:22px;width:calc(100% - 44px);height:calc(100% - 44px);z-index:1;pointer-events:none;overflow:visible}.edge{fill:none;stroke:#b8afa6;stroke-width:1.1;opacity:.55}.edge.active{stroke:var(--accent);stroke-width:2;opacity:.9}.empty{font-size:12px;color:var(--muted);padding:10px 8px}@media(max-width:820px){.app{grid-template-columns:1fr}.sidebar{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--line)}.cards{grid-template-columns:1fr}svg.edges{display:none}}
</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">Muuzee Database</div>
    <div class="meta" id="meta"></div>
    <input id="search" class="search" type="search" autocomplete="off" placeholder="Search table / column / FK…">
    <div class="hint">Examples: artist_id, source_record_id, venues</div>
    <div class="results" id="results"></div>
  </aside>
  <main class="main">
    <div class="toolbar" id="toolbar"></div>
    <div class="canvas" id="canvas"><svg class="edges" id="edges"></svg><div class="cards" id="cards"></div></div>
  </main>
</div>
<script>
const schema=${data};
const cards=document.getElementById('cards');const search=document.getElementById('search');const results=document.getElementById('results');const edges=document.getElementById('edges');
const latest=schema.migrations.at(-1);document.getElementById('meta').textContent=schema.tables.length+' tables · '+schema.migrations.length+' migrations · through '+latest;
const categories=[...new Set(schema.tables.map(t=>t.category))];document.getElementById('toolbar').innerHTML=categories.map(c=>'<span class="chip">'+c+'</span>').join('');
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function tableId(name){return 'table-'+name.replace(/[^a-z0-9_-]/gi,'-');}function columnId(t,c){return tableId(t)+'--'+c.replace(/[^a-z0-9_-]/gi,'-');}
function render(){cards.innerHTML=schema.tables.map(t=>'<section class="table" id="'+tableId(t.name)+'" data-name="'+esc(t.name)+'" data-category="'+esc(t.category)+'"><header class="table-head"><div><div class="table-name">'+esc(t.name)+'</div><div class="category">'+esc(t.category)+'</div></div><span class="badge">'+t.columns.length+' cols</span></header>'+t.columns.map(c=>{const b=[];if(c.primaryKey)b.push('<span class="badge">PK</span>');if(c.reference)b.push('<span class="badge fk">FK</span>');if(c.unique)b.push('<span class="badge">UQ</span>');if(c.notNull)b.push('<span class="badge">NN</span>');return '<div class="column" id="'+columnId(t.name,c.name)+'" data-table="'+esc(t.name)+'" data-column="'+esc(c.name)+'"><div class="col-main"><div class="col-name">'+esc(c.name)+'</div><div class="col-type">'+esc(c.type)+(c.reference?' → '+esc(c.reference.table)+'.'+esc(c.reference.column):'')+'</div></div><div class="badges">'+b.join('')+'</div></div>'}).join('')+'</section>').join('');requestAnimationFrame(drawEdges)}
function drawEdges(activeTables=new Set()){const canvas=document.getElementById('canvas').getBoundingClientRect();edges.innerHTML='';for(const t of schema.tables){const from=document.getElementById(tableId(t.name));if(!from)continue;for(const fk of t.foreignKeys){const to=document.getElementById(tableId(fk.table));if(!to)continue;const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();const x1=a.left-canvas.left+a.width/2,y1=a.top-canvas.top+a.height/2,x2=b.left-canvas.left+b.width/2,y2=b.top-canvas.top+b.height/2;const bend=Math.max(30,Math.abs(x2-x1)*.35);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M '+x1+' '+y1+' C '+(x1+(x2>x1?bend:-bend))+' '+y1+', '+(x2-(x2>x1?bend:-bend))+' '+y2+', '+x2+' '+y2);path.setAttribute('class','edge'+(activeTables.has(t.name)||activeTables.has(fk.table)?' active':''));edges.appendChild(path)}}}
function searchableEntries(){const items=[];for(const t of schema.tables){items.push({label:t.name,detail:t.category,table:t.name,column:null,text:(t.name+' '+t.category).toLowerCase()});for(const c of t.columns){const target=c.reference?c.reference.table+'.'+c.reference.column:'';items.push({label:t.name+'.'+c.name,detail:c.type+(target?' → '+target:''),table:t.name,column:c.name,text:(t.name+' '+c.name+' '+c.type+' '+target).toLowerCase()})}}return items}const entries=searchableEntries();
function focus(entry){document.querySelectorAll('.table').forEach(el=>el.classList.remove('focus'));const table=document.getElementById(tableId(entry.table));table?.classList.add('focus');const target=entry.column?document.getElementById(columnId(entry.table,entry.column)):table;target?.scrollIntoView({behavior:'smooth',block:'center'});drawEdges(new Set([entry.table]));}
function applySearch(){const q=search.value.trim().toLowerCase();document.querySelectorAll('.column').forEach(el=>el.classList.remove('match'));document.querySelectorAll('.table').forEach(el=>el.classList.remove('dim','focus'));if(!q){results.innerHTML=schema.tables.map(t=>'<button class="result" data-table="'+esc(t.name)+'"><strong>'+esc(t.name)+'</strong><span>'+esc(t.category)+'</span></button>').join('');wire();drawEdges();return}const matches=entries.filter(e=>e.text.includes(q));const tableMatches=new Set(matches.map(e=>e.table));document.querySelectorAll('.table').forEach(el=>{if(!tableMatches.has(el.dataset.name))el.classList.add('dim')});for(const e of matches){if(e.column)document.getElementById(columnId(e.table,e.column))?.classList.add('match')}results.innerHTML=matches.slice(0,100).map((e,i)=>'<button class="result" data-index="'+i+'"><strong>'+esc(e.label)+'</strong><span>'+esc(e.detail)+'</span></button>').join('')||'<div class="empty">No matches</div>';results._matches=matches;wire();drawEdges(tableMatches)}
function wire(){results.querySelectorAll('button[data-table]').forEach(btn=>btn.onclick=()=>focus({table:btn.dataset.table,column:null}));results.querySelectorAll('button[data-index]').forEach(btn=>btn.onclick=()=>focus(results._matches[Number(btn.dataset.index)]));}
render();applySearch();search.addEventListener('input',applySearch);window.addEventListener('resize',()=>drawEdges());
</script>
</body>
</html>\n`;
}

async function writeOrCheck(path, content) {
  if (!CHECK) {
    await writeFile(path, content, 'utf8');
    console.log(`wrote ${relative(ROOT, path)}`);
    return true;
  }
  try {
    const current = await readFile(path, 'utf8');
    if (current === content) {
      console.log(`ok ${relative(ROOT, path)}`);
      return true;
    }
  } catch {}
  console.error(`out of date: ${relative(ROOT, path)}`);
  return false;
}

const migrationNames = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort();
if (!migrationNames.length) throw new Error('No SQL migrations found in supabase/migrations');
const schema = { tables: new Map() };
for (const migrationName of migrationNames) {
  const sql = await readFile(resolve(MIGRATIONS_DIR, migrationName), 'utf8');
  parseMigration(schema, sql, migrationName);
}
finalizeSchema(schema);
const dbml = renderDbml(schema, migrationNames);
const html = renderHtml(serializeSchema(schema, migrationNames));
const resultsOk = await Promise.all([writeOrCheck(OUTPUT_DBML, dbml), writeOrCheck(OUTPUT_HTML, html)]);
if (CHECK && resultsOk.some((ok) => !ok)) process.exitCode = 1;
