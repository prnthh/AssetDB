const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const https = require('https');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

// Initialize Express app
const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// Insecure HTTPS agent
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Configuration
const BASE_URL = 'http://192.168.0.239:42004';
const OUTPUT_DIR = path.join(__dirname, 'outputs');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure output and upload directories exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`)
});
const upload = multer({ storage });

// In-memory job store
const jobs = {};

// Middleware
app.use(express.json());

// Helper functions (adapted from original code)
function normalizeUrl(url) {
    return url.replace(/\\/g, '/');
}

function deriveExportUrl(iframeHtml) {
    const normalizedHtml = iframeHtml.replace(/\\+/g, '/');
    const match = normalizedHtml.match(/src="\/static\/([0-9a-f-]+)\/textured_mesh\.html"/);
    if (!match) throw new Error('Could not extract UUID from iframe source');
    return `${BASE_URL}/static/${match[1]}/textured_mesh.glb`;
}

async function waitForStream(stream) {
    return new Promise((resolve, reject) => {
        let data = '';
        stream.on('data', chunk => data += chunk.toString());
        stream.on('end', () => resolve(data));
        stream.on('error', err => reject(err));
    });
}

async function getEventId(response) {
    try {
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        const eventId = data?.event_id || data?.[0] || (typeof data === 'string' && data.match(/"([^"]+)"/)?.[1]);
        if (!eventId) throw new Error('Could not extract event ID from response');
        return eventId;
    } catch (error) {
        throw new Error('Error extracting event ID: ' + error.message);
    }
}

async function validateUrl(url) {
    try {
        const normalizedUrl = normalizeUrl(url);
        const response = await axios.head(normalizedUrl, { httpsAgent });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

async function uploadImage(imagePath, uploadId) {
    try {
        const form = new FormData();
        form.append('files', fs.createReadStream(imagePath), {
            filename: path.basename(imagePath),
            contentType: 'image/png',
        });

        const response = await axios.post(`${BASE_URL}/upload?upload_id=${uploadId}`, form, {
            headers: { ...form.getHeaders(), 'Accept': '*/*' },
            httpsAgent,
        });
        return response.data;
    } catch (error) {
        throw new Error('Upload error: ' + error.message);
    }
}

async function triggerGeneration(uploadData) {
    try {
        const postData = {
            data: ['', { path: uploadData[0] }, null, null, null, null, 30, 5, 1234, 256, true, 8000, true],
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
        const eventData = streamData.split('event: complete\ndata: ')[1];
        if (!eventData) throw new Error('No complete event data found in stream');

        const parsedData = JSON.parse(eventData);
        return {
            whiteMeshLocalPath: parsedData[0].value.path,
            texturedMeshLocalPath: parsedData[1].value.path,
            whiteMeshPath: normalizeUrl(parsedData[0].value.url),
            texturedMeshPath: normalizeUrl(parsedData[1].value.url),
        };
    } catch (error) {
        throw new Error('Generation error: ' + error.message);
    }
}

async function triggerLambda(lambdaNumber) {
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

        return await waitForStream(streamResponse.data);
    } catch (error) {
        throw new Error(`Lambda_${lambdaNumber} error: ` + error.message);
    }
}

async function downloadFile(url, outputPath) {
    try {
        const normalizedUrl = normalizeUrl(url);
        const writer = fs.createWriteStream(outputPath);
        const response = await axios.get(normalizedUrl, { responseType: 'stream', httpsAgent });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        throw new Error('Download error: ' + error.message);
    }
}

async function exportModel(meshPaths, jobId) {
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
        if (streamData.includes('event: error')) {
            throw new Error('Export failed with server error');
        }

        const eventData = streamData.split('event: complete\ndata: ')[1];
        if (!eventData) throw new Error('No complete event data found in stream');

        const parsedData = JSON.parse(eventData);
        const outputUrl = normalizeUrl(deriveExportUrl(parsedData[0]));
        if (!await validateUrl(outputUrl)) {
            throw new Error('Output URL is not accessible');
        }

        const outputPath = path.join(OUTPUT_DIR, `${jobId}.glb`);
        await downloadFile(outputUrl, outputPath);
        return outputUrl;
    } catch (error) {
        throw new Error('Export error: ' + error.message);
    }
}

// Process job asynchronously
async function processJob(jobId, imagePath) {
    jobs[jobId].status = 'processing';
    try {
        const uploadId = uuidv4();
        const uploadData = await uploadImage(imagePath, uploadId);
        const meshPaths = await triggerGeneration(uploadData);
        for (let i = 4; i <= 6; i++) {
            await triggerLambda(i);
        }
        const outputUrl = await exportModel(meshPaths, jobId);
        jobs[jobId].status = 'completed';
        jobs[jobId].outputUrl = outputUrl;
        jobs[jobId].outputPath = path.join(OUTPUT_DIR, `${jobId}.glb`);
    } catch (error) {
        jobs[jobId].status = 'failed';
        jobs[jobId].error = error.message;
    }
}

// Endpoints
app.post('/api/jobs', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }

    const jobId = uuidv4();
    jobs[jobId] = {
        id: jobId,
        status: 'pending',
        createdAt: new Date(),
        imagePath: req.file.path,
    };

    // Process job in the background
    processJob(jobId, req.file.path).catch(err => console.error(`Job ${jobId} failed:`, err));

    res.status(201).json({ jobId, status: 'pending' });
});

app.get('/api/jobs', (req, res) => {
    const jobList = Object.values(jobs).map(job => ({
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        outputUrl: job.outputUrl || null,
        error: job.error || null,
    }));
    res.json(jobList);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});