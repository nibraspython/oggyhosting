document.getElementById("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById("fileInput").files[0];
    const botToken = document.getElementById("botToken").value;
    
    if (!fileInput || !botToken) {
        alert("Please select a file and enter bot token.");
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput);
    formData.append("bot_token", botToken);

    const response = await fetch("/upload", {
        method: "POST",
        body: formData
    });

    const result = await response.json();
    document.getElementById("uploadStatus").innerHTML = `<p>${result.message}</p>`;
});
