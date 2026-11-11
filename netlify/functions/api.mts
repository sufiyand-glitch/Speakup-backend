import type { Config, Context } from '@netlify/functions';
import { ROUTES } from '../../lib/speakup.mjs';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const json = (data: unknown, status = 200) =>
    Response.json(data, { status, headers: CORS_HEADERS });

export default async (req: Request, context: Context) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const { endpoint } = context.params;

    if (endpoint === 'health' && req.method === 'GET') {
        return json({ status: 'ok', timestamp: new Date() });
    }

    const route = ROUTES[endpoint as keyof typeof ROUTES];
    if (!route || req.method !== 'POST') {
        return json({ error: 'Not found.' }, 404);
    }

    try {
        const body = await req.json().catch(() => ({}));
        const result = await route.handler(body);
        if (result === null) {
            return json({ error: route.emptyError }, 400);
        }
        return json(result);
    } catch (error) {
        console.error(`Error in /api/${endpoint}:`, error);
        return json({ error: route.error }, 500);
    }
};

export const config: Config = {
    path: '/api/:endpoint'
};
