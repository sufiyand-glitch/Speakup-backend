const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY environment variable is missing.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.post('/api/generate-scenario', async (req, res) => {
    try {
        const { goal = 'Daily chat', level = 'Intermediate' } = req.body;
        const systemInstruction = "You are a language teacher. Return a 1-sentence specific scenario for an English roleplay session based on goal and level.";
        const userPrompt = `Goal: ${goal}, Level: ${level}. Provide a realistic scenario in under 10 words.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: userPrompt }] }],
            config: { systemInstruction: { parts: [{ text: systemInstruction }] } }
        });

        const text = response.text ? response.text.trim().replace(/^"|"$/g, '') : "Ordering coffee at a busy cafe in London";
        res.json({ scenario: text });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate scenario." });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { conversationHistory, goal, level, context } = req.body;
        const systemPrompt = `You are a friendly, realistic English speaking partner for goal "${goal || 'Daily chat'}" (Scenario: ${context || 'General'}) at level "${level || 'Intermediate'}". Reply in 1-2 natural sentences and ask a simple follow-up question.`;
        const promptMessages = (conversationHistory || []).map(item => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`).join('\n');
        const fullUserPrompt = `${promptMessages}\nAssistant:`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: fullUserPrompt }] }],
            config: { systemInstruction: { parts: [{ text: systemPrompt }] } }
        });

        const reply = response.text || "That's great! Could you tell me a little bit more about that?";
        res.json({ reply });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate chat response." });
    }
});

app.post('/api/vocab-spotlight', async (req, res) => {
    try {
        const { text } = req.body;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: `Extract 1 interesting or advanced word/phrase from: "${text}" and define it simply for an English learner.` }] }],
            config: {
                systemInstruction: { parts: [{ text: "Return a JSON object with 'phrase' (string) and 'definition' (string)." }] },
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: { phrase: { type: "STRING" }, definition: { type: "STRING" } },
                    required: ["phrase", "definition"],
                    propertyOrdering: ["phrase", "definition"]
                }
            }
        });
        res.json(JSON.parse(response.text));
    } catch (error) {
        res.status(500).json({ error: "Failed to extract vocabulary." });
    }
});

app.post('/api/polish', async (req, res) => {
    try {
        const { text } = req.body;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: `Rephrase this non-native sentence into 3 natural English versions: "${text}"` }] }],
            config: {
                systemInstruction: { parts: [{ text: "Return a JSON array of strings containing exactly 3 distinct natural phrasing options." }] },
                responseMimeType: "application/json",
                responseSchema: { type: "ARRAY", items: { type: "STRING" } }
            }
        });
        res.json({ options: JSON.parse(response.text) });
    } catch (error) {
        res.status(500).json({ error: "Failed to polish phrase." });
    }
});

app.post('/api/evaluate', async (req, res) => {
    try {
        const { conversationHistory } = req.body;
        const systemPrompt = 'You are an expert English language coach. Analyze the user\'s spoken text log and return a JSON object strictly matching this schema: { "score": number (out of 10), "comment": string, "mistakes": array of exactly 3 string corrections, "betterPhrasing": string }';
        const userHistoryText = (conversationHistory || []).filter(i => i.role === 'user').map(i => i.content).join(' | ');

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: `Evaluate this spoken transcript: "${userHistoryText}"` }] }],
            config: {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        score: { type: "NUMBER" },
                        comment: { type: "STRING" },
                        mistakes: { type: "ARRAY", items: { type: "STRING" } },
                        betterPhrasing: { type: "STRING" }
                    },
                    required: ["score", "comment", "mistakes", "betterPhrasing"],
                    propertyOrdering: ["score", "comment", "mistakes", "betterPhrasing"]
                }
            }
        });
        res.json(JSON.parse(response.text));
    } catch (error) {
        res.status(500).json({ error: "Failed to evaluate session." });
    }
});

app.post('/api/tts', async (req, res) => {
    try {
        const { text, voiceStyle = 'warm' } = req.body;
        const VOICE_MAP = {
            warm: { voiceName: 'Aoede', emotionPrompt: 'Speak in a warm, encouraging tone.' },
            enthusiastic: { voiceName: 'Puck', emotionPrompt: 'Speak with high energy and enthusiasm.' },
            formal: { voiceName: 'Kore', emotionPrompt: 'Speak clearly and professionally.' },
            calm: { voiceName: 'Callirrhoe', emotionPrompt: 'Speak calmly and gently.' }
        };
        const voiceConfig = VOICE_MAP[voiceStyle] || VOICE_MAP.warm;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: `${voiceConfig.emotionPrompt} Read this: "${text}"` }] }],
            config: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceConfig.voiceName } } }
            }
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData?.data) {
            res.json({ audioData: part.inlineData.data, mimeType: part.inlineData.mimeType });
        } else {
            res.status(400).json({ error: "No audio data." });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to generate audio." });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));