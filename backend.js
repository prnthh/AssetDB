const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Insecure HTTPS agent (like --insecure in curl)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Configuration
const BASE_URL = 'http://192.168.0.239:42004';
const UPLOAD_ID = 'fwk985eq8e';
const IMAGE_PATH = './Screenshot.png'; // Adjust path as needed
const OUTPUT_FILE = 'textured_mesh.glb';

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
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        const eventId = data?.event_id || data?.[0] || (typeof data === 'string' && data.match(/"([^"]+)"/)?.[1]);
        if (!eventId) {
            throw new Error('Could not extract event ID from response');
        }
        console.log('Event ID:', eventId);
        return eventId;
    } catch (error) {
        console.error('Error extracting event ID:', error.message);
        throw error;
    }
}

// Upload image file
async function uploadImage() {
    console.log('Uploading image...');
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

    console.log('Upload response:', uploadResponse.data);
    return uploadResponse.data;
}

// Trigger generation
async function triggerGeneration(uploadData) {
    console.log('Generating 3D model...');
    const postData = {
        data: [
            '',
            { path: uploadData.path || uploadData.url || 'http://192.168.0.239:42004/file=C:\\pinokio\\api\\Hunyuan3D-2-lowvram.gitback\\cache\\GRADIO_TEMP_DIR\\c5a24ef403c8c7831c5602bb2c1e4bf19acb7232fdf2310e8bddccc93a297612\\Screenshot 2025-04-01 at 11.48.58AM.png' },
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
    return streamData;
}

// Trigger lambda functions
async function triggerLambda(lambdaNumber) {
    console.log(`Calling lambda_${lambdaNumber}...`);
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
    return streamData;
}

// Export final model
async function exportModel() {
    console.log('Exporting final model...');
    const postData = {
        data: [
            { path: `${BASE_URL}/file=C:\\pinokio\\api\\Hunyuan3D-2-lowvram.gitback\\cache\\GRADIO_TEMP_DIR\\24cc31ca5bac65e124cca2d00508adb36e9a3f412d140c2744db938abecbb069\\white_mesh.glb` },
            { path: `${BASE_URL}/file=C:\\pinokio\\api\\Hunyuan3D-2-lowvram.gitback\\cache\\GRADIO_TEMP_DIR\\259a96dd4ef92998ccba22b6d6515df220ebd0ac0200a1fe71a611cad2989c0c\\textured_mesh.glb` },
            'glb',
            false,
            true,
            10000,
        ],
    };

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

    // Download the final output
    const outputUrl = `${BASE_URL}/static/03c295b6-9ab6-4aec-9089-8b3e7dea0aff/textured_mesh.glb`;
    const outputPath = path.join(__dirname, OUTPUT_FILE);
    const writer = fs.createWriteStream(outputPath);

    const downloadResponse = await axios.get(outputUrl, {
        responseType: 'stream',
        httpsAgent,
    });

    downloadResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on('finish', () => {
            console.log(`Final model saved to ${outputPath}`);
            console.log('Output available at:', outputUrl);
            resolve();
        });
        writer.on('error', reject);
    });

    return streamData;
}

// Main function to run all steps
(async () => {
    try {
        const uploadData = await uploadImage();
        await triggerGeneration(uploadData);
        for (let i = 4; i <= 6; i++) {
            await triggerLambda(i);
        }
        await exportModel();
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
})();