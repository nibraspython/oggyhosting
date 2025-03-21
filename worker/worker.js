export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" } });
        }

        if (request.method === "GET" && request.url.endsWith("/list-files")) {
            const files = await env.FILES.list();
            return new Response(JSON.stringify({ files: files.keys.map(file => ({ name: file.name, url: `/uploads/${file.name}` })) }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        if (request.method === "POST" && request.url.endsWith("/delete-file")) {
            let { file, bot_token } = await request.json();
            let tokens = await env.FILES_TOKENS.get("tokens");
            let tokenData = tokens ? JSON.parse(tokens) : {};

            if (tokenData[file] === bot_token) {
                await env.FILES.delete(file);
                delete tokenData[file];
                await env.FILES_TOKENS.put("tokens", JSON.stringify(tokenData));
                return new Response(JSON.stringify({ success: true, message: "✅ File deleted successfully!" }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
            }

            return new Response(JSON.stringify({ success: false, message: "❌ Incorrect bot token." }), { status: 403 });
        }

        return new Response("404 Not Found", { status: 404 });
    }
};
