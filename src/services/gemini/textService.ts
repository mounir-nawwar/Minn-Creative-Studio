import { callBackend, imageRefPart } from './client';
import { DEFAULT_TEXT_MODEL } from '../../lib/models';
import type { Project } from '../../types/project.types';

export const generateText = async (params: {
  prompt: string;
  model: string;
  systemInstruction?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  projectContext?: string;
  maxOutputTokens?: number;
  projectId?: string;
  /** Prior turns, oldest first, excluding the current prompt — sent so the model actually has conversational memory */
  history?: { role: 'user' | 'assistant'; content: string }[];
  /** Web search + URL-reading tools — lets the model look up real info instead of guessing */
  grounding?: boolean;
}, signal?: AbortSignal) => {
  const { prompt, model, systemInstruction, imageUrls = [], videoUrls = [], projectContext, maxOutputTokens, projectId, history = [], grounding } = params;

  // Project context is stable across a whole chat, so it belongs in the system
  // instruction (sent identically every turn) rather than re-stated inside the
  // one part of the request that changes each time — that positioning is what
  // lets Gemini's automatic prefix caching actually apply.
  const fullSystemInstruction = projectContext
    ? `${systemInstruction ? `${systemInstruction}\n\n` : ''}Project Context:\n${projectContext}`
    : systemInstruction;

  const parts: any[] = [
    { text: prompt },
    ...await Promise.all([...imageUrls, ...videoUrls].map((url) => imageRefPart(url))),
  ];

  const historyTurns = history.map((h) => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }],
  }));

  try {
    const response = await callBackend('generateContent', {
      model: model,
      contents: [...historyTurns, { role: 'user', parts }],
      config: {
        systemInstruction: fullSystemInstruction,
        ...(maxOutputTokens && { maxOutputTokens }),
        ...(grounding && { tools: [{ googleSearch: {} }, { urlContext: {} }] }),
      },
      projectId,
    }, signal);

    return response.text;
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

export const suggestNodeConfig = async (params: {
  nodeType: string;
  userGoal: string;
  currentConfig: any;
  projectContext?: string;
  projectId?: string;
}, signal?: AbortSignal) => {
  const { nodeType, userGoal, currentConfig, projectContext, projectId } = params;

  try {
    const response = await callBackend('generateContent', {
      model: DEFAULT_TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: `As an AI creative assistant, suggest the best configuration for a ${nodeType} node based on this goal: "${userGoal}".

      ${projectContext ? `Project Context: ${projectContext}` : ''}

      Current configuration: ${JSON.stringify(currentConfig)}

      Return ONLY a JSON object representing the updated configuration fields.` }] }],
      config: {
        responseMimeType: "application/json",
      },
      projectId,
    }, signal);

    return JSON.parse(response.text);
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

export const fillProjectData = async (description: string, signal?: AbortSignal) => {
  const prompt = `
    You are a creative project setup assistant for a professional AI media studio.
    The user will describe their project in natural language.
    Return a JSON object with these exact fields:
    {
      "projectType": "marketing|fashion|advertising|branding|content|product|architecture|film|events|personal",
      "projectSubtype": "string",
      "name": "string",
      "description": "string",
      "clientName": "string",
      "primaryColor": "#hexcode",
      "secondaryColor": "#hexcode",
      "accentColor": "#hexcode",
      "fontStyle": "geometric|serif|handwritten|monospace|display|mixed",
      "visualMood": ["string array from: minimal,bold,luxury,playful,dark,vibrant,soft,raw,corporate,cinematic,editorial,futuristic,natural,retro,abstract"],
      "styleKeywords": "comma separated string",
      "negativeKeywords": "comma separated string",
      "targetAudience": "string",
      "brandPersonality": ["string array from: professional,friendly,luxurious,bold,playful,minimalist,authoritative,warm,edgy,inspirational"],
      "platforms": ["string array from: instagram,tiktok,youtube,facebook,linkedin,pinterest,website,print,email,billboard"],
      "outputFormats": ["string array from: 1:1,9:16,16:9,4:5,1.91:1,A4"],
      "aiInstructions": "detailed paragraph string",
      "deliverables": "string"
    }
    Return only valid JSON, no markdown, no explanation.

    User Description: "${description}"
  `;

  try {
    const response = await callBackend('generateContent', {
      model: DEFAULT_TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    }, signal);

    return JSON.parse(response.text);
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

/**
 * Merges a chat transcript into a project's existing fields — unlike
 * fillProjectData, this is told what the project already knows and is
 * explicitly instructed to combine/reconcile rather than silently drop
 * existing detail the conversation didn't happen to repeat.
 */
export const mergeProjectData = async (transcript: string, existingProject: Partial<Project>, signal?: AbortSignal) => {
  const existingSummary = JSON.stringify({
    name: existingProject.name,
    type: existingProject.type,
    subtype: existingProject.subtype,
    description: existingProject.description,
    clientName: existingProject.clientName,
    clientIndustry: existingProject.clientIndustry,
    targetAudience: existingProject.targetAudience,
    brandPersonality: existingProject.brandPersonality,
    visualMood: existingProject.visualMood,
    styleKeywords: existingProject.styleKeywords,
    negativeKeywords: existingProject.negativeKeywords,
    aiInstructions: existingProject.aiInstructions,
    platforms: existingProject.platforms,
    primaryColor: existingProject.primaryColor,
    secondaryColor: existingProject.secondaryColor,
    accentColor: existingProject.accentColor,
  }, null, 2);

  const prompt = `
    You are a creative project setup assistant for a professional AI media studio.

    Here is everything currently known about this project:
    ${existingSummary}

    Here is a new conversation with the client that surfaced more information:
    ${transcript}

    Return a JSON object with these exact fields:
    {
      "projectType": "marketing|fashion|advertising|branding|content|product|architecture|film|events|personal",
      "projectSubtype": "string",
      "name": "string",
      "description": "string",
      "clientName": "string",
      "primaryColor": "#hexcode",
      "secondaryColor": "#hexcode",
      "accentColor": "#hexcode",
      "fontStyle": "geometric|serif|handwritten|monospace|display|mixed",
      "visualMood": ["string array from: minimal,bold,luxury,playful,dark,vibrant,soft,raw,corporate,cinematic,editorial,futuristic,natural,retro,abstract"],
      "styleKeywords": "comma separated string",
      "negativeKeywords": "comma separated string",
      "targetAudience": "string",
      "brandPersonality": ["string array from: professional,friendly,luxurious,bold,playful,minimalist,authoritative,warm,edgy,inspirational"],
      "platforms": ["string array from: instagram,tiktok,youtube,facebook,linkedin,pinterest,website,print,email,billboard"],
      "outputFormats": ["string array from: 1:1,9:16,16:9,4:5,1.91:1,A4"],
      "aiInstructions": "detailed paragraph string",
      "deliverables": "string"
    }

    MERGE the existing project info with the new conversation:
    - Do NOT drop any detail from the existing info just because this conversation
      didn't repeat it — carry it forward.
    - Combine overlapping information rather than replacing it outright (e.g. merge
      style keyword lists, combine visual moods, union platforms).
    - For "description" specifically, write a thorough business narrative — history,
      what they sell, background, and anything discussed — building on top of the
      existing description rather than discarding it.
    - If the existing project already has a name/type/subtype/colors and the
      conversation didn't address them, keep the existing values exactly.

    Return only valid JSON, no markdown, no explanation.
  `;

  try {
    const response = await callBackend('generateContent', {
      model: DEFAULT_TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      },
      projectId: existingProject.id,
    }, signal);

    return JSON.parse(response.text);
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

export const generateAIInstructions = async (formData: any, signal?: AbortSignal) => {
  const prompt = `
    Generate a set of master AI instructions for a creative project with the following details:
    Project Type: ${formData.type} - ${formData.subtype}
    Project Name: ${formData.name}
    Description: ${formData.description}
    Client: ${formData.clientName}
    Visual Mood: ${formData.visualMood?.join(', ')}
    Tone: ${formData.brandPersonality}
    Target Audience: ${formData.targetAudience}
    Style Keywords: ${formData.styleKeywords}
    Negative Keywords: ${formData.negativeKeywords}
    Colors: Primary ${formData.primaryColor}, Secondary ${formData.secondaryColor}

    Provide a concise, professional paragraph that can be used as a system instruction for an AI creative assistant.
  `;

  try {
    const response = await callBackend('generateContent', {
      model: DEFAULT_TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    }, signal);

    return response.text;
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};
