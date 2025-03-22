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
        let path = url.pathname.substring(1); // Remove leading "/"

        // 📌 Debug Endpoint
        if (url.pathname === "/debug") {
            console.log("🛠️ Debug endpoint accessed.");
            try {
                const kvFiles = await env.STATIC_CONTENT_KV.list();
                return new Response(JSON.stringify({
                    success: true,
                    message: "Debug Information",
                    request: {
                        method: request.method,
                        url: request.url,
                        headers: Object.fromEntries(request.headers.entries())
                    },
                    env: {
                        GOOGLE_DRIVE_FOLDER_ID: env.GOOGLE_DRIVE_FOLDER_ID,
                        BOT_TOKEN: env.BOT_TOKEN ? "Exists" : "Not Set"
                    }
                }, null, 2), {
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            } catch (error) {
                console.error("🚨 Error accessing KV storage:", error);
                return new Response(JSON.stringify({ success: false, message: "❌ Error accessing KV storage." }), { status: 500 });
            }
        }

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
            } else {
                console.warn(`❌ Static file not found: ${path}`);
            }
        } catch (error) {
            console.error("🚨 Static file error:", error);
            return new Response("❌ Error loading static files.", { status: 500 });
        }

        const { GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_ACCESS_TOKEN, BOT_TOKEN } = env;

        // 📤 Upload File to Google Drive
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

                // ✅ File Size Check
                if (file.size > 50 * 1024 * 1024) {
                    return new Response(JSON.stringify({ success: false, message: "❌ File size exceeds 50MB limit." }), { status: 400 });
                }

                // ✅ File Type Restriction
                const allowedTypes = ["image/jpeg", "image/png", "application/pdf", "video/mp4"];
                if (!allowedTypes.includes(file.type)) {
                    return new Response(JSON.stringify({ success: false, message: "❌ Invalid file type. Allowed: JPG, PNG, PDF, MP4." }), { status: 400 });
                }

                // 🔎 Check for Duplicate File
                const existingFilesResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q='${GOOGLE_DRIVE_FOLDER_ID}'+in+parents`, {
                    headers: { "Authorization": `Bearer ${GOOGLE_DRIVE_ACCESS_TOKEN}` }
                });
                const existingFiles = await existingFilesResponse.json();

                if (existingFiles.files.some(existingFile => existingFile.name === file.name)) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: "❌ Duplicate file name found. Please rename your file or delete the existing one."
                    }), { status: 409 });
                }

                console.log(`📤 Uploading file: ${file.name}`);

                const metadata = {
                    name: file.name,
                    parents: [GOOGLE_DRIVE_FOLDER_ID]
                };

                const fileBlob = await file.arrayBuffer();
                const form = new FormData();
                form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
                form.append("file", new Blob([fileBlob], { type: file.type }));

                console.log("⏳ Sending file to Google Drive...");

                const uploadResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${GOOGLE_DRIVE_ACCESS_TOKEN}`
                    },
                    body: form
                });

                const uploadResult = await uploadResponse.json();

                if (uploadResponse.ok) {
                    return new Response(JSON.stringify({ success: true, fileId: uploadResult.id, message: "✅ File uploaded successfully!" }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }

                return new Response(JSON.stringify({ success: false, message: "❌ Upload failed.", error: uploadResult }), { status: uploadResponse.status });
            } catch (error) {
                console.error("🚨 Upload error:", error);
                return new Response(JSON.stringify({ success: false, message: "❌ Server error occurred while uploading the file." }), { status: 500 });
            }
        }

        // 📂 List Files
        if (request.method === "GET" && url.pathname === "/list-files") {
            try {
                const response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${GOOGLE_DRIVE_FOLDER_ID}'+in+parents`, {
                    headers: { "Authorization": `Bearer ${GOOGLE_DRIVE_ACCESS_TOKEN}` }
                });

                const data = await response.json();

                if (response.ok && data.files) {
                    return new Response(JSON.stringify({ success: true, files: data.files.map(file => ({ id: file.id, name: file.name })) }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }

                return new Response(JSON.stringify({ success: false, message: "❌ No files found in the folder." }), { status: response.status });
            } catch (error) {
                console.error("🚨 Google Drive API error:", error);
                return new Response(JSON.stringify({ success: false, message: "❌ Failed to fetch files." }), { status: 500 });
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
