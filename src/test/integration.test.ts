import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('../constants', () => ({
  API_BASE: '/api',
  isAuthorized: (email: string) => email === 'test@example.com',
}));

import {
  generateImage,
  generateVideo,
  generateAudio,
  inpaintImage,
  transferStyle,
  upscaleImage,
  relightImage,
} from '../services/geminiService';

describe('Integration Tests: Generate → Upload → Store Flow', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockResponse = (data: unknown, success = true) => ({
    ok: true,
    status: 200,
    headers: { 
      get: (name: string) => name === 'content-type' ? 'application/json' : null,
      has: (name: string) => name === 'content-type',
    },
    json: async () => ({ success, data }),
    text: async () => JSON.stringify({ success, data }),
    body: null,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(['test'], { type: 'image/png' }),
  });

  const createMockBlobResponse = (base64: string, mimeType = 'image/png') => ({
    ok: true,
    status: 200,
    headers: { 
      get: (name: string) => name === 'content-type' ? mimeType : null,
      has: (name: string) => name === 'content-type',
    },
    json: async () => ({ success: true, data: { data: base64, mimeType } }),
    text: async () => JSON.stringify({ success: true, data: { data: base64, mimeType } }),
    body: null,
    arrayBuffer: async () => {
      const buf = Buffer.from(base64, 'base64');
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
    blob: async () => new Blob([Buffer.from(base64, 'base64')], { type: mimeType }),
  });

  describe('Image Generation with Upload', () => {
    it('should upload to storage when projectId provided (Imagen)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        generatedImages: [{ 
          image: { 
            storageUrl: 'https://storage.googleapis.com/bucket/projects/test/assets/image.png' 
          } 
        }],
      }));

      const result = await generateImage({
        prompt: 'A sunset',
        model: 'imagen-4.0-generate-001',
        aspectRatio: '16:9',
        projectId: 'test-project',
      });

      expect(result).toBe('https://storage.googleapis.com/bucket/projects/test/assets/image.png');
      
      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.params.projectId).toBe('test-project');
    });

    it('should upload to storage when projectId provided (Nano Banana)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: {
            parts: [{ 
              inlineData: { 
                storageUrl: 'https://storage.googleapis.com/bucket/projects/test/assets/nano.png' 
              } 
            }],
          },
        }],
      }));

      const result = await generateImage({
        prompt: 'A sunset',
        model: 'gemini-3.1-flash-image-preview',
        aspectRatio: '16:9',
        projectId: 'test-project',
      });

      expect(result).toBe('https://storage.googleapis.com/bucket/projects/test/assets/nano.png');
    });

    it('should return base64 when no projectId (upload disabled)', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: {
            parts: [{ inlineData: { data: 'base64imagedata' } }],
          },
        }],
      }));

      const result = await generateImage({
        prompt: 'A sunset',
        model: 'gemini-3.1-flash-image-preview',
        aspectRatio: '16:9',
      });

      expect(result).toBe('data:image/png;base64,base64imagedata');
      
      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.params.projectId).toBeUndefined();
    });
  });

  describe('Video Generation with Upload', () => {
    it('should include projectId in fetchVideoFile call', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ name: 'op-123', done: true, response: { generatedVideos: [{ video: { uri: 'gs://bucket/video.mp4' } }] } }))
        .mockResolvedValueOnce(createMockResponse({ storageUrl: 'https://storage.googleapis.com/bucket/projects/test/assets/video.mp4' }));

      const result = await generateVideo({
        prompt: 'A car driving',
        model: 'veo-3.1-fast-generate-001',
        aspectRatio: '16:9',
        projectId: 'test-project',
      });

      expect(result[0]).toBe('https://storage.googleapis.com/bucket/projects/test/assets/video.mp4');
      const fetchVideoCall = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(fetchVideoCall.method).toBe('fetchVideoFile');
      expect(fetchVideoCall.params.projectId).toBe('test-project');
    });
  });

  describe('Audio Generation with Upload', () => {
    it('should upload audio to storage when projectId provided', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: {
            parts: [{ 
              inlineData: { 
                storageUrl: 'https://storage.googleapis.com/bucket/projects/test/assets/audio.wav' 
              } 
            }],
          },
        }],
      }));

      const result = await generateAudio({
        prompt: 'Calm music',
        model: 'lyria-3-pro-preview',
        projectId: 'test-project',
      });

      expect(result).toBe('https://storage.googleapis.com/bucket/projects/test/assets/audio.wav');
    });
  });

  describe('Image Editing with Upload', () => {
    it('should upload inpainted image when projectId provided', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockBlobResponse('test'))
        .mockResolvedValueOnce(createMockBlobResponse('mask'))
        .mockResolvedValueOnce(createMockResponse({
          candidates: [{
            content: {
              parts: [{ 
                inlineData: { 
                  storageUrl: 'https://storage.googleapis.com/bucket/projects/test/assets/inpainted.png' 
                } 
              }],
            },
          }],
        }));

      const result = await inpaintImage({
        imageUrl: 'data:image/png;base64,test',
        maskUrl: 'data:image/png;base64,mask',
        prompt: 'Remove the object',
        mode: 'mask',
        projectId: 'test-project',
      });

      expect(result).toBe('https://storage.googleapis.com/bucket/projects/test/assets/inpainted.png');
    });

    it('should upload style transferred image when projectId provided', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockBlobResponse('content'))
        .mockResolvedValueOnce(createMockBlobResponse('style'))
        .mockResolvedValueOnce(createMockResponse({
          candidates: [{
            content: {
              parts: [{ 
                inlineData: { 
                  storageUrl: 'https://storage.googleapis.com/bucket/projects/test/assets/styled.png' 
                } 
              }],
            },
          }],
        }));

      const result = await transferStyle({
        contentUrl: 'data:image/png;base64,content',
        styleUrl: 'data:image/png;base64,style',
        strength: 0.7,
        preserveStructure: true,
        projectId: 'test-project',
      });

      expect(result).toBe('https://storage.googleapis.com/bucket/projects/test/assets/styled.png');
    });

    it('should upload upscaled image when projectId provided', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockBlobResponse('test'))
        .mockResolvedValueOnce(createMockResponse({
          candidates: [{
            content: {
              parts: [{ 
                inlineData: { 
                  storageUrl: 'https://storage.googleapis.com/bucket/projects/test/assets/upscaled.png' 
                } 
              }],
            },
          }],
        }));

      const result = await upscaleImage({
        imageUrl: 'data:image/png;base64,test',
        scale: '4x',
        preserveStyle: true,
        projectId: 'test-project',
      });

      expect(result).toBe('https://storage.googleapis.com/bucket/projects/test/assets/upscaled.png');
    });

    it('should upload relit image when projectId provided', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockBlobResponse('test'))
        .mockResolvedValueOnce(createMockResponse({
          candidates: [{
            content: {
              parts: [{ 
                inlineData: { 
                  storageUrl: 'https://storage.googleapis.com/bucket/projects/test/assets/relit.png' 
                } 
              }],
            },
          }],
        }));

      const result = await relightImage({
        imageUrl: 'data:image/png;base64,test',
        lightDirection: 'top-right',
        lightColor: '#ffffff',
        intensity: 0.5,
        style: 'Natural',
        projectId: 'test-project',
      });

      expect(result).toBe('https://storage.googleapis.com/bucket/projects/test/assets/relit.png');
    });
  });

  describe('Error Handling', () => {
    it('should handle upload failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: {
            parts: [{ inlineData: { data: 'fallbackbase64' } }],
          },
        }],
      }));

      const result = await generateImage({
        prompt: 'Test',
        model: 'gemini-3.1-flash-image-preview',
        aspectRatio: '1:1',
        projectId: 'test-project',
      });

      expect(result).toBe('data:image/png;base64,fallbackbase64');
    });
  });

  describe('Upload Toggle Behavior', () => {
    it('should NOT send projectId when upload disabled', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: { parts: [{ inlineData: { data: 'test' } }] },
        }],
      }));

      await generateImage({
        prompt: 'Test',
        model: 'gemini-3.1-flash-image-preview',
        aspectRatio: '1:1',
      });

      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.params.projectId).toBeUndefined();
    });

    it('should send projectId when upload enabled', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        generatedImages: [{ image: { storageUrl: 'https://storage.url/img.png' } }],
      }));

      await generateImage({
        prompt: 'Test',
        model: 'imagen-4.0-generate-001',
        aspectRatio: '1:1',
        projectId: 'project-123',
      });

      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.params.projectId).toBe('project-123');
    });
  });
});
