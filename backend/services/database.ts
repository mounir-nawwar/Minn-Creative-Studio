/**
 * SQLite Database Service for Minn Creative Studio
 * Replaces Firebase Firestore with a lightweight SQLite database
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path - stored in data directory
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/minn-studio.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
// Enable foreign key enforcement
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeSchema(): void {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      photo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      settings TEXT,
      usage TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Workflows table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      nodes TEXT NOT NULL DEFAULT '[]',
      edges TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Chats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      title TEXT NOT NULL,
      last_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )
  `);

  // Assets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      workflow_id TEXT,
      node_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('image', 'video', 'audio', 'file')),
      filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      url TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL
    )
  `);

  // Usage logs table (for cost tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('image', 'video', 'audio', 'text')),
      cost REAL NOT NULL DEFAULT 0,
      token_count INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Prompts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Chat presets table (reusable system-instruction templates for Chat Studio)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_presets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      system_instruction TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON workflows(project_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
    CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_project_id ON usage_logs(project_id);
    CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
  `);

  console.log('✅ SQLite database schema initialized');
}

/**
 * Guarded ALTER TABLE migration: adds a column only if it doesn't exist yet.
 * SQLite has no "ADD COLUMN IF NOT EXISTS", so check PRAGMA table_info first.
 */
function ensureColumn(table: string, column: string, ddl: string): void {
  const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    console.log(`✅ Migration: added ${table}.${column}`);
  }
}

function runMigrations(): void {
  // Chat Studio: structured media attachments on messages (JSON array)
  ensureColumn('messages', 'attachments', "attachments TEXT NOT NULL DEFAULT '[]'");
}

// Password hashing utilities
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function hashPasswordAsync(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  // Use constant-time comparison
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

export async function verifyPasswordAsync(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      else {
        // Use constant-time comparison
        resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey));
      }
    });
  });
}

// Generate unique ID
export function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// User operations
export const users = {
  create: (id: string, username: string, email: string, password: string, displayName?: string) => {
    const stmt = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, username, email, hashPassword(password), displayName || username);
    return { id, username, email, displayName: displayName || username };
  },

  findById: (id: string) => {
    const stmt = db.prepare('SELECT id, username, email, display_name, photo_url, created_at, last_login FROM users WHERE id = ?');
    return stmt.get(id) as any;
  },

  findByUsername: (username: string) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as any;
  },

  findByEmail: (email: string) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as any;
  },

  updateLastLogin: (id: string) => {
    const stmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);
  },

  getAll: () => {
    const stmt = db.prepare('SELECT id, username, email, display_name, photo_url, created_at FROM users');
    return stmt.all() as any[];
  }
};

/**
 * Sentinel shared "Playground" project id.
 * Backs playground mode (canvas/chat without a real project) so every
 * NOT NULL project_id path (workflows, assets, usage_logs) keeps working.
 * Hidden from findAll() so it never shows up in project lists.
 */
export const PLAYGROUND_PROJECT_ID = 'playground';

// Project operations
export const projects = {
  create: (id: string, userId: string, name: string, description?: string, settings?: any) => {
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, name, description, settings, usage)
      VALUES (?, ?, ?, ?, ?, '{}')
    `);
    stmt.run(id, userId, name, description || null, settings ? JSON.stringify(settings) : null);
    return { id, userId, name, description, settings, usage: {} };
  },

  findById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
    const project = stmt.get(id) as any;
    if (project) {
      project.settings = project.settings ? JSON.parse(project.settings) : null;
      project.usage = project.usage ? JSON.parse(project.usage) : {};
    }
    return project;
  },

  findByUserId: (userId: string) => {
    const stmt = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC');
    const projectList = stmt.all(userId) as any[];
    return projectList.map(p => ({
      ...p,
      settings: p.settings ? JSON.parse(p.settings) : null,
      usage: p.usage ? JSON.parse(p.usage) : {}
    }));
  },

  // Shared workspace: all projects are visible to every authorized user.
  // The frontend marks a project "shared" when its user_id !== current user.
  // The playground sentinel is excluded — it's entered explicitly, never listed.
  findAll: () => {
    const stmt = db.prepare('SELECT * FROM projects WHERE id != ? ORDER BY updated_at DESC');
    const projectList = stmt.all(PLAYGROUND_PROJECT_ID) as any[];
    return projectList.map(p => ({
      ...p,
      settings: p.settings ? JSON.parse(p.settings) : null,
      usage: p.usage ? JSON.parse(p.usage) : {}
    }));
  },

  update: (id: string, data: { name?: string; description?: string; settings?: any; usage?: any }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.settings !== undefined) { fields.push('settings = ?'); values.push(JSON.stringify(data.settings)); }
    if (data.usage !== undefined) { fields.push('usage = ?'); values.push(JSON.stringify(data.usage)); }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(id);
  }
};

// Workflow operations
export const workflows = {
  create: (id: string, projectId: string, userId: string, name: string, nodes: any[] = [], edges: any[] = []) => {
    const stmt = db.prepare(`
      INSERT INTO workflows (id, project_id, user_id, name, nodes, edges)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, projectId, userId, name, JSON.stringify(nodes), JSON.stringify(edges));
    return { id, projectId, userId, name, nodes, edges };
  },

  findById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
    const workflow = stmt.get(id) as any;
    if (workflow) {
      workflow.nodes = JSON.parse(workflow.nodes);
      workflow.edges = JSON.parse(workflow.edges);
    }
    return workflow;
  },

  findByProjectId: (projectId: string) => {
    const stmt = db.prepare('SELECT * FROM workflows WHERE project_id = ? ORDER BY updated_at DESC');
    const workflowList = stmt.all(projectId) as any[];
    return workflowList.map(w => ({
      ...w,
      nodes: JSON.parse(w.nodes),
      edges: JSON.parse(w.edges)
    }));
  },

  findByUserId: (userId: string) => {
    const stmt = db.prepare('SELECT * FROM workflows WHERE user_id = ? ORDER BY updated_at DESC');
    const workflowList = stmt.all(userId) as any[];
    return workflowList.map(w => ({
      ...w,
      nodes: JSON.parse(w.nodes),
      edges: JSON.parse(w.edges)
    }));
  },

  update: (id: string, data: { name?: string; nodes?: any[]; edges?: any[] }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.nodes !== undefined) { fields.push('nodes = ?'); values.push(JSON.stringify(data.nodes)); }
    if (data.edges !== undefined) { fields.push('edges = ?'); values.push(JSON.stringify(data.edges)); }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE workflows SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM workflows WHERE id = ?');
    stmt.run(id);
  }
};

// Chat operations
export const chats = {
  create: (id: string, userId: string, title: string, projectId?: string) => {
    const stmt = db.prepare(`
      INSERT INTO chats (id, user_id, project_id, title)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, userId, projectId || null, title);
    return { id, userId, projectId, title };
  },

  findById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM chats WHERE id = ?');
    return stmt.get(id) as any;
  },

  findByUserId: (userId: string) => {
    const stmt = db.prepare('SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC');
    return stmt.all(userId) as any[];
  },

  update: (id: string, data: { title?: string; lastMessage?: string }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.lastMessage !== undefined) { fields.push('last_message = ?'); values.push(data.lastMessage); }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE chats SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM chats WHERE id = ?');
    stmt.run(id);
  }
};

// Structured media reference carried by a chat message (Chat Studio inline generation)
export interface MessageAttachment {
  assetId?: string;
  url: string;
  type: 'image' | 'video' | 'audio';
  name?: string;
  model?: string;
}

function parseAttachments(raw: unknown): MessageAttachment[] {
  if (typeof raw !== 'string' || raw === '') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Message operations
export const messages = {
  create: (id: string, chatId: string, role: 'user' | 'assistant', content: string, attachments: MessageAttachment[] = []) => {
    const stmt = db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, attachments)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, chatId, role, content, JSON.stringify(attachments));

    // Update chat's last_message and updated_at
    const updateChat = db.prepare('UPDATE chats SET last_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    updateChat.run(content.substring(0, 200), chatId);

    return { id, chatId, role, content, attachments };
  },

  findByChatId: (chatId: string) => {
    const stmt = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC');
    const messageList = stmt.all(chatId) as any[];
    return messageList.map((m) => ({ ...m, attachments: parseAttachments(m.attachments) }));
  },

  deleteByChatId: (chatId: string) => {
    const stmt = db.prepare('DELETE FROM messages WHERE chat_id = ?');
    stmt.run(chatId);
  }
};

// Asset operations
export const assets = {
  create: (id: string, projectId: string, userId: string, data: {
    type: 'image' | 'video' | 'audio' | 'file';
    filename: string;
    storagePath: string;
    url?: string;
    mimeType?: string;
    sizeBytes?: number;
    workflowId?: string;
    nodeId?: string;
    metadata?: any;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO assets (id, project_id, user_id, workflow_id, node_id, type, filename, storage_path, url, mime_type, size_bytes, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, projectId, userId, data.workflowId || null, data.nodeId || null,
      data.type, data.filename, data.storagePath, data.url || null,
      data.mimeType || null, data.sizeBytes || null, JSON.stringify(data.metadata || {})
    );
    return { id, projectId, userId, ...data };
  },

  findById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM assets WHERE id = ?');
    const asset = stmt.get(id) as any;
    if (asset && asset.metadata) {
      asset.metadata = JSON.parse(asset.metadata);
    }
    return asset;
  },

  findByProjectId: (projectId: string, type?: string) => {
    let query = 'SELECT * FROM assets WHERE project_id = ?';
    const params: any[] = [projectId];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const stmt = db.prepare(query);
    const assetList = stmt.all(...params) as any[];
    return assetList.map(a => ({
      ...a,
      metadata: a.metadata ? JSON.parse(a.metadata) : {}
    }));
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM assets WHERE id = ?');
    stmt.run(id);
  },

  deleteByProjectId: (projectId: string) => {
    const stmt = db.prepare('DELETE FROM assets WHERE project_id = ?');
    stmt.run(projectId);
  }
};

// Usage tracking operations
export const usageLogs = {
  log: (projectId: string, userId: string, type: 'image' | 'video' | 'audio' | 'text', cost: number, tokenCount?: number, metadata?: any) => {
    const stmt = db.prepare(`
      INSERT INTO usage_logs (project_id, user_id, type, cost, token_count, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(projectId, userId, type, cost, tokenCount || 0, JSON.stringify(metadata || {}));

    // Update project usage summary
    const updateProject = db.prepare(`
      UPDATE projects SET usage = json_set(
        COALESCE(usage, '{}'),
        '$.totalCost', COALESCE(json_extract(usage, '$.totalCost'), 0) + ?,
        '$.total${type.charAt(0).toUpperCase() + type.slice(1)}s', COALESCE(json_extract(usage, '$.total${type.charAt(0).toUpperCase() + type.slice(1)}s'), 0) + 1,
        '$.totalTokens', COALESCE(json_extract(usage, '$.totalTokens'), 0) + ?,
        '$.lastUpdated', datetime('now')
      )
      WHERE id = ?
    `);
    updateProject.run(cost, tokenCount || 0, projectId);
  },

  getByProjectId: (projectId: string, startDate?: Date, endDate?: Date) => {
    let query = 'SELECT * FROM usage_logs WHERE project_id = ?';
    const params: any[] = [projectId];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate.toISOString());
    }

    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const logs = stmt.all(...params) as any[];
    return logs.map(l => ({
      ...l,
      metadata: l.metadata ? JSON.parse(l.metadata) : {}
    }));
  }
};

/**
 * Track project cost - wraps usageLogs.log with project lookup for userId
 * This is a convenience function that matches the Firebase API
 */
export async function trackProjectCost(
  projectId: string,
  cost: number,
  metadata: {
    imageCount?: number;
    videoCount?: number;
    audioCount?: number;
    tokenCount?: number;
    type: 'image' | 'video' | 'audio' | 'text';
  }
): Promise<void> {
  if (cost <= 0) return;

  // Get project to find the user
  const project = projects.findById(projectId);
  if (!project) {
    console.warn(`[Cost] Project ${projectId} not found, skipping cost tracking`);
    return;
  }

  const userId = project.user_id;

  usageLogs.log(projectId, userId, metadata.type, cost, metadata.tokenCount, {
    imageCount: metadata.imageCount,
    videoCount: metadata.videoCount,
    audioCount: metadata.audioCount,
  });

  console.log(`[Cost] $${cost.toFixed(4)} for ${metadata.type} · projectId=${projectId}`);
}

// Prompts operations
export const prompts = {
  create: (id: string, userId: string, text: string, tags?: string[]) => {
    const stmt = db.prepare(`
      INSERT INTO prompts (id, user_id, text, tags)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, userId, text, tags ? JSON.stringify(tags) : null);
    return { id, userId, text, tags: tags || [] };
  },

  getAll: (userId?: string) => {
    let query = 'SELECT * FROM prompts';
    const params: any[] = [];

    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const promptList = stmt.all(...params) as any[];
    return promptList.map(p => ({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : []
    }));
  },

  getById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM prompts WHERE id = ?');
    const prompt = stmt.get(id) as any;
    if (prompt) {
      prompt.tags = prompt.tags ? JSON.parse(prompt.tags) : [];
    }
    return prompt;
  },

  update: (id: string, data: { text?: string; tags?: string[] }) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.text !== undefined) { fields.push('text = ?'); values.push(data.text); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)); }

    if (fields.length === 0) return;

    values.push(id);
    const stmt = db.prepare(`UPDATE prompts SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM prompts WHERE id = ?');
    stmt.run(id);
  }
};

// Initialize schema on import
initializeSchema();
runMigrations();

export { db };
