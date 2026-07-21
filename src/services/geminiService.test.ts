import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('../constants', () => ({
  API_BASE: '/api',
}));

import {
  generateImage,
  generateText,
  generateAudio,
  suggestNodeConfig,
  fillProjectData,
  generateAIInstructions,
} from './geminiService';

describe('geminiService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockResponse = (data: any, success = true) => ({
    ok: true,
    headers: { get: (name: string) => name === 'content-type' ? 'application/json' : null },
    json: async () => ({ success, data }),
  });

  describe('generateImage', () => {
    it('should call backend with Imagen model for imagen-4', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        generatedImages: [{ image: { imageBytes: 'testbytes', storageUrl: null } }],
      }));

      const result = await generateImage({
        prompt: 'Test prompt',
        model: 'imagen-4.0-generate-001',
        aspectRatio: '1:1',
      });

      expect(result).toBe('data:image/png;base64,testbytes');
    });

    it('should return storage URL when available', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        generatedImages: [{ image: { storageUrl: 'https://storage.url/image.png' } }],
      }));

      const result = await generateImage({
        prompt: 'Test prompt',
        model: 'imagen-4.0-generate-001',
        aspectRatio: '1:1',
      });

      expect(result).toBe('https://storage.url/image.png');
    });

    it('should handle project context in prompt', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        generatedImages: [{ image: { imageBytes: 'testbytes' } }],
      }));

      await generateImage({
        prompt: 'Test prompt',
        model: 'imagen-4.0-generate-001',
        aspectRatio: '1:1',
        projectContext: 'Project: Test Project',
      });

      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.params.prompt).toContain('Project Context: Project: Test Project');
    });

    it('should throw on backend error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: false,
          error: 'API quota exceeded',
        }),
      });

      await expect(generateImage({
        prompt: 'Test prompt',
        model: 'imagen-4.0-generate-001',
        aspectRatio: '1:1',
      })).rejects.toThrow('API quota exceeded');
    });

    it('should handle Nano Banana model with inlineData response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: {
            parts: [{ inlineData: { data: 'nanobananabytes' } }],
          },
        }],
      }));

      const result = await generateImage({
        prompt: 'Test prompt',
        model: 'gemini-3.1-flash-image',
        aspectRatio: '1:1',
      });

      expect(result).toBe('data:image/png;base64,nanobananabytes');
    });

    it('should return storageUrl from Nano Banana response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: {
            parts: [{ inlineData: { storageUrl: 'https://storage.url/nano.png' } }],
          },
        }],
      }));

      const result = await generateImage({
        prompt: 'Test prompt',
        model: 'gemini-3.1-flash-image',
        aspectRatio: '1:1',
      });

      expect(result).toBe('https://storage.url/nano.png');
    });
  });

  describe('generateText', () => {
    it('should call backend and return text response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ text: 'Generated text response' }));

      const result = await generateText({
        prompt: 'Test prompt',
        model: 'gemini-3-flash-preview',
      });

      expect(result).toBe('Generated text response');
    });

    it('should include system instruction when provided', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ text: 'Response' }));

      await generateText({
        prompt: 'Test prompt',
        model: 'gemini-3-flash-preview',
        systemInstruction: 'You are a helpful assistant',
      });

      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.params.config.systemInstruction).toBe('You are a helpful assistant');
    });

    it('should handle project context', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ text: 'Response' }));

      await generateText({
        prompt: 'Test prompt',
        model: 'gemini-3-flash-preview',
        projectContext: 'Project context info',
      });

      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.params.config.systemInstruction).toContain('Project Context:');
    });

    it('should handle maxOutputTokens config', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ text: 'Response' }));

      await generateText({
        prompt: 'Test',
        model: 'gemini-3-flash-preview',
        maxOutputTokens: 1000,
      });

      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.params.config.maxOutputTokens).toBe(1000);
    });
  });

  describe('generateAudio', () => {
    it('should generate audio with TTS model', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: {
            parts: [{ inlineData: { data: 'audiobase64', storageUrl: null } }],
          },
        }],
      }));

      const result = await generateAudio({
        prompt: 'Hello world',
        model: 'gemini-2.5-flash-preview-tts',
        voice: 'Kore',
      });

      expect(result).toBe('data:audio/wav;base64,audiobase64');
    });

    it('should return storage URL when available', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: {
            parts: [{ inlineData: { storageUrl: 'https://storage.url/audio.wav' } }],
          },
        }],
      }));

      const result = await generateAudio({
        prompt: 'Hello world',
        model: 'gemini-2.5-flash-preview-tts',
      });

      expect(result).toBe('https://storage.url/audio.wav');
    });

    it('should call progress callback', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{
          content: {
            parts: [{ inlineData: { data: 'audiobase64' } }],
          },
        }],
      }));

      const onProgress = vi.fn();
      await generateAudio({
        prompt: 'Hello',
        model: 'gemini-2.5-flash-preview-tts',
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('suggestNodeConfig', () => {
    it('should return parsed JSON config', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ 
        text: JSON.stringify({ model: 'veo-3', aspectRatio: '16:9' }) 
      }));

      const result = await suggestNodeConfig({
        nodeType: 'veo',
        userGoal: 'Create cinematic video',
        currentConfig: {},
      });

      expect(result).toEqual({ model: 'veo-3', aspectRatio: '16:9' });
    });

    it('should include project context in prompt', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ text: '{}' }));

      await suggestNodeConfig({
        nodeType: 'imagen',
        userGoal: 'Create image',
        currentConfig: {},
        projectContext: 'Fashion brand project',
      });

      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.params.contents[0].parts[0].text).toContain('Fashion brand project');
    });
  });

  describe('fillProjectData', () => {
    it('should return project data from description', async () => {
      const mockProjectData = {
        projectType: 'marketing',
        name: 'Test Project',
        description: 'A test project',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({ 
        text: JSON.stringify(mockProjectData) 
      }));

      const result = await fillProjectData('Create a marketing campaign');

      expect(result).toEqual(mockProjectData);
    });
  });

  describe('generateAIInstructions', () => {
    it('should generate AI instructions from form data', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ 
        text: 'Use a professional and bold style for all generations.' 
      }));

      const result = await generateAIInstructions({
        type: 'marketing',
        subtype: 'social',
        name: 'Campaign',
        description: 'Social media campaign',
        clientName: 'Acme Corp',
        visualMood: ['bold', 'vibrant'],
        brandPersonality: ['professional'],
        targetAudience: 'Young professionals',
        styleKeywords: 'modern, clean',
        negativeKeywords: 'cluttered',
        primaryColor: '#0097A7',
        secondaryColor: '#000000',
      });

      expect(result).toBe('Use a professional and bold style for all generations.');
    });
  });

  describe('error handling', () => {
    it('should throw on non-JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => '<html>Error</html>',
      });

      await expect(generateText({
        prompt: 'Test',
        model: 'gemini-3-flash-preview',
      })).rejects.toThrow('Server returned non-JSON response');
    });

    it('should throw when no image is generated', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        generatedImages: [],
      }));

      await expect(generateImage({
        prompt: 'Test',
        model: 'imagen-4.0-generate-001',
        aspectRatio: '1:1',
      })).rejects.toThrow();
    });

    it('should throw when no audio is generated', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        candidates: [{ content: { parts: [] } }],
      }));

      await expect(generateAudio({
        prompt: 'Test',
        model: 'gemini-2.5-flash-preview-tts',
      })).rejects.toThrow('No audio generated');
    });
  });
});
