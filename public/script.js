document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("uploadForm").addEventListener("submit", async (event) => {
        event.preventDefault();

        let fileInput = document.getElementById("file").files[0];
        let botToken = document.getElementById("bot_token").value.trim();
        let statusMsg = document.getElementById("uploadStatus");

        if (!fileInput) {
            statusMsg.innerHTML = "<span style='color:red;'>❌ Please select a file.</span>";
            return;
        }

        if (!botToken) {
            statusMsg.innerHTML = "<span style='color:red;'>❌ Please enter your bot token.</span>";
            return;
        }

        statusMsg.innerHTML = "⏳ Uploading file...";

        let formData = new FormData();
        formData.append("file", fileInput);
        formData.append("bot_token", botToken);

        try {
            let response = await fetch("https://cloudflare-file-hosting.oggyapi.workers.dev/upload-file", {  
                method: "POST",
                body: formData
            });

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                console.error("❌ JSON Parsing Error:", jsonError);
                throw new Error("❌ Server returned an invalid response.");
            }

            if (response.ok && result.success) {
                statusMsg.innerHTML = `<span style='color:green;'>✅ Upload successful! File ID: ${result.fileId}</span>`;
                document.getElementById("uploadForm").reset();
            } else {
                console.error("❌ Upload Error:", result);
                statusMsg.innerHTML = `<span style='color:red;'>❌ ${result.message || "Unknown error occurred."}</span>`;
            }
        } catch (error) {
            console.error("🚨 Upload failed:", error);
            statusMsg.innerHTML = `<span style='color:red;'>❌ Upload failed: ${error.message}</span>`;
        }
    });
});
