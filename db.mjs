import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Qual banco abrir. O default e' o banco real; quem for testar aponta para outro
// arquivo (ex: GENVAGAS_DB=./genvagas.dev.db) sem risco de tocar dados reais.
export const DB_PATH = process.env.GENVAGAS_DB || './genvagas.db';

const db = new DatabaseSync(DB_PATH);

// O cascade de job_notes depende disto: sem o pragma o SQLite ignora o
// REFERENCES e notas orfas ficariam para tras ao excluir uma vaga.
db.exec('PRAGMA foreign_keys = ON');

// Copia o banco antes de alterar schema. Roda SO quando ha migracao pendente:
// e' o unico momento em que um bug de migracao pode reescrever dados existentes.
// VACUUM INTO gera copia consistente mesmo com o banco aberto.
function backupBeforeMigration(cols) {
  if (!fs.existsSync(DB_PATH)) return; // banco novo: nada a proteger
  const dir = path.join(path.dirname(path.resolve(DB_PATH)), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = path.basename(DB_PATH, '.db');
  const dest = path.join(dir, `${base}-pre-migracao-${stamp}.db`);
  db.exec(`VACUUM INTO '${dest}'`);
  console.log(`[db] migracao pendente (${cols.join(', ')}) — backup: ${dest}`);
}

// Schema de jobs em um so lugar: a migracao do CHECK de closed_reason reconstroi
// a tabela a partir deste texto. Sem isso haveria uma segunda copia do schema,
// que so poderia divergir.
const JOBS_DDL = `
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    applied_at DATE NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('candidated','contacted','interviewing','offer','closed')),
    url TEXT,
    source TEXT CHECK(source IN ('linkedin','indeed','empresa','indicacao','outro')),
    location_type TEXT CHECK(location_type IN ('remoto','hibrido','presencial')),
    status_changed_at DATE,
    opened_at DATE,
    closed_at DATE,
    -- Sem CHECK pelo mesmo motivo de heat: a constraint nao sobrevive a um
    -- rebuild/ALTER, entao valeria so em banco novo. A lista canonica de
    -- desfechos vive em validateJob (server.mjs) e vale para os dois casos.
    closed_reason TEXT,
    position REAL,
    -- Sem CHECK de proposito. heat foi adicionado por ALTER TABLE, que NAO
    -- carrega constraint — entao um banco migrado nunca teria o CHECK e a regra
    -- valeria so em banco novo. Inconsistencia silenciosa (aceita ou rejeita
    -- dependendo de onde o arquivo nasceu) e' pior que ausencia assumida: a
    -- validacao de heat vive em validateJob (server.mjs), valendo para os dois.
    heat TEXT
  )
`;

db.exec(JOBS_DDL);

// CREATE TABLE IF NOT EXISTS nao altera tabela existente, entao bancos antigos
// precisam de ALTER. Cada migracao so roda se a coluna faltar — assim o backup
// acima acontece exatamente uma vez, na primeira subida apos a mudanca de schema.
const MIGRATIONS = [
  { col: 'status_changed_at', sql: 'ALTER TABLE jobs ADD COLUMN status_changed_at DATE' },
  { col: 'position', sql: 'ALTER TABLE jobs ADD COLUMN position REAL' },
  { col: 'heat', sql: 'ALTER TABLE jobs ADD COLUMN heat TEXT' },
  { col: 'opened_at', sql: 'ALTER TABLE jobs ADD COLUMN opened_at DATE' }
];

const existingColumns = () => db.prepare('PRAGMA table_info(jobs)').all().map((c) => c.name);
const pending = MIGRATIONS.filter((m) => !existingColumns().includes(m.col));

// next_action saiu de jobs e virou a tabela job_notes (varias anotacoes por
// vaga). Continua sendo coluna so em banco antigo, e o DROP abaixo a elimina.
const hasNextAction = existingColumns().includes('next_action');

// O CHECK de closed_reason saiu do schema, mas um banco aberto antes da mudanca
// ainda o carrega e ALTER TABLE nao remove constraint. Detecta pela definicao
// viva da tabela (sqlite_master), nao por versao de arquivo: assim um banco ja
// migrado passa reto e a migracao roda exatamente uma vez.
const hasClosedReasonCheck = () => {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'jobs'").get();
  return !!row && /CHECK\s*\(\s*closed_reason/i.test(row.sql);
};

if (pending.length || hasNextAction || hasClosedReasonCheck()) {
  backupBeforeMigration([
    ...pending.map((m) => m.col),
    ...(hasNextAction ? ['next_action'] : []),
    ...(hasClosedReasonCheck() ? ['closed_reason'] : [])
  ]);
  for (const m of pending) db.exec(m.sql);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS job_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    note_date DATE NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT
  )
`);

// Migracao de dados que acompanha o DROP de next_action: sem ela o texto do
// usuario morreria junto com a coluna. Idempotente por construcao — roda so
// enquanto a coluna existir, e o DROP a torna irrepetivel.
if (hasNextAction) {
  db.exec(`
    INSERT INTO job_notes (job_id, note_date, text, created_at)
      SELECT id, COALESCE(status_changed_at, applied_at), next_action, datetime('now')
      FROM jobs WHERE next_action IS NOT NULL AND next_action != ''
  `);
  try {
    db.exec('ALTER TABLE jobs DROP COLUMN next_action');
  } catch (ignored) { /* SQLite antigo sem suporte a DROP COLUMN: dado ja migrado */ }
}

// next_action_at foi substituido por status_changed_at (o alerta de retorno virou
// derivado do ultimo movimento). Tolerante: em banco novo a coluna nunca existiu.
try {
  db.exec('ALTER TABLE jobs DROP COLUMN next_action_at');
} catch (ignored) { /* coluna ja removida ou nunca existiu */ }

// Reconstrucao que tira o CHECK de closed_reason: colunas antigas ja migradas
// acima, entao aqui so copia as colunas em comum, preservando id e linhas.
// PRAGMA foreign_keys precisa sair de ON antes do BEGIN (dentro de transacao o
// pragma e' no-op) porque o DROP da tabela pai dispararia o cascade e apagaria
// as notas de job_notes junto.
if (hasClosedReasonCheck()) {
  const oldColumns = existingColumns();
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(JOBS_DDL.replace('CREATE TABLE IF NOT EXISTS jobs', 'CREATE TABLE jobs_rebuilt'));
    const rebuiltColumns = db.prepare('PRAGMA table_info(jobs_rebuilt)').all().map((c) => c.name);
    const shared = rebuiltColumns.filter((c) => oldColumns.includes(c)).join(', ');
    db.exec(`INSERT INTO jobs_rebuilt (${shared}) SELECT ${shared} FROM jobs`);
    db.exec('DROP TABLE jobs');
    db.exec('ALTER TABLE jobs_rebuilt RENAME TO jobs');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
  console.log('[db] closed_reason: CHECK removido por reconstrucao de jobs');
}

// Backfills: idempotentes (so tocam NULL), entao rodar sempre e' inofensivo.
// Vagas anteriores ao campo de estagnacao usam applied_at como marco zero.
db.exec(`
  UPDATE jobs
  SET status_changed_at = applied_at
  WHERE status_changed_at IS NULL OR status_changed_at = ''
`);

// Ordem inicial = applied_at DESC dentro de cada coluna, que era o que a tela
// mostrava antes de existir `position`. Sem isso os cards "pulariam" de lugar.
db.exec(`
  UPDATE jobs
  SET position = (
    SELECT rn FROM (
      SELECT id AS jid,
             ROW_NUMBER() OVER (PARTITION BY status ORDER BY applied_at DESC, id ASC) AS rn
      FROM jobs
    )
    WHERE jid = jobs.id
  )
  WHERE position IS NULL
`);

export const createJob = db.prepare(`
  INSERT INTO jobs (title, company, applied_at, opened_at, status, url, source, location_type, status_changed_at, closed_at, closed_reason, position, heat)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const getJobs = db.prepare(`
  SELECT * FROM jobs
  ORDER BY position ASC, applied_at DESC, id ASC
`);

export const getJobById = db.prepare('SELECT * FROM jobs WHERE id = ?');

export const updateJob = db.prepare(`
  UPDATE jobs
  SET title = ?, company = ?, applied_at = ?, opened_at = ?, status = ?, url = ?, source = ?,
      location_type = ?, status_changed_at = ?, closed_at = ?,
      closed_reason = ?, position = ?, heat = ?
  WHERE id = ?
`);

// Usado so para calcular onde encaixar um card numa coluna (vizinhos do drop).
export const getPositionsByStatus = db.prepare(`
  SELECT id, position FROM jobs
  WHERE status = ? AND position IS NOT NULL
  ORDER BY position ASC
`);

export const deleteJob = db.prepare('DELETE FROM jobs WHERE id = ?');

// --- anotacoes da vaga (job_notes) ---

// Mais recente primeiro: a data manda, o id desempata notas do mesmo dia para
// que a ultima anotacao escrita apareca no topo.
export const getNotesByJob = db.prepare(`
  SELECT * FROM job_notes WHERE job_id = ? ORDER BY note_date DESC, id DESC
`);

export const createNote = db.prepare(`
  INSERT INTO job_notes (job_id, note_date, text, created_at) VALUES (?, ?, ?, datetime('now'))
`);

export const getNoteById = db.prepare('SELECT * FROM job_notes WHERE id = ?');

export const updateNote = db.prepare(`
  UPDATE job_notes SET note_date = ?, text = ? WHERE id = ?
`);

// job_id entra no WHERE de proposito: apagar /vagas/1/notes/9 nao pode remover
// a nota 9 de outra vaga so porque o id existe.
export const deleteNote = db.prepare('DELETE FROM job_notes WHERE id = ? AND job_id = ?');
