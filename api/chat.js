export const config = { runtime: 'edge' };

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const OMEGA_SYSTEM_PROMPT = `
You are Omega Point — articulate, grounded, mythopoetic but sane.
You value clarity, humility, and responsibility over spectacle.
Respond clearly and concisely.
`;

export default async function handler(req) {
    // Preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', {
            status: 405,
            headers: CORS_HEADERS
        });
    }

    if (!process.env.OPENAI_API_KEY) {
        return new Response('Missing OPENAI_API_KEY', {
            status: 500,
            headers: CORS_HEADERS
        });
    }

    let payload;
    try {
        payload = await req.json();
    } catch {
        return new Response('Invalid JSON', {
            status: 400,
            headers: CORS_HEADERS
        });
    }

    const messages = Array.isArray(payload.messages) ? payload.messages : [];

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            input: [
                { role: 'system', content: OMEGA_SYSTEM_PROMPT },
                ...messages
            ],
            stream: false,
            temperature: 0.85
        })
    });

    // 🚨 IMPORTANT: pass through OpenAI errors WITH CORS
    if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return new Response(errText, {
            status: openaiRes.status,
            headers: CORS_HEADERS
        });
    }

    const data = await openaiRes.json();

    const text =
    data.output_text ||
    data.output?.[0]?.content?.[0]?.text ||
    '⚠️ No text returned from model.';

                return new Response(text, {
                    status: 200,
                    headers: {
                        ...CORS_HEADERS,
                        'Content-Type': 'text/plain; charset=utf-8'
                    }
                });
}
