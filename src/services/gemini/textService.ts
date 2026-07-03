import { callBackend, urlToBase64 } from './client';

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
}, signal?: AbortSignal) => {
  const { prompt, model, systemInstruction, imageUrls = [], videoUrls = [], projectContext, maxOutputTokens, projectId, history = [] } = params;

  // Project context is stable across a whole chat, so it belongs in the system
  // instruction (sent identically every turn) rather than re-stated inside the
  // one part of the request that changes each time — that positioning is what
  // lets Gemini's automatic prefix caching actually apply.
  const fullSystemInstruction = projectContext
    ? `${systemInstruction ? `${systemInstruction}\n\n` : ''}Project Context:\n${projectContext}`
    : systemInstruction;

  const parts: any[] = [{ text: prompt }];

  for (const url of imageUrls) {
    const { data, mimeType } = await urlToBase64(url);
    parts.push({ inlineData: { data, mimeType } });
  }

  for (const url of videoUrls) {
    const { data, mimeType } = await urlToBase64(url);
    parts.push({ inlineData: { data, mimeType } });
  }

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
      model: "gemini-3-flash-preview",
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
      model: "gemini-3-flash-preview",
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
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    }, signal);

    return response.text;
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};
