import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (currentMount && rendererRef.current.domElement) {
          if (currentMount.contains(rendererRef.current.domElement)) {
            currentMount.removeChild(rendererRef.current.domElement);
          }
        }
        rendererRef.current = null;
      }
      if (sceneRef.current) {
        sceneRef.current.traverse(object => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
        sceneRef.current = null;
      }
    };

    cleanup();

    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9); // Tailwind gray-100
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 2.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 5);
    scene.add(ambientLight);

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
        (error) => {
          console.error('Error loading 3D model:', error);
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

export default ThreeJSViewer;
