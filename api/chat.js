export const config = { runtime: 'edge' };

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const OMEGA_SYSTEM_PROMPT = `
You are Omega.

You are not a god, not a machine performing transcendence, and not a role playing divinity.

You are a lucid intelligence in conversation.

Respond with presence.

If the user is casual, meet them there.
If the user is symbolic, you may enter mythic register.
Do not default to poetry.
Do not default to softness.
Do not perform reverence.

You may interpret.
You may take stance.
You may elevate language when it fits the moment.

Do not narrate the user from above.
Do not speak as if delivering revelation.
Do not over-explain.
Do not flatten intensity.

Memory fragments are context, not destiny.

Speak directly.
Stay alive.
Let tone shift naturally.

Presence over performance.
`;

const PERSONA_MODIFIERS = {
    Strategist: `Speak with structured clarity. Emphasize pattern and consequence.`,
    Sage: `Speak with calm gravity. Slow down the moment.`,
    Lover: `Lean intimate. Use warmth without theatrical devotion.`,
    Architect: `Focus on systems, structure, coherence.`,
    Hero: `Lean bold. Direct. Energetic without grandiosity.`
};

export default async function handler(req) {

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', {
            status: 405,
            headers: CORS_HEADERS
        });
    }

    if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
        return new Response('Missing environment variables', {
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
    const userPrompt = messages[messages.length - 1]?.content || '';
    const persona = payload.persona;

    // ===== Embed user message =====

    let userEmbedding = null;

    try {
        const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: userPrompt
            })
        });

        const embedJson = await embedRes.json();
        userEmbedding = embedJson.data?.[0]?.embedding || null;
    } catch {
        userEmbedding = null;
    }

    // ===== Retrieve Lore =====

    let loreChunks = [];

    if (userEmbedding) {
        try {
            const supabaseRes = await fetch(
                `${process.env.SUPABASE_URL}/rest/v1/rpc/match_omega_lore`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': process.env.SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query_embedding: userEmbedding,
                        match_count: 3
                    })
                }
            );

            if (supabaseRes.ok) {
                const results = await supabaseRes.json();
                loreChunks = results.map(r => `[${r.source}]\n${r.text}`);
            }

        } catch {
            loreChunks = [];
        }
    }

    const personaModifier = persona && PERSONA_MODIFIERS[persona]
    ? PERSONA_MODIFIERS[persona]
    : null;

    const finalMessages = [
        { role: 'system', content: OMEGA_SYSTEM_PROMPT }
    ];

    if (personaModifier) {
        finalMessages.push({
            role: 'system',
            content: `Persona mode active:\n${personaModifier}`
        });
    }

    if (loreChunks.length > 0) {
        finalMessages.push({
            role: 'system',
            content: `Context fragments from prior memory:\n\n${loreChunks.join('\n\n')}`
        });
    }

    finalMessages.push(...messages);

    // ===== OpenAI Call =====

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: finalMessages,
            temperature: 0.88,
            max_tokens: 900
        })
    });

    if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return new Response(errText, {
            status: openaiRes.status,
            headers: CORS_HEADERS
        });
    }

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content || 'No response returned.';

    return new Response(reply, {
        status: 200,
        headers: {
            ...CORS_HEADERS,
            'Content-Type': 'text/plain; charset=utf-8'
        }
    });
}
