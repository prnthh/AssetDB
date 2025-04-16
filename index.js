const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Backend server URL
const BASE_URL = 'http://192.168.0.239:42004/';

// Path to a test image on your machine (replace with your image path)
const TEST_IMAGE_PATH = './test.png'; // e.g., './test-image.png'
const PROMPT = 'create a 3d model of a tree';

// Function to upload an image and prompt to generate a new model
const generateModel = async (imagePath, prompt) => {
  try {
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(`${BASE_URL}/model?prompt=${encodeURIComponent(prompt)}`, form, {
      headers: form.getHeaders(),
    });

    console.log('Generation Response:', response.data);
    return response.data.modelId;
  } catch (error) {
    throw new Error(`Failed to queue model generation: ${error.message}`);
  }
};

// Function to poll the model status by ID
const pollModelStatus = async (modelId) => {
  try {
    let attempts = 0;
    const maxAttempts = 30; // Poll for up to 5 minutes (30 * 10s)
    const pollInterval = 10000; // Poll every 10 seconds

    while (attempts < maxAttempts) {
      const response = await axios.get(`${BASE_URL}/model?modelID=${modelId}`);
      const model = response.data;
      console.log(`Polling model ${modelId} (Attempt ${attempts + 1}/${maxAttempts}):`, model);

      // Check if the model generation is complete
      // Since the backend doesn't explicitly store a "status" field, we'll assume it's complete
      // if the model exists in the database (you can enhance this logic if you add a status field)
      if (model && model.id) {
        console.log('Model generation appears complete:', model);
        return model;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Model generation did not complete within the expected time');
  } catch (error) {
    throw new Error(`Failed to poll model status: ${error.message}`);
  }
};

// Function to search models by a term
const searchModels = async (searchTerm) => {
  try {
    const response = await axios.get(`${BASE_URL}/?search=${encodeURIComponent(searchTerm)}`);
    console.log(`Search Results for "${searchTerm}":`, response.data);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to search models: ${error.message}`);
  }
};

// Main test function
const runTest = async () => {
  try {
    console.log('Starting test...');

    // Step 1: Generate a new model
    console.log('Generating new model...');
    const modelId = await generateModel(TEST_IMAGE_PATH, PROMPT);

    // Step 2: Poll for the model status
    console.log('Polling for model status...');
    const model = await pollModelStatus(modelId);

    // Step 3: Search for models using a keyword from the prompt
    console.log('Searching for models...');
    const searchTerm = 'tree'; // Keyword from the prompt
    await searchModels(searchTerm);

    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
};

// Run the test
runTest();