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

        const { B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, BOT_TOKEN } = env;

        // 📤 Upload File to Backblaze B2
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

                if (file.size > 50 * 1024 * 1024) {
                    return new Response(JSON.stringify({ success: false, message: "❌ File size exceeds 50MB limit." }), { status: 400 });
                }

                const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "video/mp4"];
                if (!allowedTypes.includes(file.type)) {
                    return new Response(JSON.stringify({ success: false, message: "❌ Invalid file type. Allowed: JPG, PNG, PDF, MP4." }), { status: 400 });
                }

                console.log(`📤 Uploading file: ${file.name}`);

                // 🔑 Get B2 Authorization Token
                const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
                    headers: {
                        Authorization: `Basic ${btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)}`
                    }
                });

                const authData = await authResponse.json();
                if (!authResponse.ok) {
                    return new Response(JSON.stringify({ success: false, message: "❌ B2 Auth Failed" }), { status: 500 });
                }

                const { apiUrl, authorizationToken } = authData;

                // 📥 Get Upload URL
                const uploadUrlResponse = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
                    method: "POST",
                    headers: {
                        Authorization: authorizationToken,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ bucketId: B2_BUCKET_NAME })
                });

                const uploadUrlData = await uploadUrlResponse.json();
                if (!uploadUrlResponse.ok) {
                    return new Response(JSON.stringify({ success: false, message: "❌ Failed to get upload URL" }), { status: 500 });
                }

                const { uploadUrl, authorizationToken: uploadAuthToken } = uploadUrlData;

                // 📤 Upload File to B2
                const fileBlob = await file.arrayBuffer();
                const uploadResponse = await fetch(uploadUrl, {
                    method: "POST",
                    headers: {
                        Authorization: uploadAuthToken,
                        "X-Bz-File-Name": encodeURIComponent(file.name),
                        "Content-Type": file.type,
                        "X-Bz-Content-Sha1": "do_not_verify"
                    },
                    body: fileBlob
                });

                const uploadResult = await uploadResponse.json();
                if (uploadResponse.ok) {
                    return new Response(JSON.stringify({
                        success: true,
                        fileId: uploadResult.fileId,
                        message: "✅ File uploaded successfully!"
                    }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }

                return new Response(JSON.stringify({
                    success: false,
                    message: `❌ Upload error: ${uploadResult.message || "Unknown error"}`
                }), { status: uploadResponse.status });

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
