const { useState, useEffect, useRef } = React;
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Mock API
const mockApiEndpoint = async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { id: 1, name: "Milady", file: "malenciaga", tags: ["cube", "3D"] },
    { id: 2, name: "Milady", file: "smoker", tags: ["sphere", "3D"] },
    { id: 3, name: "Remilio", file: "vremilio", tags: ["pyramid", "3D"] },
    { id: 4, name: "Adani", file: "adani", tags: ["pyramid", "3D"] },
    { id: 5, name: "Fat guy", file: "fatguy", tags: ["pyramid", "3D"] },
  ];
};

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
    scene.background = new THREE.Color(0xf1f5f9);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 2.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 20);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = false;
    controlsRef.current = controls;

    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          if (!sceneRef.current) return;
          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              const oldMaterial = child.material;
              const newMaterial = new THREE.MeshStandardMaterial({
                map: oldMaterial.map || null,
                color: oldMaterial.map ? 0xffffff : (oldMaterial.color || 0xcccccc),
                metalness: oldMaterial.metalness || 0.5,
                roughness: oldMaterial.roughness || 0.5,
                side: oldMaterial.side || THREE.FrontSide,
              });
              if (oldMaterial) oldMaterial.dispose();
              child.material = newMaterial;
            }
          });
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.position.sub(center);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 1.5 / maxDim;
          gltf.scene.scale.set(scale, scale, scale);
          sceneRef.current.add(gltf.scene);
        },
        undefined,
        (error) => { console.error('Error loading 3D model:', error); }
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

function Tile({ obj }) {
  const [isRevealed, setIsRevealed] = useState(false);
  const handleClick = () => setIsRevealed(prev => !prev);

  return (
    <div
      className={`border border-gray-200 rounded-lg p-4 w-64 min-h-[50px] cursor-pointer transition-shadow duration-200 ease-in-out flex flex-col items-center hover:shadow-md ${isRevealed ? "border-2 border-blue-500 shadow-lg" : ""}`}
      onClick={handleClick}
    >
      <div className="w-full flex justify-between items-center mb-2.5">
        <span className="font-bold">{obj.name}</span>
        <a href={obj.file} download onClick={e => e.stopPropagation()}>
          <button className="bg-blue-500 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded">Download</button>
        </a>
      </div>
      {isRevealed ? (
        <ThreeJSViewer modelUrl={'public/model/' + obj.file + '.glb'} key={obj.file} />
      ) : (
        <div className="w-full h-24 bg-gray-200 rounded">
          <img src={'public/thumbnail/' + obj.file + '.png'} alt={obj.name} className="w-full h-full object-cover rounded" />
        </div>
      )}
    </div>
  );
}

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await mockApiEndpoint();
        setModels(data);
      } catch (error) {
        console.error("Failed to fetch models:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredObjects = models.filter(obj =>
    obj.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderTiles = (items) => (
    <div className="flex flex-wrap gap-4 mt-5 justify-center">
      {isLoading ? (
        <p className="text-gray-500">Loading models...</p>
      ) : items.length > 0 ? (
        items.map(obj => <Tile key={obj.id} obj={obj} />)
      ) : (
        <p className="text-gray-500">
          {searchTerm ?
            <button className="bg-blue-500 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded">Request {searchTerm}</button>
            : "No models found."
          }
        </p>
      )}
    </div>
  );

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold mb-2">Pockit Asset Database</h1>
      <h3 className="text-lg text-gray-600 mb-4">All assets are viral public license.</h3>
      <input
        type="text"
        placeholder="look for an object..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="p-2 border border-gray-300 rounded w-52 mb-2.5"
      />
      {searchTerm === "" ? (
        <div>{renderTiles(models)}</div>
      ) : (
        <div>
          <h3 className="text-xl font-semibold mt-5">Search Results:</h3>
          {renderTiles(filteredObjects)}
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);