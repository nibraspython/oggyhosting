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

        // 📤 Upload File to Google Drive (Improved)
        if (request.method === "POST" && url.pathname === "/upload-file") {
            try {
                const formData = await request.formData();
                const file = formData.get("file");
                const botToken = formData.get("bot_token");

                if (!file || !botToken) {
                    return new Response(JSON.stringify({ success: false, message: "❌ File and bot token are required." }), { status: 400 });
                }

                if (botToken !== env.BOT_TOKEN) {
                    return new Response(JSON.stringify({ success: false, message: "❌ Incorrect bot token." }), { status: 403 });
                }

                console.log(`📤 Uploading file: ${file.name}`);

                const metadata = {
                    name: file.name,
                    parents: [env.GOOGLE_DRIVE_FOLDER_ID]
                };

                const fileBlob = await file.arrayBuffer();
                const form = new FormData();
                form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
                form.append("file", new Blob([fileBlob], { type: file.type }));

                console.log("⏳ Sending file to Google Drive...");

                const uploadResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${env.GOOGLE_DRIVE_ACCESS_TOKEN}`
                    },
                    body: form
                });

                const uploadResult = await uploadResponse.json();
                console.log("🔍 Google Drive Response:", uploadResponse.status, uploadResult);

                if (uploadResponse.ok) {
                    return new Response(JSON.stringify({ success: true, fileId: uploadResult.id, message: "✅ File uploaded successfully!" }), {
                        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                    });
                }

                return new Response(JSON.stringify({ 
                    success: false, 
                    message: `❌ Upload failed bro: ${uploadResult.error?.message || "Unknown error"}` 
                }), { status: uploadResponse.status });
            } catch (error) {
                console.error("🚨 Upload error:", error);
                return new Response(JSON.stringify({ 
                    success: false, 
                    message: `❌ Upload failed bro: ${error.message}` 
                }), { status: 500 });
            }
        }

        return new Response("404 Not Found", { status: 404 });
    }
};
