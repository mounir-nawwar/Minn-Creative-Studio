// Re-export barrel — all consumers import from here unchanged.
// Implementation is split across src/services/gemini/*.ts

export { urlToBase64 } from './gemini/client';
export { generateImage, generateMask, upscaleImage, relightImage, inpaintImage, transferStyle, generateVariations } from './gemini/imageService';
export { generateVideo } from './gemini/videoService';
export { generateAudio } from './gemini/audioService';
export { generateText, suggestNodeConfig, fillProjectData, generateAIInstructions } from './gemini/textService';
