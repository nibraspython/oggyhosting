export default {
    async fetch(request, env) {
        console.log(`➡️ Received request: ${request.method} ${request.url}`);

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
        let path = url.pathname.substring(1);

        // 📂 Serve Static Files
        if (!path) path = "index.html";

        try {
            console.log(`📂 Looking for static file: ${path}`);
            let staticFile = await env.STATIC_CONTENT_KV.get(path, "stream");
            if (staticFile) {
                console.log(`✅ Serving static file: ${path}`);
                return new Response(staticFile, {
                    headers: {
                        "Content-Type": getMimeType(path),
                        "Access-Control-Allow-Origin": "*"
                    }
                });
            }
        } catch (error) {
            console.error("🚨 Static file error:", error);
            return new Response("❌ Error loading static files.", { status: 500 });
        }

        const { BOT_TOKEN } = env;

        // 📤 Upload File to File.io
        if (request.method === "POST" && url.pathname === "/upload-file") {
            try {
                const formData = await request.formData();
                const file = formData.get("file");
                const botToken = formData.get("bot_token");

                if (!file || !botToken) {
                    return new Response(JSON.stringify({ success: false, message: "❌ File and bot token are required." }), { status: 400 });
                }

                if (botToken !== BOT_TOKEN) {
                    return new Response(JSON.stringify({ success: false, message: "❌ Incorrect bot token." }), { status: 403 });
                }

                console.log(`📤 Uploading file: ${file.name}`);

                const fileBlob = await file.arrayBuffer();
                const fileUpload = new Blob([fileBlob], { type: file.type });
                let uploadData = new FormData();
                uploadData.append("file", fileUpload, file.name);

                const fileIoResponse = await fetch("https://file.io", {
                    method: "POST",
                    body: uploadData
                });

                const uploadResult = await fileIoResponse.json();
                console.log("File.io Response:", uploadResult);

                if (fileIoResponse.ok && uploadResult.success) {
                    return new Response(JSON.stringify({
                        success: true,
                        fileUrl: uploadResult.link,
                        message: "✅ File uploaded successfully!"
                    }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }

                return new Response(JSON.stringify({
                    success: false,
                    message: `❌ Upload error: ${uploadResult.message || "Unknown error"}`
                }), { status: fileIoResponse.status });

            } catch (error) {
                console.error("🚨 Upload error:", error);
                return new Response(JSON.stringify({ success: false, message: `❌ Upload error: ${error.message}` }), { status: 500 });
            }
        }

        return new Response("404 Not Found", { status: 404 });
    }
};

// 🔄 Helper function to get MIME types
function getMimeType(fileName) {
    const extension = fileName.split(".").pop().toLowerCase();
    const mimeTypes = {
        html: "text/html",
        css: "text/css",
        js: "application/javascript",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        json: "application/json"
    };
    return mimeTypes[extension] || "application/octet-stream";
}
