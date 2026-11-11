import { GoogleGenAI } from '@google/genai';

// On Netlify, GEMINI_API_KEY and GOOGLE_GEMINI_BASE_URL are injected automatically
// (AI Gateway) unless you set your own GEMINI_API_KEY. Locally, set it in .env.
let ai;
const getAI = () => {
    if (!ai) ai = new GoogleGenAI({});
    return ai;
};

/**
 * 1. Roleplay Scenario
 */
export async function generateScenario({ goal = 'Daily chat', level = 'Intermediate' } = {}) {
    const systemInstruction = "You are a language teacher. Return a 1-sentence specific scenario for an English roleplay session based on goal and level.";
    const userPrompt = `Goal: ${goal}, Level: ${level}. Provide a realistic scenario in under 10 words.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
            systemInstruction: { parts: [{ text: systemInstruction }] }
        }
    });

    const text = response.text ? response.text.trim().replace(/^"|"$/g, '') : "Ordering coffee at a busy cafe in London";
    return { scenario: text };
}

/**
 * 2. Chat Response
 */
export async function chat({ conversationHistory, goal, level, context } = {}) {
    const systemPrompt = `You are a friendly, realistic English speaking partner for goal "${goal || 'Daily chat'}" (Scenario: ${context || 'General'}) at level "${level || 'Intermediate'}". Reply in 1-2 natural sentences and ask a simple follow-up question.`;

    const promptMessages = (conversationHistory || []).map(item => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`).join('\n');
    const fullUserPrompt = `${promptMessages}\nAssistant:`;

    const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: fullUserPrompt }] }],
        config: {
            systemInstruction: { parts: [{ text: systemPrompt }] }
        }
    });

    const reply = response.text || "That's great! Could you tell me a little bit more about that?";
    return { reply };
}

/**
 * 3. Vocabulary Spotlight
 */
export async function vocabSpotlight({ text } = {}) {
    const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: `Extract 1 interesting or advanced word/phrase from: "${text}" and define it simply for an English learner.` }] }],
        config: {
            systemInstruction: { parts: [{ text: "Return a JSON object with 'phrase' (string) and 'definition' (string)." }] },
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    phrase: { type: "STRING" },
                    definition: { type: "STRING" }
                },
                required: ["phrase", "definition"],
                propertyOrdering: ["phrase", "definition"]
            }
        }
    });

    return JSON.parse(response.text);
}

/**
 * 4. Polish Phrase
 */
export async function polish({ text } = {}) {
    const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: `Rephrase this non-native sentence into 3 natural English versions: "${text}"` }] }],
        config: {
            systemInstruction: { parts: [{ text: "Return a JSON array of strings containing exactly 3 distinct natural phrasing options." }] },
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: { type: "STRING" }
            }
        }
    });

    const options = JSON.parse(response.text);
    return { options };
}

/**
 * 5. Evaluate Session Feedback
 */
export async function evaluate({ conversationHistory } = {}) {
    const systemPrompt = 'You are an expert English language coach. Analyze the user\'s spoken text log and return a JSON object strictly matching this schema: { "score": number (out of 10), "comment": string, "mistakes": array of exactly 3 string corrections, "betterPhrasing": string }';
    const userHistoryText = (conversationHistory || []).filter(i => i.role === 'user').map(i => i.content).join(' | ');

    const response = await getAI().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: `Evaluate this spoken transcript: "${userHistoryText}"` }] }],
        config: {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    score: { type: "NUMBER" },
                    comment: { type: "STRING" },
                    mistakes: {
                        type: "ARRAY",
                        items: { type: "STRING" }
                    },
                    betterPhrasing: { type: "STRING" }
                },
                required: ["score", "comment", "mistakes", "betterPhrasing"],
                propertyOrdering: ["score", "comment", "mistakes", "betterPhrasing"]
            }
        }
    });

    return JSON.parse(response.text);
}

/**
 * 6. Text to Speech (TTS) Audio Generation
 * Returns null when the model produced no audio.
 */
export async function tts({ text, voiceStyle = 'warm' } = {}) {
    const VOICE_MAP = {
        warm: { voiceName: 'Aoede', emotionPrompt: 'Speak in a warm, encouraging, and highly friendly tone.' },
        enthusiastic: { voiceName: 'Puck', emotionPrompt: 'Speak with high energy, enthusiasm, and a joyful smile in your voice.' },
        formal: { voiceName: 'Kore', emotionPrompt: 'Speak clearly, confidently, and professionally like an executive coach.' },
        calm: { voiceName: 'Callirrhoe', emotionPrompt: 'Speak calmly, softly, and gently at a measured relaxing pace.' }
    };

    const voiceConfig = VOICE_MAP[voiceStyle] || VOICE_MAP.warm;
    const ttsPrompt = `${voiceConfig.emotionPrompt} Read this naturally: "${text}"`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ role: 'user', parts: [{ text: ttsPrompt }] }],
        config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceConfig.voiceName }
                }
            }
        }
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const audioData = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType;

    return audioData && mimeType ? { audioData, mimeType } : null;
}

// Route table shared by the Netlify Function and the local Express server.
export const ROUTES = {
    'generate-scenario': { handler: generateScenario, error: "Failed to generate scenario." },
    'chat': { handler: chat, error: "Failed to generate chat response." },
    'vocab-spotlight': { handler: vocabSpotlight, error: "Failed to extract vocabulary spotlight." },
    'polish': { handler: polish, error: "Failed to polish phrase." },
    'evaluate': { handler: evaluate, error: "Failed to evaluate session." },
    'tts': { handler: tts, error: "Failed to generate TTS audio.", emptyError: "No audio data returned." }
};
