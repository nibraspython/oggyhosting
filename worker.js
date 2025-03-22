export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            });
        }

        const url = new URL(request.url);
        const path = url.pathname.substring(1); // Remove leading "/"

        // 🌟 Dynamically find the correct static file (handles hashed filenames)
        const kvFiles = await env.__STATIC_CONTENT.list();
        let matchedFile = kvFiles.keys.find(k => k.name.startsWith(path));

        if (matchedFile) {
            let staticFile = await env.__STATIC_CONTENT.get(matchedFile.name);
            if (staticFile) {
                return new Response(staticFile, {
                    headers: { "Content-Type": getMimeType(matchedFile.name) }
                });
            }
        }

        // 🗂️ Google Drive File Handling
        const GOOGLE_DRIVE_FOLDER_ID = env.GOOGLE_DRIVE_FOLDER_ID;
        const GOOGLE_DRIVE_API_KEY = env.GOOGLE_DRIVE_API_KEY;
        const GOOGLE_DRIVE_ACCESS_TOKEN = env.GOOGLE_DRIVE_ACCESS_TOKEN;

        // 📂 List files in Google Drive folder
        if (request.method === "GET" && url.pathname.endsWith("/list-files")) {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${GOOGLE_DRIVE_FOLDER_ID}'+in+parents&key=${GOOGLE_DRIVE_API_KEY}`);
            const data = await response.json();

            if (data.files) {
                return new Response(JSON.stringify({ files: data.files.map(file => ({ id: file.id, name: file.name })) }), {
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            return new Response(JSON.stringify({ success: false, message: "Failed to fetch files." }), { status: 500 });
        }

        // 🗑️ Delete file from Google Drive
        if (request.method === "POST" && url.pathname.endsWith("/delete-file")) {
            let { fileId, bot_token } = await request.json();
            let valid_bot_token = env.BOT_TOKEN;

            if (bot_token !== valid_bot_token) {
                return new Response(JSON.stringify({ success: false, message: "❌ Incorrect bot token." }), { status: 403 });
            }

            const deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${GOOGLE_DRIVE_ACCESS_TOKEN}` }
            });

            if (deleteResponse.ok) {
                return new Response(JSON.stringify({ success: true, message: "✅ File deleted successfully!" }), {
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            return new Response(JSON.stringify({ success: false, message: "❌ Failed to delete file." }), { status: 500 });
        }

        return new Response("404 Not Found", { status: 404 });
    }
};

// Helper function to get MIME types
function getMimeType(path) {
    const extension = path.split('.').pop();
    const mimeTypes = {
        "html": "text/html",
        "css": "text/css",
        "js": "application/javascript",
        "json": "application/json",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "svg": "image/svg+xml"
    };
    return mimeTypes[extension] || "application/octet-stream";
}
