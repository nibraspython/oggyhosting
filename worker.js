export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);

            // Fetch all keys from KV
            const keys = await env.STATIC_CONTENT_KV.list();
            let indexFileKey = keys.keys.find(k => k.name.startsWith("index"));

            if (!indexFileKey) {
                return new Response("🚨 index.html not found in KV!", { status: 404 });
            }

            // Retrieve the correct index.html file
            let staticFile = await env.STATIC_CONTENT_KV.get(indexFileKey.name, "text");
            if (staticFile) {
                return new Response(staticFile, {
                    headers: { "Content-Type": "text/html" }
                });
            } else {
                return new Response("🚨 index.html found in KV but cannot be loaded!", { status: 500 });
            }

        } catch (err) {
            return new Response(`Error: ${err.message}`, { status: 500 });
        }
    }
};
