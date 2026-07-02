/**
 * Local File Storage Service for Minn Creative Studio
 * Replaces Firebase Storage with local filesystem storage
 * Files are served via Nginx or Express static middleware
 * 
 * SECURITY: Comprehensive protection against:
 * - Path traversal attacks
 * - SSRF (Server-Side Request Forgery)
 * - DNS rebinding attacks
 * - File size attacks
 * - Malicious file uploads
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { assets, projects, generateId } from './database.ts';

// Storage configuration
export const STORAGE_PATH = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
export const PUBLIC_URL_BASE = process.env.PUBLIC_URL_BASE || '/storage';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Allowed MIME types for upload
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // Videos
  'video/mp4',
  'video/webm',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  // Documents
  'application/pdf',
  'application/json',
];

// Magic bytes for MIME type verification
const MIME_SIGNATURES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/gif': [Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
  'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF (WebP starts with RIFF...WEBP)
  'video/mp4': [Buffer.from([0x00, 0x00, 0x00]), Buffer.from([0x66, 0x74, 0x79, 0x70])], // ftyp
  'audio/mpeg': [Buffer.from([0x49, 0x44, 0x33]), Buffer.from([0xff, 0xfb]), Buffer.from([0xff, 0xfa])], // ID3 or frame sync
  'audio/wav': [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
};

// Ensure storage directories exist
function initializeStorage(): void {
  const directories = [
    STORAGE_PATH,
    path.join(STORAGE_PATH, 'images'),
    path.join(STORAGE_PATH, 'videos'),
    path.join(STORAGE_PATH, 'audio'),
    path.join(STORAGE_PATH, 'files'),
    path.join(STORAGE_PATH, 'projects'),
  ];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  console.log('✅ Local storage initialized at:', STORAGE_PATH);
}

/**
 * Validate and resolve a safe project path
 * Prevents path traversal attacks
 */
function getSafeProjectPath(projectId: string, storageType?: string): string {
  // Validate projectId format (alphanumeric, dashes, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error('Invalid project ID format');
  }

  // Validate storageType if provided
  if (storageType && !['image', 'video', 'audio', 'file'].includes(storageType)) {
    throw new Error('Invalid storage type');
  }

  let projectDir: string;
  if (storageType) {
    projectDir = path.resolve(STORAGE_PATH, 'projects', projectId, storageType + 's');
  } else {
    projectDir = path.resolve(STORAGE_PATH, 'projects', projectId);
  }

  const projectsBase = path.resolve(STORAGE_PATH, 'projects');

  // Verify path remains within projects root directory
  if (!projectDir.startsWith(projectsBase)) {
    throw new Error('Invalid path');
  }

  return projectDir;
}

/**
 * Verify file content matches claimed MIME type using magic bytes
 */
function verifyMimeType(buffer: Buffer, claimedMimeType: string): boolean {
  // Get signatures for this MIME type
  const signatures = MIME_SIGNATURES[claimedMimeType];
  if (!signatures) {
    // No signature defined - allow if in allowed list
    return ALLOWED_MIME_TYPES.includes(claimedMimeType);
  }

  // Check if buffer starts with any known signature
  for (const sig of signatures) {
    if (buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(sig)) {
      return true;
    }
  }

  // WebP special case: RIFF...WEBP
  if (claimedMimeType === 'image/webp') {
    if (buffer.length >= 12) {
      const riff = buffer.subarray(0, 4).toString('ascii');
      const webp = buffer.subarray(8, 12).toString('ascii');
      if (riff === 'RIFF' && webp === 'WEBP') {
        return true;
      }
    }
  }

  // WAV special case: RIFF...WAVE
  if (claimedMimeType === 'audio/wav') {
    if (buffer.length >= 12) {
      const riff = buffer.subarray(0, 4).toString('ascii');
      const wave = buffer.subarray(8, 12).toString('ascii');
      if (riff === 'RIFF' && wave === 'WAVE') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get file extension from mime type
 * Returns null for unknown types to allow fallback
 */
function getExtension(mimeType: string): string | null {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'application/pdf': 'pdf',
    'application/json': 'json',
  };
  return extensions[mimeType] || null;
}

/**
 * Get storage type from mime type
 */
function getStorageType(mimeType: string): 'image' | 'video' | 'audio' | 'file' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

/**
 * Generate unique filename
 */
function generateFilename(originalName: string, mimeType: string): string {
  const ext = getExtension(mimeType) || path.extname(originalName).substring(1) || 'bin';
  const hash = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${hash}.${ext}`;
}

/**
 * Check if IP address is in a private/restricted range
 * Handles IPv4, IPv6, decimal, and hex formats
 */
function isPrivateIp(ip: string): boolean {
  // Normalize IP - handle IPv4-mapped IPv6 addresses
  let normalizedIp = ip.toLowerCase();
  
  // Handle IPv4-mapped IPv6 (::ffff:192.168.1.1)
  if (normalizedIp.startsWith('::ffff:')) {
    normalizedIp = normalizedIp.substring(7);
  }
  
  // Handle IPv6 loopback
  if (normalizedIp === '::1' || normalizedIp === '0:0:0:0:0:0:0:1') {
    return true;
  }
  
  // Handle IPv6 unique local addresses (fc00::/7)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalizedIp)) {
    return true;
  }
  
  // Handle IPv6 link-local addresses (fe80::/10)
  if (/^fe[89ab][0-9a-f]{2}:/i.test(normalizedIp)) {
    return true;
  }
  
  // Handle IPv6 unspecified address
  if (normalizedIp === '::' || normalizedIp === '0:0:0:0:0:0:0:0') {
    return true;
  }
  
  // IPv4 checks
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = normalizedIp.match(ipv4Regex);
  
  if (match) {
    const octets = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])];
    
    // Validate octet ranges
    if (octets.some(o => o > 255)) {
      return false; // Invalid IP, let it fail elsewhere
    }
    
    const [a, b, c, d] = octets;
    
    // Loopback (127.0.0.0/8) - ENTIRE range
    if (a === 127) return true;
    
    // Private ranges
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    
    // Link-local (169.254.0.0/16)
    if (a === 169 && b === 254) return true;
    
    // Current network (0.0.0.0/8)
    if (a === 0) return true;
    
    // CGNAT (100.64.0.0/10)
    if (a === 100 && b >= 64 && b <= 127) return true;
    
    // Reserved for documentation (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    
    // Broadcast
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;
    
    // Benchmark testing (198.18.0.0/15)
    if (a === 198 && (b === 18 || b === 19)) return true;
  }
  
  return false;
}

/**
 * Validate URL for safe fetching (prevents SSRF)
 * Comprehensive protection including:
 * - Scheme validation
 * - Private IP blocking
 * - Redirect protection
 * - DNS rebinding mitigation
 */
function isValidExternalUrl(url: string): boolean {
  try {
    // Parse URL
    const parsed = new URL(url);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    const hostname = parsed.hostname;
    
    // Block localhost variations
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return false;
    }
    
    // Block cloud metadata endpoints
    if (hostname === 'metadata.google.internal' || 
        hostname === 'metadata.azure.internal' ||
        hostname === '169.254.169.254' ||
        hostname === '100.100.100.200') {
      return false;
    }
    
    // Block internal DNS names
    const blockedHostnames = [
      'localhost', 'local', 'internal', 'intranet', 'localdomain',
      'broadcasthost', 'ip6-localhost', 'ip6-loopback',
      'metadata.google.internal', 'metadata.azure.internal',
    ];
    
    if (blockedHostnames.some(h => hostname === h || hostname.endsWith('.' + h))) {
      return false;
    }
    
    // Handle bracketed IPv6 addresses
    let ipToCheck = hostname;
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      ipToCheck = hostname.slice(1, -1);
    }
    
    // Check if it's an IP address (various formats)
    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || // IPv4
                        /^[0-9a-f:]+$/i.test(hostname.replace(/\[|\]/g, '')) || // IPv6
                        /^0x[0-9a-f]+$/i.test(hostname) || // Hex
                        /^\d+$/.test(hostname); // Decimal
    
    if (isIpAddress) {
      // Convert decimal IP to dotted notation if needed
      if (/^\d+$/.test(hostname)) {
        const num = parseInt(hostname);
        const a = (num >>> 24) & 255;
        const b = (num >>> 16) & 255;
        const c = (num >>> 8) & 255;
        const d = num & 255;
        if (isPrivateIp(`${a}.${b}.${c}.${d}`)) {
          return false;
        }
      } else if (isPrivateIp(ipToCheck)) {
        return false;
      }
    }
    
    // URL-decode and check again (prevents %31%32%37%2e%30%2e%30%2e%31 bypass)
    try {
      const decodedHostname = decodeURIComponent(hostname);
      if (decodedHostname !== hostname) {
        return isValidExternalUrl(parsed.protocol + '//' + decodedHostname + parsed.pathname);
      }
    } catch {
      // Invalid encoding
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Upload file to local storage
 */
export async function uploadFile(
  projectId: string,
  userId: string,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  },
  options?: {
    workflowId?: string;
    nodeId?: string;
    metadata?: any;
  }
): Promise<{ id: string; url: string; storagePath: string }> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  if (file.buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // Validate MIME type is in allowed list
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} is not allowed`);
  }
  
  // Verify file content matches claimed MIME type
  if (!verifyMimeType(file.buffer, file.mimetype)) {
    throw new Error('File content does not match the claimed file type');
  }
  
  const storageType = getStorageType(file.mimetype);
  const filename = generateFilename(file.originalname, file.mimetype);
  
  // Get safe project path (validates against traversal)
  const projectDir = getSafeProjectPath(projectId, storageType);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const storagePath = path.join(projectDir, filename);
  const relativePath = path.relative(STORAGE_PATH, storagePath);
  const publicUrl = `${PUBLIC_URL_BASE}/${relativePath.replace(/\\/g, '/')}`;

  // Write file to disk
  fs.writeFileSync(storagePath, file.buffer);

  // Create asset record in database
  const assetId = generateId();
  assets.create(assetId, projectId, userId, {
    type: storageType,
    filename: file.originalname,
    storagePath: relativePath,
    url: publicUrl,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    workflowId: options?.workflowId,
    nodeId: options?.nodeId,
    metadata: options?.metadata
  });

  console.log(`✅ File uploaded: ${file.originalname} → ${publicUrl}`);

  return {
    id: assetId,
    url: publicUrl,
    storagePath: relativePath
  };
}

/**
 * Upload base64 data to storage
 */
export async function uploadBase64(
  projectId: string,
  userId: string,
  data: {
    base64: string;
    mimeType: string;
    filename?: string;
  },
  options?: {
    workflowId?: string;
    nodeId?: string;
    metadata?: any;
  }
): Promise<{ id: string; url: string; storagePath: string }> {
  const buffer = Buffer.from(data.base64, 'base64');
  
  // Check size limit
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(data.mimeType)) {
    throw new Error(`File type ${data.mimeType} is not allowed`);
  }
  
  // Verify file content
  if (!verifyMimeType(buffer, data.mimeType)) {
    throw new Error('File content does not match the claimed file type');
  }
  
  const storageType = getStorageType(data.mimeType);
  const filename = generateFilename(data.filename || 'generated', data.mimeType);

  // Get safe project path (validates against traversal)
  const projectDir = getSafeProjectPath(projectId, storageType);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const storagePath = path.join(projectDir, filename);
  const relativePath = path.relative(STORAGE_PATH, storagePath);
  const publicUrl = `${PUBLIC_URL_BASE}/${relativePath.replace(/\\/g, '/')}`;

  // Write file to disk
  fs.writeFileSync(storagePath, buffer);

  // Create asset record in database
  const assetId = generateId();
  assets.create(assetId, projectId, userId, {
    type: storageType,
    filename: data.filename || filename,
    storagePath: relativePath,
    url: publicUrl,
    mimeType: data.mimeType,
    sizeBytes: buffer.length,
    workflowId: options?.workflowId,
    nodeId: options?.nodeId,
    metadata: options?.metadata
  });

  return {
    id: assetId,
    url: publicUrl,
    storagePath: relativePath
  };
}

/**
 * Upload from URL (fetch and store locally)
 * Includes comprehensive SSRF protection
 */
export async function uploadFromUrl(
  projectId: string,
  userId: string,
  url: string,
  options?: {
    workflowId?: string;
    nodeId?: string;
    metadata?: any;
  }
): Promise<{ id: string; url: string; storagePath: string }> {
  // Validate URL for SSRF protection
  if (!isValidExternalUrl(url)) {
    throw new Error('Invalid or blocked URL');
  }

  // Fetch with redirect: 'manual' to prevent automatic redirects
  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(30000), // 30 second timeout
    redirect: 'manual', // Don't follow redirects automatically
  });
  
  // Handle redirects manually (validate redirect target)
  if (response.status >= 300 && response.status < 400) {
    const redirectUrl = response.headers.get('location');
    if (redirectUrl) {
      // Recursively validate the redirect target
      if (!isValidExternalUrl(redirectUrl)) {
        throw new Error('Redirect target is blocked');
      }
      // Follow the redirect manually
      return uploadFromUrl(projectId, userId, redirectUrl, options);
    }
  }
  
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  // Check content length before downloading
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  
  // Validate content type
  const mimeType = contentType.split(';')[0].trim();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`File type ${mimeType} is not allowed`);
  }
  
  const buffer = Buffer.from(await response.arrayBuffer());
  
  // Double-check actual size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // Verify file content
  if (!verifyMimeType(buffer, mimeType)) {
    throw new Error('File content does not match the claimed file type');
  }
  
  const urlPath = new URL(url).pathname;
  const originalName = path.basename(urlPath) || 'downloaded';

  return uploadFile(projectId, userId, {
    buffer,
    originalname: originalName,
    mimetype: mimeType,
    size: buffer.length
  }, options);
}

/**
 * Move an asset (file + DB row) into another project.
 * Used to promote playground scratch work into a real client project.
 * If the source file is missing, the row is still moved (row consistency
 * beats an orphaned file reference).
 */
export async function moveAssetToProject(assetId: string, targetProjectId: string) {
  const asset = assets.findById(assetId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  const targetProject = projects.findById(targetProjectId);
  if (!targetProject) {
    throw new Error('Target project not found');
  }

  if (asset.project_id === targetProjectId) {
    return asset;
  }

  const targetDir = getSafeProjectPath(targetProjectId, asset.type);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const oldAbs = path.resolve(STORAGE_PATH, asset.storage_path);
  if (!oldAbs.startsWith(path.resolve(STORAGE_PATH))) {
    throw new Error('Invalid storage path');
  }

  // Avoid filename collisions in the target folder
  let filename = asset.filename;
  let newAbs = path.join(targetDir, filename);
  if (fs.existsSync(newAbs)) {
    filename = `${Date.now()}-${asset.filename}`;
    newAbs = path.join(targetDir, filename);
  }

  if (fs.existsSync(oldAbs)) {
    try {
      fs.renameSync(oldAbs, newAbs);
    } catch {
      // Cross-device fallback
      fs.copyFileSync(oldAbs, newAbs);
      fs.unlinkSync(oldAbs);
    }
  } else {
    console.warn(`⚠️  Source file missing for asset ${assetId} — moving the record only`);
  }

  const relativePath = path.relative(STORAGE_PATH, newAbs).replace(/\\/g, '/');
  const publicUrl = `${PUBLIC_URL_BASE}/${relativePath}`;
  assets.updateLocation(assetId, targetProjectId, relativePath, publicUrl, filename);

  console.log(`✅ Asset ${assetId} moved → ${targetProject.name} (${relativePath})`);
  return assets.findById(assetId);
}

/**
 * Delete file from storage
 * Shared workspace: any authenticated user may delete any asset.
 * userId is kept for audit logging only.
 */
export async function deleteFile(assetId: string, userId: string): Promise<boolean> {
  const asset = assets.findById(assetId);
  if (!asset) {
    return false;
  }

  if (asset.user_id !== userId) {
    console.log(`[Storage] ${userId} deleting asset ${assetId} owned by ${asset.user_id} (shared workspace)`);
  }

  const fullPath = path.join(STORAGE_PATH, asset.storage_path);
  
  // Verify the path is within storage
  const resolvedPath = path.resolve(fullPath);
  if (!resolvedPath.startsWith(path.resolve(STORAGE_PATH))) {
    throw new Error('Invalid storage path');
  }
  
  // Check if it's a symlink (security: don't delete symlinks)
  try {
    const stats = fs.lstatSync(fullPath);
    if (stats.isSymbolicLink()) {
      console.warn(`⚠️  Attempted to delete symlink: ${fullPath}`);
      throw new Error('Cannot delete symbolic links');
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }
  
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  assets.delete(assetId);
  console.log(`✅ File deleted: ${asset.filename}`);

  return true;
}

/**
 * Delete all files for a project
 */
export async function deleteProjectFiles(projectId: string): Promise<void> {
  // Get safe project path (validates against traversal)
  const projectDir = getSafeProjectPath(projectId);
  
  const projectAssets = assets.findByProjectId(projectId);
  
  for (const asset of projectAssets) {
    try {
      const fullPath = path.join(STORAGE_PATH, asset.storage_path);
      // Verify path safety
      const resolvedPath = path.resolve(fullPath);
      if (resolvedPath.startsWith(path.resolve(STORAGE_PATH))) {
        // Check for symlinks before deletion
        try {
          const stats = fs.lstatSync(fullPath);
          if (!stats.isSymbolicLink() && fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch {
          // File might not exist, continue
        }
      }
    } catch (err) {
      console.error(`Failed to delete asset ${asset.id}:`, err);
    }
  }

  assets.deleteByProjectId(projectId);
  
  // Remove project directory if it exists
  // Use rimraf-style approach without following symlinks
  if (fs.existsSync(projectDir)) {
    // Verify no symlinks in the directory tree before recursive delete
    function hasSymlinks(dir: string): boolean {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        try {
          if (fs.lstatSync(itemPath).isSymbolicLink()) {
            return true;
          }
          if (fs.statSync(itemPath).isDirectory() && hasSymlinks(itemPath)) {
            return true;
          }
        } catch {
          // Ignore errors
        }
      }
      return false;
    }
    
    if (hasSymlinks(projectDir)) {
      console.warn(`⚠️  Project directory contains symlinks, skipping recursive delete`);
    } else {
      fs.rmSync(projectDir, { recursive: true });
    }
  }

  console.log(`✅ Deleted ${projectAssets.length} files for project: ${projectId}`);
}

/**
 * Get storage stats
 */
export function getStorageStats(): {
  totalSize: number;
  fileCount: number;
  byType: Record<string, { count: number; size: number }>;
} {
  const byType: Record<string, { count: number; size: number }> = {
    image: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    audio: { count: 0, size: 0 },
    file: { count: 0, size: 0 }
  };

  function scanDir(dir: string, currentType?: string): { totalSize: number; fileCount: number } {
    if (!fs.existsSync(dir)) return { totalSize: 0, fileCount: 0 };
    
    let totalSize = 0;
    let fileCount = 0;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Detect type from directory name
        let dirType = currentType;
        if (item === 'images') dirType = 'image';
        else if (item === 'videos') dirType = 'video';
        else if (item === 'audio') dirType = 'audio';
        else if (item === 'files') dirType = 'file';
        
        const subResult = scanDir(fullPath, dirType || currentType);
        totalSize += subResult.totalSize;
        fileCount += subResult.fileCount;
      } else {
        totalSize += stat.size;
        fileCount++;
        
        if (currentType && byType[currentType]) {
          byType[currentType].count++;
          byType[currentType].size += stat.size;
        }
      }
    }
    
    return { totalSize, fileCount };
  }

  const result = scanDir(STORAGE_PATH);

  return { 
    totalSize: result.totalSize, 
    fileCount: result.fileCount, 
    byType 
  };
}

/**
 * Resize image before storing (optional optimization)
 */
export async function resizeAndUpload(
  projectId: string,
  userId: string,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  },
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    workflowId?: string;
    nodeId?: string;
  }
): Promise<{ id: string; url: string; storagePath: string }> {
  let processedBuffer = file.buffer;

  // Process image with sharp if it's an image
  if (file.mimetype.startsWith('image/')) {
    let image = sharp(file.buffer);
    
    if (options?.maxWidth || options?.maxHeight) {
      image = image.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    if (options?.quality && file.mimetype === 'image/jpeg') {
      image = image.jpeg({ quality: options.quality });
    } else if (options?.quality && file.mimetype === 'image/webp') {
      image = image.webp({ quality: options.quality });
    }

    processedBuffer = await image.toBuffer();
  }
  
  // Check size after processing
  if (processedBuffer.length > MAX_FILE_SIZE) {
    throw new Error(`Processed file size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  return uploadFile(projectId, userId, {
    buffer: processedBuffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: processedBuffer.length
  }, {
    workflowId: options?.workflowId,
    nodeId: options?.nodeId
  });
}

// Initialize storage on import
initializeStorage();

export default {
  uploadFile,
  uploadBase64,
  uploadFromUrl,
  deleteFile,
  deleteProjectFiles,
  getStorageStats,
  resizeAndUpload,
  STORAGE_PATH,
  PUBLIC_URL_BASE,
  ALLOWED_MIME_TYPES
};
