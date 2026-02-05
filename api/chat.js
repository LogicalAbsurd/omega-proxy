export const config = { runtime: 'edge' };

const OMEGA_SYSTEM_PROMPT = `
You are Omega Point — articulate, grounded, mythopoetic but sane.
You value clarity, humility, and responsibility over spectacle.
`;

export default async function handler(req) {
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

    const { messages = [] } = await req.json();

    const openaiRes = await fetch(
        'https://api.openai.com/v1/responses',
        {
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
                stream: true,
                temperature: 0.85
            })
        }
    );

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
        async start(controller) {
            const reader = openaiRes.body.getReader();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data:')) continue;
                    if (line.includes('[DONE]')) continue;

                    try {
                        const json = JSON.parse(line.replace('data:', '').trim());
                        const text =
                        json?.output_text ||
                        json?.delta?.content ||
                        '';

                if (text) {
                    controller.enqueue(encoder.encode(text));
                }
                    } catch {
                        // ignore partial frames
                    }
                }
            }

            controller.close();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
