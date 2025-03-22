export default {
    async fetch(request, env) {
        console.log(`➡️ Received request: ${request.method} ${request.url}`);

        if (request.method === "OPTIONS") {
            console.log("✅ Handling CORS preflight request.");
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
                    STATIC_CONTENT_KV: "Configured",
                    BOT_TOKEN: env.BOT_TOKEN ? "Exists" : "Not Set"
                }
            }, null, 2), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        // 📂 Serve Static Files from Cloudflare KV
        if (!path) {
            path = "index.html"; // Default to index.html if root is accessed
        }

        try {
            console.log(`📂 Looking for static file: ${path}`);
            const kvFiles = await env.STATIC_CONTENT_KV.list();
            let matchedFile = kvFiles.keys.find(k => k.name.startsWith(path));

            if (matchedFile) {
                console.log(`✅ Found static file: ${matchedFile.name}`);
                let staticFile = await env.STATIC_CONTENT_KV.get(matchedFile.name, "stream");
                if (staticFile) {
                    return new Response(staticFile, {
                        headers: { 
                            "Content-Type": getMimeType(matchedFile.name),
                            "Access-Control-Allow-Origin": "*"
                        }
                    });
                }
            } else {
                console.warn(`❌ Static file not found: ${path}`);
            }
        } catch (error) {
            console.error("🚨 Static file error:", error);
            return new Response("❌ Error loading static files.", { status: 500 });
        }

        // 🌐 Google Drive API Configuration
        const GOOGLE_DRIVE_FOLDER_ID = env.GOOGLE_DRIVE_FOLDER_ID;
        const GOOGLE_DRIVE_API_KEY = env.GOOGLE_DRIVE_API_KEY;
        const GOOGLE_DRIVE_ACCESS_TOKEN = env.GOOGLE_DRIVE_ACCESS_TOKEN;
        const BOT_TOKEN = env.BOT_TOKEN;

        // 📤 Upload File to Google Drive
        if (request.method === "POST" && url.pathname === "/upload-file") {
            try {
                const formData = await request.formData();
                const file = formData.get("file");
                const botToken = formData.get("bot_token");

                console.log(`📤 Uploading file: ${file.name}`);

                if (!file || !botToken) {
                    console.warn("⚠️ Missing file or bot token.");
                    return new Response(JSON.stringify({ success: false, message: "❌ File and bot token are required." }), { status: 400 });
                }

                if (botToken !== BOT_TOKEN) {
                    console.warn("❌ Incorrect bot token.");
                    return new Response(JSON.stringify({ success: false, message: "❌ Incorrect bot token." }), { status: 403 });
                }

                console.log("✅ Bot token verified.");

                // Convert file to base64
                const arrayBuffer = await file.arrayBuffer();
                const base64File = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

                console.log("⏳ Uploading to Google Drive...");

                const uploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${GOOGLE_DRIVE_ACCESS_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: file.name,
                        parents: [GOOGLE_DRIVE_FOLDER_ID],
                        mimeType: file.type
                    })
                });

                const uploadResult = await uploadResponse.json();

                if (uploadResponse.ok) {
                    console.log(`✅ File uploaded successfully: ${uploadResult.id}`);
                    return new Response(JSON.stringify({ success: true, fileId: uploadResult.id, message: "✅ File uploaded successfully!" }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }

                console.warn("❌ Upload failed.");
                return new Response(JSON.stringify({ success: false, message: "❌ Upload failed." }), { status: 500 });
            } catch (error) {
                console.error("🚨 Upload error:", error);
                return new Response(JSON.stringify({ success: false, message: "❌ Server error occurred while uploading the file." }), { status: 500 });
            }
        }

        // 📂 List files in Google Drive folder
        if (request.method === "GET" && url.pathname === "/list-files") {
            console.log("🔍 Fetching file list from Google Drive...");
            try {
                const response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${GOOGLE_DRIVE_FOLDER_ID}'+in+parents&key=${GOOGLE_DRIVE_API_KEY}`);
                const data = await response.json();

                if (data.files) {
                    console.log(`✅ Retrieved ${data.files.length} files from Google Drive.`);
                    return new Response(JSON.stringify({ success: true, files: data.files.map(file => ({ id: file.id, name: file.name })) }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }
                console.warn("⚠️ No files found in the Google Drive folder.");
                return new Response(JSON.stringify({ success: false, message: "❌ No files found in the folder." }), { status: 404 });
            } catch (error) {
                console.error("🚨 Google Drive API error:", error);
                return new Response(JSON.stringify({ success: false, message: "❌ Failed to fetch files." }), { status: 500 });
            }
        }

        // 🗑️ Delete a file from Google Drive
        if (request.method === "POST" && url.pathname === "/delete-file") {
            try {
                let { fileId, bot_token } = await request.json();
                console.log(`🗑️ Delete request for File ID: ${fileId}`);

                if (!fileId) {
                    console.warn("⚠️ Missing file ID in delete request.");
                    return new Response(JSON.stringify({ success: false, message: "❌ File ID is required." }), { status: 400 });
                }

                if (!bot_token || bot_token !== BOT_TOKEN) {
                    console.warn("❌ Incorrect bot token.");
                    return new Response(JSON.stringify({ success: false, message: "❌ Incorrect bot token." }), { status: 403 });
                }
                console.log("✅ Bot token verified.");

                console.log("⏳ Sending delete request to Google Drive API...");
                const deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${GOOGLE_DRIVE_ACCESS_TOKEN}` }
                });

                if (deleteResponse.ok) {
                    console.log("✅ File deleted successfully!");
                    return new Response(JSON.stringify({ success: true, message: "✅ File deleted successfully!" }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }

                console.warn("❌ Failed to delete file.");
                return new Response(JSON.stringify({ success: false, message: "❌ Failed to delete file." }), { status: 500 });
            } catch (error) {
                console.error("🚨 Delete file error:", error);
                return new Response(JSON.stringify({ success: false, message: "❌ Server error occurred while deleting the file." }), { status: 500 });
            }
        }

        console.warn(`❌ 404 Not Found: ${request.method} ${request.url}`);
        return new Response("404 Not Found", { status: 404 });
    }
};
