export default {
    async fetch(request) {
        const url = new URL(request.url);
        const method = request.method;

        if (url.pathname === "/upload" && method === "POST") {
            return await handleUpload(request);
        } else if (url.pathname.startsWith("/files/")) {
            return await getFile(url.pathname.replace("/files/", ""));
        } else if (url.pathname === "/delete" && method === "POST") {
            return await deleteFile(request);
        }

        return new Response("Not Found", { status: 404 });
    }
};

async function handleUpload(request) {
    const formData = await request.formData();
    const file = formData.get("file");
    const botToken = formData.get("bot_token");

    if (!file || !botToken) {
        return new Response("Missing file or bot token", { status: 400 });
    }

    const fileName = file.name;
    const uniqueName = `${Date.now()}-${fileName}`;

    const fileBuffer = await file.arrayBuffer();
    await R2_BUCKET.put(uniqueName, fileBuffer);

    await KV_STORAGE.put(uniqueName, botToken);

    return new Response(JSON.stringify({
        message: "File uploaded successfully",
        url: `/files/${uniqueName}`
    }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function getFile(fileName) {
    const file = await R2_BUCKET.get(fileName);
    if (!file) return new Response("File not found", { status: 404 });

    return new Response(file.body, { status: 200 });
}

async function deleteFile(request) {
    const formData = await request.formData();
    const fileName = formData.get("file_name");
    const botToken = formData.get("bot_token");

    if (!fileName || !botToken) {
        return new Response("Missing file name or bot token", { status: 400 });
    }

    const storedToken = await KV_STORAGE.get(fileName);
    if (storedToken !== botToken) {
        return new Response("Invalid bot token", { status: 403 });
    }

    await R2_BUCKET.delete(fileName);
    await KV_STORAGE.delete(fileName);

    return new Response("File deleted successfully", { status: 200 });
}
