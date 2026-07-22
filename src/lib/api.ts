/**
 * API Client for Minn Creative Studio
 * Replaces Firebase SDK with REST API calls
 */

import { API_BASE } from '../constants';

// Types
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  photoUrl?: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  settings?: any;
  usage: {
    totalCost?: number;
    textCost?: number;
    imageCost?: number;
    videoCost?: number;
    audioCost?: number;
    totalImages?: number;
    totalVideos?: number;
    totalAudio?: number;
    totalTokens?: number;
    lastUpdated?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Workflow {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  nodes: any[];
  edges: any[];
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  user_id: string;
  project_id?: string;
  title: string;
  last_message?: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface MessageAttachment {
  assetId?: string;
  url: string;
  type: 'image' | 'video' | 'audio';
  name?: string;
  model?: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachment[];
  created_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  user_id: string;
  workflow_id?: string;
  node_id?: string;
  type: 'image' | 'video' | 'audio' | 'file';
  filename: string;
  storage_path: string;
  url: string;
  mime_type?: string;
  size_bytes?: number;
  metadata?: any;
  created_at: string;
}

// Token management
let accessToken: string | null = localStorage.getItem('accessToken');
let refreshToken: string | null = localStorage.getItem('refreshToken');

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Build an Authorization header for the current access token.
 * Spread into any fetch() that hits a backend route protected by requireAuth.
 * Returns an empty object when logged out so callers can spread unconditionally.
 */
export function authHeader(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

// API request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  if (response.status === 401) {
    // Try to refresh token
    if (refreshToken) {
      const refreshed = await auth.refreshToken(refreshToken);
      if (refreshed) {
        // Retry the request with new token
        headers['Authorization'] = `Bearer ${accessToken}`;
        const retryResponse = await fetch(url, {
          ...options,
          headers
        });
        if (!retryResponse.ok) {
          throw new Error(`API Error: ${retryResponse.status}`);
        }
        return retryResponse.json();
      }
    }
    // Clear tokens and throw
    clearTokens();
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }
  
  return response.json();
}

// Auth API
export const auth = {
  login: async (username: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    
    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },
  
  logout: async (): Promise<void> => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    clearTokens();
  },
  
  refreshToken: async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token })
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      setTokens(data.accessToken, refreshToken!);
      return true;
    } catch {
      return false;
    }
  },
  
  me: async (): Promise<{ authenticated: boolean; user?: User }> => {
    return apiRequest('/auth/me');
  },
  
  getCurrentUser: (): User | null => {
    // This should be called after successful login
    // Returns null if not authenticated
    if (!accessToken) return null;
    
    // We should store user info in localStorage too
    const userJson = localStorage.getItem('currentUser');
    return userJson ? JSON.parse(userJson) : null;
  },
  
  setCurrentUser: (user: User): void => {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
};

// Projects API
export const projectsApi = {
  list: (): Promise<Project[]> => apiRequest('/projects'),

  get: (id: string): Promise<Project> => apiRequest(`/projects/${id}`),

  /** Idempotently create/fetch the shared hidden Playground sentinel project */
  ensurePlayground: (): Promise<Project> =>
    apiRequest('/projects/playground', { method: 'POST' }),
  
  create: (data: { name: string; description?: string; settings?: any }): Promise<Project> =>
    apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  update: (id: string, data: Partial<Project>): Promise<Project> =>
    apiRequest(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  delete: (id: string): Promise<void> =>
    apiRequest(`/projects/${id}`, { method: 'DELETE' }),
  
  getUsage: (id: string): Promise<any[]> =>
    apiRequest(`/projects/${id}/usage`)
};

// Workflows API
export const workflowsApi = {
  list: (projectId?: string): Promise<Workflow[]> => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return apiRequest(`/workflows${query}`);
  },
  
  get: (id: string): Promise<Workflow> => apiRequest(`/workflows/${id}`),

  /**
   * Cheap revision probe for canvas live sync (no graph payload). `token` is the
   * clientToken of whoever last saved via PUT, echoed so the poller can ignore
   * its own writes; null when the last write came from elsewhere (MCP/runner).
   */
  getVersion: (id: string): Promise<{ id: string; updatedAt: string; token: string | null }> =>
    apiRequest(`/workflows/${id}/version`),

  create: (data: { projectId: string; name?: string; nodes?: any[]; edges?: any[] }): Promise<Workflow> =>
    apiRequest('/workflows', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  update: (id: string, data: Partial<Workflow> & { clientToken?: string }): Promise<Workflow> =>
    apiRequest(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  delete: (id: string): Promise<void> =>
    apiRequest(`/workflows/${id}`, { method: 'DELETE' })
};

// Chats API
export const chatsApi = {
  list: (): Promise<Chat[]> => apiRequest('/chats'),
  
  get: (id: string): Promise<Chat & { messages: ChatMessage[] }> =>
    apiRequest(`/chats/${id}`),
  
  getMessages: (chatId: string): Promise<ChatMessage[]> =>
    apiRequest(`/chats/${chatId}/messages`),
  
  create: (data: { title?: string; projectId?: string }): Promise<Chat> =>
    apiRequest('/chats', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  addMessage: (
    chatId: string,
    role: 'user' | 'assistant',
    content: string,
    attachments?: MessageAttachment[]
  ): Promise<ChatMessage> =>
    apiRequest(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content, ...(attachments?.length ? { attachments } : {}) })
    }),

  /** Delete a single message — trims context out of a chat without deleting the whole thing */
  deleteMessage: (chatId: string, messageId: string): Promise<void> =>
    apiRequest(`/chats/${chatId}/messages/${messageId}`, { method: 'DELETE' }),
  
  update: (id: string, data: { title?: string; projectId?: string; moveAssets?: boolean }): Promise<Chat> =>
    apiRequest(`/chats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  delete: (id: string): Promise<void> =>
    apiRequest(`/chats/${id}`, { method: 'DELETE' })
};

export interface LibraryFilters {
  type?: string;
  projectId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

// Assets API
export const assetsApi = {
  list: (
    projectId: string,
    options?: { type?: string; q?: string; limit?: number; offset?: number }
  ): Promise<Asset[]> => {
    const params = new URLSearchParams({ projectId });
    if (options?.type && options.type !== 'all') params.set('type', options.type);
    if (options?.q) params.set('q', options.q);
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    return apiRequest(`/assets?${params.toString()}`);
  },

  /** Resolve an asset's real record from its /storage URL — null if nothing matches (e.g. an unsaved output) */
  findByUrl: async (url: string): Promise<Asset | null> => {
    try {
      return await apiRequest(`/assets/by-url?url=${encodeURIComponent(url)}`);
    } catch {
      return null;
    }
  },

  /** Global library: all assets across projects, with project_name from the join */
  listAll: (filters: LibraryFilters = {}): Promise<(Asset & { project_name?: string })[]> => {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.projectId) params.set('projectId', filters.projectId);
    if (filters.q) params.set('q', filters.q);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset) params.set('offset', String(filters.offset));
    const query = params.toString();
    return apiRequest(`/assets/all${query ? `?${query}` : ''}`);
  },
  
  get: (id: string): Promise<Asset> => apiRequest(`/assets/${id}`),
  
  upload: async (
    projectId: string,
    file: File,
    options?: { workflowId?: string; nodeId?: string; metadata?: any }
  ): Promise<{ id: string; url: string; storagePath: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    if (options?.workflowId) formData.append('workflowId', options.workflowId);
    if (options?.nodeId) formData.append('nodeId', options.nodeId);
    if (options?.metadata) formData.append('metadata', JSON.stringify(options.metadata));
    
    const response = await fetch(`${API_BASE}/assets/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    return response.json();
  },
  
  uploadBase64: (
    projectId: string,
    data: { base64: string; mimeType: string; filename?: string },
    options?: { workflowId?: string; nodeId?: string; metadata?: any }
  ): Promise<{ id: string; url: string; storagePath: string }> =>
    apiRequest('/assets/base64', {
      method: 'POST',
      body: JSON.stringify({ projectId, ...data, ...options })
    }),
  
  uploadFromUrl: (
    projectId: string,
    url: string,
    options?: { workflowId?: string; nodeId?: string; metadata?: any }
  ): Promise<{ id: string; url: string; storagePath: string }> =>
    apiRequest('/assets/url', {
      method: 'POST',
      body: JSON.stringify({ projectId, url, ...options })
    }),
  
  /** Move an asset (file + record) into another project */
  move: (id: string, targetProjectId: string): Promise<Asset> =>
    apiRequest(`/assets/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ targetProjectId })
    }),

  delete: (id: string): Promise<void> =>
    apiRequest(`/assets/${id}`, { method: 'DELETE' })
};

// Chat presets API (Chat Studio system-instruction templates)
export interface ChatPreset {
  id: string;
  user_id: string;
  name: string;
  system_instruction: string;
  created_at: string;
}

export const presetsApi = {
  list: (): Promise<ChatPreset[]> => apiRequest('/presets'),

  create: (data: { name: string; systemInstruction: string }): Promise<ChatPreset> =>
    apiRequest('/presets', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  update: (id: string, data: { name?: string; systemInstruction?: string }): Promise<ChatPreset> =>
    apiRequest(`/presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  delete: (id: string): Promise<void> =>
    apiRequest(`/presets/${id}`, { method: 'DELETE' })
};

// Export all
export default {
  auth,
  projects: projectsApi,
  workflows: workflowsApi,
  chats: chatsApi,
  assets: assetsApi,
  presets: presetsApi,
  setTokens,
  clearTokens,
  getAccessToken
};
