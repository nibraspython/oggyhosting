document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("uploadForm").addEventListener("submit", async (event) => {
        event.preventDefault();

        let fileInput = document.getElementById("file").files[0];
        let botToken = document.getElementById("bot_token").value;
        let statusMsg = document.getElementById("uploadStatus");

        if (!fileInput) {
            statusMsg.innerHTML = "<span style='color:red;'>❌ Please select a file.</span>";
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

            let result = await response.json();
            
            if (result.success) {
                statusMsg.innerHTML = "<span style='color:green;'>✅ Upload successful!</span>";
                document.getElementById("uploadForm").reset();
            } else {
                statusMsg.innerHTML = `<span style='color:red;'>❌ ${result.message}</span>`;
            }
        } catch (error) {
            console.error("Upload failed:", error);
            statusMsg.innerHTML = "<span style='color:red;'>❌ Upload failed. Check console.</span>";
        }
    });
});
