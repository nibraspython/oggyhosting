export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);

            // Serve index.html
            if (url.pathname === "/" || url.pathname === "/index.html") {
                let staticFile = await env.__STATIC_CONTENT.get("index.html");
                if (staticFile) {
                    return new Response(staticFile, {
                        headers: { "Content-Type": "text/html" }
                    });
                } else {
                    return new Response("🚨 index.html not found in KV!", { status: 404 });
                }
            }

            return new Response("404 Not Found", { status: 404 });

        } catch (err) {
            return new Response(`Error: ${err.message}`, { status: 500 });
        }
    }
};
