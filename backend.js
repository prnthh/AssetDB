const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Insecure HTTPS agent
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Configuration
const BASE_URL = 'http://192.168.0.239:42004';
const UPLOAD_ID = 'fwk985eq8e';
const IMAGE_PATH = './Screenshot.png';
const OUTPUT_FILE = 'textured_mesh.glb';

// Helper function to normalize URLs
function normalizeUrl(url) {
    return url.replace(/\\/g, '/');
}

// Helper function to extract UUID from iframe source and construct .glb URL
function deriveExportUrl(iframeHtml) {
    // Normalize the HTML string to handle escaped backslashes
    const normalizedHtml = iframeHtml.replace(/\\+/g, '/');
    const match = normalizedHtml.match(/src="\/static\/([0-9a-f-]+)\/textured_mesh\.html"/);
    if (!match) {
        throw new Error('Could not extract UUID from iframe source');
    }
    const uuid = match[1];
    return `${BASE_URL}/static/${uuid}/textured_mesh.glb`;
}

// Helper function to wait for a stream to complete
async function waitForStream(stream) {
    return new Promise((resolve, reject) => {
        let data = '';
        stream.on('data', chunk => {
            data += chunk.toString();
            console.log('Stream data chunk:', chunk.toString());
        });
        stream.on('end', () => {
            console.log('Stream completed');
            resolve(data);
        });
        stream.on('error', err => {
            console.error('Stream error:', err.message);
            reject(err);
        });
    });
}

// Helper function to get event ID from response
async function getEventId(response) {
    try {
        console.log('Raw response for event ID:', response.data);
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        const eventId = data?.event_id || data?.[0] || (typeof data === 'string' && data.match(/"([^"]+)"/)?.[1]);
        if (!eventId) {
            throw new Error('Could not extract event ID from response');
        }
        console.log('Extracted Event ID:', eventId);
        return eventId;
    } catch (error) {
        console.error('Error extracting event ID:', error.message);
        throw error;
    }
}

// Helper function to validate a URL
async function validateUrl(url) {
    try {
        const normalizedUrl = normalizeUrl(url);
        const response = await axios.head(normalizedUrl, { httpsAgent });
        console.log(`URL validation for ${normalizedUrl}: Status ${response.status}`);
        return response.status === 200;
    } catch (error) {
        console.error(`URL validation failed for ${url}:`, error.message);
        if (error.response) {
            console.error(`Validation response status: ${error.response.status}`);
        }
        return false;
    }
}

// Upload image file
async function uploadImage() {
    console.log('Uploading image...');
    try {
        const form = new FormData();
        form.append('files', fs.createReadStream(IMAGE_PATH), {
            filename: 'Screenshot 2025-04-01 at 11.48.58AM.png',
            contentType: 'image/png',
        });

        const uploadResponse = await axios.post(`${BASE_URL}/upload?upload_id=${UPLOAD_ID}`, form, {
            headers: {
                ...form.getHeaders(),
                'Accept': '*/*',
                'Accept-Language': 'en-US,en-GB;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Origin': BASE_URL,
                'Pragma': 'no-cache',
                'Referer': `${BASE_URL}/`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            },
            httpsAgent,
        });

        console.log('Upload response:', JSON.stringify(uploadResponse.data, null, 2));
        return uploadResponse.data;
    } catch (error) {
        console.error('Upload error:', error.message);
        if (error.response) {
            console.error('Upload response data:', error.response.data);
            console.error('Upload response status:', error.response.status);
        }
        throw error;
    }
}

// Trigger generation
async function triggerGeneration(uploadData) {
    console.log('Generating 3D model...');
    try {
        const postData = {
            data: [
                '',
                { path: uploadData[0] },
                null,
                null,
                null,
                null,
                30,
                5,
                1234,
                256,
                true,
                8000,
                true,
            ],
        };
        console.log('Generation payload:', JSON.stringify(postData, null, 2));

        const postResponse = await axios.post(`${BASE_URL}/call/generation_all`, postData, {
            headers: { 'Content-Type': 'application/json' },
            httpsAgent,
        });

        const eventId = await getEventId(postResponse);
        const streamResponse = await axios.get(`${BASE_URL}/call/generation_all/${eventId}`, {
            responseType: 'stream',
            httpsAgent,
        });

        const streamData = await waitForStream(streamResponse.data);
        console.log('Generation response completed');

        // Parse the stream data to extract mesh paths
        let whiteMeshPath, texturedMeshPath, whiteMeshLocalPath, texturedMeshLocalPath;
        try {
            const eventData = streamData.split('event: complete\ndata: ')[1];
            if (!eventData) {
                throw new Error('No complete event data found in stream');
            }
            const parsedData = JSON.parse(eventData);
            whiteMeshLocalPath = parsedData[0].value.path;
            texturedMeshLocalPath = parsedData[1].value.path;
            whiteMeshPath = normalizeUrl(parsedData[0].value.url);
            texturedMeshPath = normalizeUrl(parsedData[1].value.url);
            console.log('Parsed generation data:', {
                whiteMeshLocalPath,
                texturedMeshLocalPath,
                whiteMeshPath,
                texturedMeshPath,
            });

            // Validate URLs (optional, for debugging)
            console.log('Validating generation URLs...');
            const whiteMeshValid = await validateUrl(whiteMeshPath);
            const texturedMeshValid = await validateUrl(texturedMeshPath);
            console.log('URL validation results:', { whiteMeshValid, texturedMeshValid });
        } catch (error) {
            console.error('Error parsing generation stream data:', error.message);
            console.error('Raw stream data:', streamData);
            throw error;
        }

        return { whiteMeshPath, texturedMeshPath, whiteMeshLocalPath, texturedMeshLocalPath };
    } catch (error) {
        console.error('Generation error:', error.message);
        if (error.response) {
            console.error('Generation response data:', error.response.data);
            console.error('Generation response status:', error.response.status);
        }
        throw error;
    }
}

// Trigger lambda functions
async function triggerLambda(lambdaNumber) {
    console.log(`Calling lambda_${lambdaNumber}...`);
    try {
        const postResponse = await axios.post(`${BASE_URL}/call/lambda_${lambdaNumber}`, { data: [] }, {
            headers: { 'Content-Type': 'application/json' },
            httpsAgent,
        });

        const eventId = await getEventId(postResponse);
        const streamResponse = await axios.get(`${BASE_URL}/call/lambda_${lambdaNumber}/${eventId}`, {
            responseType: 'stream',
            httpsAgent,
        });

        const streamData = await waitForStream(streamResponse.data);
        console.log(`Lambda_${lambdaNumber} response completed`);
        console.log(`Lambda_${lambdaNumber} raw stream data:`, streamData);
        return streamData;
    } catch (error) {
        console.error(`Lambda_${lambdaNumber} error:`, error.message);
        if (error.response) {
            console.error(`Lambda_${lambdaNumber} response data:`, error.response.data);
            console.error(`Lambda_${lambdaNumber} response status:`, error.response.status);
        }
        throw error;
    }
}

// Download file helper
async function downloadFile(url, outputPath, attempt = 1, maxRetries = 3) {
    console.log(`Attempt ${attempt} to download from: ${url}`);
    try {
        const normalizedUrl = normalizeUrl(url);
        const writer = fs.createWriteStream(outputPath);
        const downloadResponse = await axios.get(normalizedUrl, {
            responseType: 'stream',
            httpsAgent,
        });

        downloadResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`File saved to ${outputPath}`);
                console.log('Output available at:', normalizedUrl);
                resolve();
            });
            writer.on('error', err => {
                console.error('Download write error:', err.message);
                reject(err);
            });
        });
    } catch (error) {
        console.error(`Download attempt ${attempt} failed:`, error.message);
        if (error.response) {
            console.error('Download response data:', error.response.data);
            console.error('Download response status:', error.response.status);
        }
        if (attempt < maxRetries) {
            console.log(`Retrying in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return downloadFile(url, outputPath, attempt + 1, maxRetries);
        }
        throw error;
    }
}

// Export final model
async function exportModel(meshPaths) {
    console.log('Exporting final model...');
    try {
        const postData = {
            data: [
                { path: meshPaths.whiteMeshLocalPath },
                { path: meshPaths.texturedMeshLocalPath },
                'glb',
                false,
                true,
                10000,
            ],
        };
        console.log('Export payload:', JSON.stringify(postData, null, 2));

        const postResponse = await axios.post(`${BASE_URL}/call/on_export_click`, postData, {
            headers: { 'Content-Type': 'application/json' },
            httpsAgent,
        });

        const eventId = await getEventId(postResponse);
        const streamResponse = await axios.get(`${BASE_URL}/call/on_export_click/${eventId}`, {
            responseType: 'stream',
            httpsAgent,
        });

        const streamData = await waitForStream(streamResponse.data);
        console.log('Export response completed');
        console.log('Export raw stream data:', streamData);

        // Parse the export stream data
        let outputUrl;
        try {
            if (streamData.includes('event: error')) {
                console.error('Export stream returned an error:', streamData);
                throw new Error('Export failed with server error');
            }
            const eventData = streamData.split('event: complete\ndata: ')[1];
            if (!eventData) {
                throw new Error('No complete event data found in stream');
            }
            const parsedData = JSON.parse(eventData);
            // Derive the correct URL from the iframe source
            outputUrl = normalizeUrl(deriveExportUrl(parsedData[0]));
            console.log('Derived export output URL:', outputUrl);

            // Validate URL
            const isValid = await validateUrl(outputUrl);
            if (!isValid) {
                console.error('Output URL is invalid:', outputUrl);
                throw new Error('Output URL is not accessible');
            }
        } catch (error) {
            console.error('Error processing export stream:', error.message);
            throw error;
        }

        // Download the final output
        const outputPath = path.join(__dirname, OUTPUT_FILE);
        await downloadFile(outputUrl, outputPath);

        return streamData;
    } catch (error) {
        console.error('Export error:', error.message);
        if (error.response) {
            console.error('Export response data:', error.response.data);
            console.error('Export response status:', error.response.status);
        }
        throw error;
    }
}

// Main function
(async () => {
    try {
        console.log('Starting script execution...');
        const uploadData = await uploadImage();
        const meshPaths = await triggerGeneration(uploadData);
        for (let i = 4; i <= 6; i++) {
            await triggerLambda(i);
        }
        await exportModel(meshPaths);
        console.log('Script execution completed successfully');
    } catch (error) {
        console.error('Main execution error:', error.message);
        if (error.response) {
            console.error('Main response data:', error.response.data);
            console.error('Main response status:', error.response.status);
        }
    }
})();