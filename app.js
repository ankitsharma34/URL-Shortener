import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// --- SETUP ---
// Recreate __dirname for ES Modules, which is not available by default.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define constants for the port and the data file path for better maintainability.
const PORT = 3002;
const DATA_FILE = path.join(__dirname, "data", "links.json");


// --- HELPER FUNCTIONS ---

/**
 * Serves a static file from the /public directory.
 * @param {object} res - The HTTP response object.
 * @param {string} filePath - The absolute path to the file.
 * @param {string} contentType - The MIME type of the file.
 */
const serveFile = async (res, filePath, contentType) => {
    try {
        const data = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch (error) {
        console.error(`Error reading file: ${filePath}`, error);
        res.writeHead(500, { 'Content-Type': "text/plain" });
        res.end("500 Internal Server Error");
    }
};

/**
 * Loads the links from the links.json file.
 * If the file doesn't exist, it creates an empty one.
 * @returns {Promise<object>} A promise that resolves to the links object.
 */
const loadLinks = async () => {
    try {
        const data = await readFile(DATA_FILE, "utf-8");
        // --- FIX ---
        // If the file is empty (e.g., after being created), return an empty
        // object to prevent a JSON.parse() error on an empty string.
        if (!data) {
            return {};
        }
        return JSON.parse(data);
    } catch (error) {
        // If the file doesn't exist (error code 'ENOENT'), create it.
        if (error.code === 'ENOENT') {
            await writeFile(DATA_FILE, JSON.stringify({}));
            return {};
        }
        // For any other error, re-throw it to be handled by the caller.
        throw error;
    }
};

/**
 * Saves the provided links object to the links.json file.
 * @param {object} links - The links object to save.
 */
const saveLinks = async (links) => {
    // Using JSON.stringify with a replacer (null) and space count (2) for pretty-printing.
    await writeFile(DATA_FILE, JSON.stringify(links, null, 2));
};


// --- SERVER LOGIC ---

const server = createServer(async (req, res) => {
    console.log(`Request: ${req.method} ${req.url}`);

    // --- POST Request Handler: Create a new short link ---
    if (req.method === 'POST' && req.url === '/shorten') {
        let body = "";
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
            try {
                const links = await loadLinks();
                const { url, shortCode } = JSON.parse(body);

                // Validate that a URL was actually provided in the request body.
                if (!url) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: "URL is required." }));
                }

                // Use the user's custom short code or generate a random 4-byte hex string.
                const finalShortCode = shortCode || crypto.randomBytes(4).toString("hex");

                // Check if the short code already exists in our data file.
                if (links[finalShortCode]) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    return res.end(JSON.stringify({ success: false, message: "Short code already exists. Please choose another." }));
                }

                links[finalShortCode] = url;
                await saveLinks(links);

                // Respond with 201 Created status and the new short code.
                res.writeHead(201, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, shortCode: finalShortCode }));

            } catch (error) {
                console.error("Error processing POST request:", error);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, message: "Server error." }));
            }
        });
        return; // Stop execution to prevent falling through to the GET handler.
    }

    // --- GET Request Handler: Serve files or redirect short links ---
    if (req.method === 'GET') {
        switch (req.url) {
            case "/":
                return serveFile(res, path.join(__dirname, "public", "index.html"), "text/html");
            case "/style.css":
                return serveFile(res, path.join(__dirname, "public", "style.css"), "text/css");
            case "/index.js":
                return serveFile(res, path.join(__dirname, "public", "index.js"), "text/javascript");
            case "/links":
                const links = await loadLinks();
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(links));
            default:
                // --- REDIRECTION LOGIC ---
                try {
                    const links = await loadLinks();
                    const shortCode = req.url.slice(1); // Remove leading '/' from the URL
                    const targetUrl = links[shortCode];

                    if (targetUrl) {
                        console.log(`Redirecting ${shortCode} to ${targetUrl}`);
                        // Use a 301 redirect for permanent moves.
                        res.writeHead(301, { 'Location': targetUrl });
                        return res.end();
                    }
                } catch (error) {
                    console.error("Error during redirection:", error);
                }
        }
    }

    // --- Fallback for all other unhandled requests ---
    res.writeHead(404, { 'Content-Type': "text/plain" });
    res.end("404 Not Found");
});

server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
