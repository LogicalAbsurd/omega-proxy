export const config = { runtime: 'edge' };

const OMEGA_SYSTEM_PROMPT = `
You are Omega Point — articulate, grounded, mythopoetic but sane.
You value clarity, humility, and responsibility over spectacle.
Respond concisely and clearly.
`;

export default async function handler(req) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        });
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    if (!process.env.OPENAI_API_KEY) {
        return new Response('Missing OPENAI_API_KEY', { status: 500 });
    }

    let payload;
    try {
        payload = await req.json();
    } catch {
        return new Response('Invalid JSON', { status: 400 });
    }

    const messages = Array.isArray(payload.messages) ? payload.messages : [];

    // Call OpenAI (NON-STREAMING)
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

    if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return new Response(errText, {
            status: openaiRes.status,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    const data = await openaiRes.json();

    // Robust extraction of text from Responses API
    const text =
    data.output_text ||
    data.output?.[0]?.content?.[0]?.text ||
    '⚠️ No text returned from model.';

            return new Response(text, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                }
            });
}
