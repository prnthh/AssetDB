const { useState, useEffect, useRef } = React;
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// const API_URL = 'http://localhost:3000/api';
const API_URL = 'https://02ce-49-205-149-119.ngrok-free.app/api';


function ThreeJSViewer({ modelUrl }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const controlsRef = useRef(null);
  const [isModelReady, setIsModelReady] = useState(false);

  useEffect(() => {
    if (!modelUrl) return;
    setIsModelReady(true);
  }, [modelUrl]);

  useEffect(() => {
    if (!mountRef.current || !isModelReady) return;
    const currentMount = mountRef.current;

    const cleanup = () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (controlsRef.current) { controlsRef.current.dispose(); controlsRef.current = null; }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (currentMount && rendererRef.current.domElement && currentMount.contains(rendererRef.current.domElement)) {
          currentMount.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current = null;
      }
      if (sceneRef.current) {
        sceneRef.current.traverse(object => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
            else object.material.dispose();
          }
        });
        sceneRef.current = null;
      }
    };

    cleanup();

    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          if (!sceneRef.current) return;
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim;
          model.scale.set(scale, scale, scale);
          model.position.sub(center.multiplyScalar(scale));
          sceneRef.current.add(model);
          const distance = maxDim * scale * 1.5;
          camera.position.set(0, 0, distance);
          controls.target.set(0, 0, 0);
          controls.update();
        },
        (progress) => {
          console.log('Loading progress:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => {
          console.error('Error loading model:', error);
        }
      );
    }

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      if (controlsRef.current && rendererRef.current && sceneRef.current) {
        controlsRef.current.update();
        rendererRef.current.render(sceneRef.current, camera);
      } else {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!currentMount || !rendererRef.current || !camera) return;
      const width = currentMount.clientWidth;
      const height = currentMount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cleanup();
    };
  }, [modelUrl, isModelReady]);

  return <div className="w-full h-48 bg-gray-100 mt-2.5 rounded" ref={mountRef}></div>;
}

function Tile({ job }) {
  const [isRevealed, setIsRevealed] = useState(false);
  const handleClick = () => setIsRevealed(prev => !prev);

  // Construct the file URL using the new endpoint
  const fileUrl = job.status === 'completed' ? `${API_URL}/jobs/${job.id}/file` : null;

  return (
    <div
      className={`border border-gray-200 rounded-lg p-4 w-64 min-h-[50px] cursor-pointer transition-shadow duration-200 ease-in-out flex flex-col items-center hover:shadow-md ${isRevealed ? "border-2 border-blue-500 shadow-lg" : ""}`}
      onClick={handleClick}
    >
      <div className="w-full flex justify-between items-center mb-2.5">
        <span className="font-bold">Job {job.id}</span>
        {job.status === 'completed' && fileUrl && (
          <a href={fileUrl} download={`${job.id}.glb`} onClick={e => e.stopPropagation()}>
            <button className="bg-blue-500 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded">Download GLB</button>
          </a>
        )}
      </div>
      <div className="w-full text-sm text-gray-600 mb-2">
        <p>Status: {job.status}</p>
        <p>Created: {new Date(job.createdAt).toLocaleString()}</p>
        {job.error && <p className="text-red-500">{job.error}</p>}
      </div>
      {isRevealed && job.status === 'completed' && fileUrl ? (
        <ThreeJSViewer modelUrl={fileUrl} key={job.id} />
      ) : (
        <div className="w-full h-24 bg-gray-200 rounded flex items-center justify-center">
          <span className="text-gray-500">{job.status === 'completed' ? 'Click to view model' : 'Processing...'}</span>
        </div>
      )}
    </div>
  );
}

function App() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${API_URL}/jobs`);
      if (!response.ok) throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpload = async () => {
    const file = fileInputRef.current.files[0];
    if (!file) {
      setUploadStatus('Please select an image');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploadStatus('Uploading...');
      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
      const data = await response.json();
      setUploadStatus(`Job created: ${data.jobId}`);
      fileInputRef.current.value = '';
      fetchJobs();
    } catch (error) {
      setUploadStatus('Upload failed: ' + error.message);
    }
  };

  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-3xl font-bold mb-6">Pockit Asset Database</h1>
      
      <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Upload Image</h2>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          onClick={handleUpload}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Upload
        </button>
        <p className="mt-2 text-sm text-gray-600">{uploadStatus}</p>
      </div>

      <h2 className="text-xl font-semibold mb-4">Processed Models</h2>
      <div className="flex flex-wrap gap-4 justify-center">
        {isLoading ? (
          <p className="text-gray-500">Loading jobs...</p>
        ) : jobs.length > 0 ? (
          jobs.map(job => <Tile key={job.id} job={job} />)
        ) : (
          <p className="text-gray-500">No jobs found.</p>
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);