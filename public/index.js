document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('shorten-form');
    const urlList = document.getElementById('shortened-urls');
    const messageArea = document.getElementById('message-area');

const fetchShortenedUrl = async ()=>{
    const response = await fetch("/links")
    const links = await response.json()
    const list = document.getElementById("shortened-urls");
    list.innerHTML=""
    for(const [shortCode,url] of Object.entries(links)){
        const li = document.createElement('li')
        li.innerHTML= `
            <a href="/${shortCode}" target="_blank" >${window.location.origin}/${shortCode}</a>
            - ${url}
        `
        list.appendChild(li)
    }

}

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Clear previous messages
        messageArea.textContent = '';
        messageArea.className = '';

        const formData = new FormData(event.target);
        const url = formData.get("url");
        const shortCode = formData.get("shortCode");

        try {
            const response = await fetch("/shorten", {
                method: 'POST',
                headers: { 'Content-Type': "application/json" },
                body: JSON.stringify({ url, shortCode }),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // --- THIS IS THE NEW LOGIC ---
                // Display a success message
                fetchShortenedUrl();
                messageArea.textContent = "URL successfully shortened!";
                messageArea.classList.add('success');

                // Create the full shortened URL
                const newShortUrl = `${window.location.origin}/${result.shortCode}`;

                // Create a new list item and a link
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = newShortUrl;
                link.textContent = newShortUrl;
                link.target = '_blank'; // Open in a new tab

                // Add the link to the list
                listItem.appendChild(link);
                urlList.prepend(listItem); // Add new links to the top

                // Reset the form for the next submission
                event.target.reset();

            } else {
                // Display an error message from the server
                messageArea.textContent = `Error: ${result.message || 'An unknown error occurred.'}`;
                messageArea.classList.add('error');
            }
        } catch (error) {
            console.error("Fetch error:", error);
            messageArea.textContent = 'Error: Could not connect to the server.';
            messageArea.classList.add('error');
        }
    });
});
