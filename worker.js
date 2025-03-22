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

        // 📌 Serve Static Files from Cloudflare KV
        if (path) {
            try {
                const kvFiles = await env.STATIC_CONTENT_KV.list();
                let matchedFile = kvFiles.keys.find(k => k.name.startsWith(path));

                if (matchedFile) {
                    let staticFile = await env.STATIC_CONTENT_KV.get(matchedFile.name, "stream");
                    if (staticFile) {
                        return new Response(staticFile, {
                            headers: { 
                                "Content-Type": getMimeType(matchedFile.name),
                                "Access-Control-Allow-Origin": "*"
                            }
                        });
                    }
                }
            } catch (error) {
                console.error("Static file error:", error);
                return new Response("❌ Error loading static files.", { status: 500 });
            }
        }

        // 🌐 Google Drive API Configuration
        const GOOGLE_DRIVE_FOLDER_ID = env.GOOGLE_DRIVE_FOLDER_ID;
        const GOOGLE_DRIVE_API_KEY = env.GOOGLE_DRIVE_API_KEY;
        const GOOGLE_DRIVE_ACCESS_TOKEN = env.GOOGLE_DRIVE_ACCESS_TOKEN;
        const BOT_TOKEN = env.BOT_TOKEN;

        // 📂 List files in Google Drive folder
        if (request.method === "GET" && url.pathname === "/list-files") {
            try {
                const response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${GOOGLE_DRIVE_FOLDER_ID}'+in+parents&key=${GOOGLE_DRIVE_API_KEY}`);
                const data = await response.json();

                if (data.files) {
                    return new Response(JSON.stringify({ success: true, files: data.files.map(file => ({ id: file.id, name: file.name })) }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }
                return new Response(JSON.stringify({ success: false, message: "❌ No files found in the folder." }), { status: 404 });
            } catch (error) {
                console.error("Google Drive API error:", error);
                return new Response(JSON.stringify({ success: false, message: "❌ Failed to fetch files." }), { status: 500 });
            }
        }

        // 🗑️ Delete a file from Google Drive
        if (request.method === "POST" && url.pathname === "/delete-file") {
            try {
                let { fileId, bot_token } = await request.json();

                if (!fileId) {
                    return new Response(JSON.stringify({ success: false, message: "❌ File ID is required." }), { status: 400 });
                }

                if (!bot_token || bot_token !== BOT_TOKEN) {
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
            } catch (error) {
                console.error("Delete file error:", error);
                return new Response(JSON.stringify({ success: false, message: "❌ Server error occurred while deleting the file." }), { status: 500 });
            }
        }

        return new Response("404 Not Found", { status: 404 });
    }
};

// 📌 Helper function to get MIME types
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
