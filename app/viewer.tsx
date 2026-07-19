"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type SceneApi = {
  load: (file: File, localUrl?: string) => void;
  reset: () => void;
  setGrid: (value: boolean) => void;
  setWireframe: (value: boolean) => void;
  setAutoRotate: (value: boolean) => void;
  setExposure: (value: number) => void;
};

declare global {
  interface Window {
    gltfDesktop?: {
      localUrlForFile: (file: File) => string;
      onDroppedFile: (callback: (file: { url: string; name: string; size: number }) => void) => void;
    };
  }
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button className="toggle" aria-pressed={active} onClick={onClick}><span>{label}</span><i className={active ? "on" : ""}><b /></i></button>;
}

export function GLTFViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<SceneApi | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("AURORA KNOT");
  const [meta, setMeta] = useState("PROCEDURAL SCENE");
  const [triangles, setTriangles] = useState("48.0K");
  const [grid, setGrid] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [exposure, setExposure] = useState(1.15);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const loadFile = useCallback((file?: File) => {
    if (!file) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) { setError(".GLB または .GLTF ファイルを選択してください"); return; }
    setError("");
    setName(file.name.replace(/\.(glb|gltf)$/i, "").toUpperCase());
    setMeta(`${(file.size / 1048576).toFixed(2)} MB · ${file.name.split(".").pop()?.toUpperCase()}`);
    const localUrl = window.gltfDesktop?.localUrlForFile(file);
    api.current?.load(file, localUrl);
  }, []);

  useEffect(() => {
    window.gltfDesktop?.onDroppedFile(({ url, name: droppedName, size }) => {
      if (!/\.(glb|gltf)$/i.test(droppedName)) {
        setError(".GLB または .GLTF ファイルをドロップしてください");
        return;
      }
      setError("");
      setDragging(false);
      setName(droppedName.replace(/\.(glb|gltf)$/i, "").toUpperCase());
      setMeta(`${(size / 1048576).toFixed(2)} MB · ${droppedName.split(".").pop()?.toUpperCase()}`);
      api.current?.load(new File([], droppedName), url);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.up.set(0, 0, 1);
    scene.background = new THREE.Color(0x090b0d);
    scene.fog = new THREE.FogExp2(0x090b0d, 0.038);
    const camera = new THREE.PerspectiveCamera(38, 1, .05, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(4.8, 6.2, 3.2);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = .06;
    controls.autoRotate = false;
    controls.autoRotateSpeed = .65;

    scene.add(new THREE.HemisphereLight(0x9bb8ff, 0x111318, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 5);
    key.position.set(4, 5, 7); key.castShadow = true; scene.add(key);
    const rim = new THREE.DirectionalLight(0x85a6ff, 4);
    rim.position.set(-5, -4, 2); scene.add(rim);
    const warm = new THREE.PointLight(0xffa46d, 24, 12);
    warm.position.set(-3, 3, 1); scene.add(warm);

    const gridHelper = new THREE.GridHelper(30, 30, 0x343942, 0x1d2127);
    gridHelper.rotation.x = Math.PI / 2; gridHelper.position.z = -1.7; scene.add(gridHelper);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(10, 64), new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: .88, metalness: .1 }));
    floor.position.z = -1.72; floor.receiveShadow = true; scene.add(floor);

    const root = new THREE.Group();
    scene.add(root);
    const starterGeometry = new THREE.TorusKnotGeometry(1.35, .48, 220, 40, 2, 3);
    starterGeometry.rotateX(Math.PI / 2);
    const starter = new THREE.Mesh(starterGeometry, new THREE.MeshPhysicalMaterial({ color: 0x9ca8bb, metalness: .75, roughness: .23, clearcoat: .75, clearcoatRoughness: .18 }));
    starter.castShadow = true; starter.receiveShadow = true; root.add(starter);

    const disposeRoot = () => {
      while (root.children.length) {
        const object = root.children.pop()!;
        object.traverse((child) => {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
          mats.forEach((m) => m.dispose());
        });
      }
    };
    const frameObject = () => {
      root.position.set(0, 0, 0);
      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);
      const max = Math.max(size.x, size.y, size.z) || 1;
      camera.position.set(max * 1.55, max * 1.9, max * 1.05);
      camera.near = max / 100; camera.far = max * 100; camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0); controls.update();
      gridHelper.position.z = -size.z / 2 - .06; floor.position.z = gridHelper.position.z - .02;
    };
    const setMaterials = (fn: (m: THREE.Material) => void) => root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(fn);
    });
    api.current = {
      load(file, localUrl) {
        const url = localUrl || URL.createObjectURL(file);
        const shouldRevoke = !localUrl;
        new GLTFLoader().load(url, (gltf) => {
          // VTK exports the supplied geometry with Z already encoded as its
          // vertical axis. Keep those coordinates unchanged in our Z-up scene.
          gltf.scene.userData.upAxis = "Z";
          disposeRoot(); root.add(gltf.scene);
          let count = 0;
          root.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) { const g = m.geometry; count += g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3; m.castShadow = true; m.receiveShadow = true; } });
          setTriangles(count >= 1000 ? `${(count / 1000).toFixed(1)}K` : `${Math.round(count)}`);
          frameObject(); if (shouldRevoke) URL.revokeObjectURL(url);
        }, undefined, () => { setError(localUrl ? "モデルまたは参照ファイルを読み込めませんでした" : "モデルを読み込めませんでした。外部参照のないGLBをお試しください"); if (shouldRevoke) URL.revokeObjectURL(url); });
      },
      reset() { frameObject(); },
      setGrid(value) { gridHelper.visible = value; floor.visible = value; },
      setWireframe(value) { setMaterials((m) => { if ("wireframe" in m) (m as THREE.MeshStandardMaterial).wireframe = value; }); },
      setAutoRotate(value) { controls.autoRotate = value; },
      setExposure(value) { renderer.toneMappingExposure = value; },
    };

    const resize = () => {
      const parent = canvas.parentElement!;
      renderer.setSize(parent.clientWidth, parent.clientHeight, false);
      camera.aspect = parent.clientWidth / parent.clientHeight; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas.parentElement!); resize();
    let frame = 0;
    const tick = () => { frame = requestAnimationFrame(tick); controls.update(); renderer.render(scene, camera); };
    tick();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); disposeRoot(); renderer.dispose(); api.current = null; };
  }, []);

  const toggleGrid = () => setGrid(v => { api.current?.setGrid(!v); return !v; });
  const toggleWire = () => setWireframe(v => { api.current?.setWireframe(!v); return !v; });
  const toggleRotate = () => setAutoRotate(v => { api.current?.setAutoRotate(!v); return !v; });

  return (
    <main className="app-shell">
      <header>
        <div className="brand"><span className="brand-mark">G</span><div><strong>GLTF LAB</strong><small>REALTIME MODEL VIEWER</small></div></div>
        <div className="top-actions"><span className="webgl"><i /> WEBGL 2.0</span><button className="open-button" onClick={() => inputRef.current?.click()}>＋ OPEN MODEL</button></div>
      </header>
      <section className="workspace">
        <aside className="left-panel">
          <div className="panel-label">SCENE</div>
          <div className="scene-item active"><span className="cube-icon">◇</span><div><b>{name}</b><small>{meta}</small></div><em>●</em></div>
          <div className="empty-scene"><span>＋</span><p>Drop another model<br/>to replace the scene</p></div>
          <div className="panel-footer"><span>1 OBJECT</span><span>{triangles} TRIS</span></div>
        </aside>

        <div className={`viewport ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}>
          <canvas ref={canvasRef} aria-label="3D model viewport" />
          <div className="viewport-top"><span>PERSPECTIVE</span><span>SHADED</span></div>
          <div className="axis" aria-label="Z-up coordinate system"><b className="z">Z</b><b className="x">X</b><b className="y">Y</b></div>
          <div className="drop-hint"><strong>{dragging ? "RELEASE TO LOAD" : "DROP GLB / GLTF"}</strong><span>or use Open Model</span></div>
          {error && <div className="error-toast">{error}<button onClick={() => setError("")}>×</button></div>}
          <div className="view-tools"><button aria-label="Reset view" onClick={() => api.current?.reset()}>⌂</button><button aria-label="Toggle auto rotate" className={autoRotate ? "active" : ""} onClick={toggleRotate}>↻</button><button aria-label="Toggle grid" className={grid ? "active" : ""} onClick={toggleGrid}>#</button></div>
        </div>

        <aside className="right-panel">
          <div className="panel-label">INSPECTOR</div>
          <section><h3>DISPLAY</h3><Toggle label="Grid floor" active={grid} onClick={toggleGrid}/><Toggle label="Wireframe" active={wireframe} onClick={toggleWire}/><Toggle label="Auto rotate" active={autoRotate} onClick={toggleRotate}/></section>
          <section><h3>LIGHTING</h3><label className="range-label"><span>Exposure</span><output>{exposure.toFixed(2)}</output></label><input type="range" min="0.35" max="2.2" step="0.05" value={exposure} onChange={(e) => { const v = +e.target.value; setExposure(v); api.current?.setExposure(v); }}/><div className="environment"><span className="env-preview"/><div><b>STUDIO SOFT</b><small>Neutral HDRI</small></div><button>›</button></div></section>
          <section><h3>MODEL INFO</h3><dl><div><dt>Format</dt><dd>{meta.includes("GLTF") ? "glTF 2.0" : meta.includes("GLB") ? "Binary glTF" : "Generated"}</dd></div><div><dt>Up axis</dt><dd>Z</dd></div><div><dt>Triangles</dt><dd>{triangles}</dd></div><div><dt>Renderer</dt><dd>WebGL</dd></div></dl></section>
          <button className="reset-button" onClick={() => api.current?.reset()}>RESET CAMERA <span>R</span></button>
        </aside>
      </section>
      <footer><div><span className="status-dot"/> READY</div><div className="help"><span>DRAG</span> Rotate <span>SCROLL</span> Zoom <span>SHIFT + DRAG</span> Pan</div><div>THREE.JS · GLTF 2.0</div></footer>
      <input ref={inputRef} hidden type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={(e) => loadFile(e.target.files?.[0])}/>
    </main>
  );
}
