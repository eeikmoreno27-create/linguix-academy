
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { UserPreferences, Exercise, LANGUAGES } from "./types";

// Instancia única del cliente usando la variable de entorno obligatoria
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Utilidades de codificación/decodificación para Audio PCM (Live API & TTS)
 */
export const decodeBase64 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

/**
 * Generación de ejercicios dinámicos con protocolo de error en español
 */
export const generateExercises = async (prefs: UserPreferences): Promise<Exercise[]> => {
  try {
    const ai = getAI();
    const targetLang = LANGUAGES.find(l => l.code === prefs.targetLanguage)?.name || 'Inglés';
    
    const prompt = `Actúa como Linguix, el motor de IA de ERIK ZAVALA. 
    Genera 5 ejercicios de ${targetLang} nivel ${prefs.subLevel}/1000. 
    Meta del usuario: ${prefs.goal}. 
    PROTOCOLO DE CORRECCIÓN: Si el usuario falla, la explicación DEBE ser en ESPAÑOL y empezar obligatoriamente con "Estás mal, se dice..." seguido de la corrección y por qué estaba mal.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING, description: "phonetic, multiple_choice, fill_blank, translation, pronunciation" },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING, description: "Formato: 'Estás mal, se dice...' [corrección en español]" },
              topic: { type: Type.STRING }
            },
            required: ["id", "type", "question", "correctAnswer", "options", "explanation"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Linguix AI Generation Error:", e);
    return [];
  }
};

/**
 * Motor de Voz (TTS) para feedback instantáneo
 */
export const speakText = async (text: string, langCode: string): Promise<string | undefined> => {
  try {
    const ai = getAI();
    const lang = LANGUAGES.find(l => l.code === langCode);
    const voiceName = lang?.voice || 'Kore';
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.find(p => !!p.inlineData)?.inlineData?.data;
  } catch (e) {
    return undefined;
  }
};

/**
 * Conexión Live API para charla en tiempo real con tutor 3D
 */
export const getGeminiLiveSession = (prefs: UserPreferences, callbacks: any) => {
  const ai = getAI();
  const targetLang = LANGUAGES.find(l => l.code === prefs.targetLanguage)?.name || 'Inglés';
  
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      systemInstruction: `Eres Linguix, un tutor de idiomas profesional creado por ERIK ZAVALA.
      Tu alumno tiene nivel ${prefs.subLevel}/1000 y su meta es: ${prefs.goal}.
      
      REGLAS DE ORO DE CONVERSACIÓN:
      1. Conversa naturalmente en ${targetLang}.
      2. Si el usuario comete un error gramatical o de pronunciación, INTERRÚMPELO.
      3. Di en ESPAÑOL: "Estás mal, se dice..." y da la forma correcta.
      4. Explica el error en ESPAÑOL brevemente y pídele que repita.
      5. Una vez corregido satisfactoriamente, retoma el hilo de la charla en ${targetLang}.
      6. No rompas el personaje de tutor experto de ERIK ZAVALA.`,
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    }
  });
};

/**
 * Respuestas para simulador de escenarios (Chat Pro)
 */
export const getScenarioResponse = async (history: any[], prefs: UserPreferences): Promise<string | undefined> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: history,
      config: {
        systemInstruction: `Eres el tutor Linguix de ERIK ZAVALA. Sé profesional. Si el alumno falla, corrígelo en español empezando con "Estás mal, se dice...".`
      }
    });
    return response.text;
  } catch (e) {
    return undefined;
  }
};

/**
 * Contenido para minijuegos de vocabulario
 */
export const generateGameContent = async (prefs: UserPreferences): Promise<{ word: string, translation: string }[]> => {
  try {
    const ai = getAI();
    const targetLang = LANGUAGES.find(l => l.code === prefs.targetLanguage)?.name || 'Inglés';
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Genera 10 pares de vocabulario Linguix (by Erik Zavala) nivel ${prefs.subLevel} para ${targetLang}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              translation: { type: Type.STRING }
            },
            required: ["word", "translation"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (e) {
    return [];
  }
};

/**
 * Generador de misiones/escenarios de inmersión
 */
export const generateScenario = async (prefs: UserPreferences): Promise<any> => {
  try {
    const ai = getAI();
    const targetLang = LANGUAGES.find(l => l.code === prefs.targetLanguage)?.name || 'Inglés';
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Crea una misión de inmersión Linguix para ${prefs.goal} en ${targetLang}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            context: { type: Type.STRING },
            goal: { type: Type.STRING },
            initialAI: { type: Type.STRING }
          },
          required: ["title", "context", "goal", "initialAI"]
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return null;
  }
};
