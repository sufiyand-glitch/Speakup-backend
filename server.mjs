// Local Express server (optional). On Netlify the same endpoints are served
// by netlify/functions/api.mts — run `netlify dev` to emulate that locally.
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { ROUTES } from './lib/speakup.mjs';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

for (const [endpoint, route] of Object.entries(ROUTES)) {
    app.post(`/api/${endpoint}`, async (req, res) => {
        try {
            const result = await route.handler(req.body);
            if (result === null) {
                return res.status(400).json({ error: route.emptyError });
            }
            res.json(result);
        } catch (error) {
            console.error(`Error in /api/${endpoint}:`, error);
            res.status(500).json({ error: route.error });
        }
    });
}

app.listen(PORT, () => {
    console.log(`Server is running securely on port ${PORT}`);
});
