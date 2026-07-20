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
  setPerspective: (value: boolean) => void;
  setExposure: (value: number) => void;
  setLayerVisible: (id: string, value: boolean) => void;
  setAllLayersVisible: (value: boolean) => void;
};

type SceneLayer = {
  id: string;
  name: string;
  detail: string;
  visible: boolean;
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
  const [perspective, setPerspective] = useState(false);
  const [exposure, setExposure] = useState(1.15);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [layers, setLayers] = useState<SceneLayer[]>([]);

  const loadFile = useCallback((file?: File) => {
    if (!file) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) { setError(".GLB または .GLTF ファイルを選択してください"); return; }
    setError("");
    setLayers([]);
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
      setLayers([]);
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
    const perspectiveFov = 38;
    let viewportAspect = 1;
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = new THREE.OrthographicCamera(-2.5 * viewportAspect, 2.5 * viewportAspect, 2.5, -2.5, .05, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(4.8, 6.2, 3.2);
    const createControls = (activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera, target = new THREE.Vector3(), autoRotate = false) => {
      const nextControls = new OrbitControls(activeCamera, canvas);
      nextControls.enableDamping = true;
      nextControls.dampingFactor = .06;
      nextControls.autoRotate = autoRotate;
      nextControls.autoRotateSpeed = .65;
      nextControls.target.copy(target);
      nextControls.update();
      return nextControls;
    };
    let controls = createControls(camera);

    const perspectiveHalfHeight = (distance: number) => distance * Math.tan(THREE.MathUtils.degToRad(perspectiveFov / 2));
    const updateOrthographicFrustum = (orthographic: THREE.OrthographicCamera, halfHeight: number) => {
      orthographic.left = -halfHeight * viewportAspect;
      orthographic.right = halfHeight * viewportAspect;
      orthographic.top = halfHeight;
      orthographic.bottom = -halfHeight;
      orthographic.updateProjectionMatrix();
    };
    const changeProjection = (usePerspective: boolean) => {
      if (usePerspective === (camera instanceof THREE.PerspectiveCamera)) return;

      const target = controls.target.clone();
      const direction = camera.position.clone().sub(target);
      if (direction.lengthSq() === 0) direction.set(1, 1, 1);
      direction.normalize();
      const autoRotate = controls.autoRotate;
      let nextCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

      if (usePerspective) {
        const orthographic = camera as THREE.OrthographicCamera;
        const halfHeight = (orthographic.top - orthographic.bottom) / (2 * orthographic.zoom);
        const distance = halfHeight / Math.tan(THREE.MathUtils.degToRad(perspectiveFov / 2));
        nextCamera = new THREE.PerspectiveCamera(perspectiveFov, viewportAspect, camera.near, camera.far);
        nextCamera.position.copy(target).addScaledVector(direction, distance);
      } else {
        const distance = Math.max(camera.position.distanceTo(target), .001);
        const halfHeight = perspectiveHalfHeight(distance);
        nextCamera = new THREE.OrthographicCamera(-halfHeight * viewportAspect, halfHeight * viewportAspect, halfHeight, -halfHeight, camera.near, camera.far);
        nextCamera.position.copy(camera.position);
      }

      nextCamera.up.copy(camera.up);
      controls.dispose();
      camera = nextCamera;
      controls = createControls(camera, target, autoRotate);
    };

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
      camera.near = max / 100;
      camera.far = max * 100;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = viewportAspect;
        camera.updateProjectionMatrix();
      } else {
        camera.zoom = 1;
        updateOrthographicFrustum(camera, perspectiveHalfHeight(camera.position.length()));
      }
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
          const detectedLayers: SceneLayer[] = [];
          const usedNames = new Map<string, number>();
          gltf.scene.traverse((object) => {
            const renderable = object as THREE.Mesh;
            if (!renderable.geometry) return;

            const geometry = renderable.geometry;
            const positions = geometry.attributes.position?.count || 0;
            const elementCount = geometry.index?.count || positions;
            const isLine = (object as THREE.Line).isLine === true;
            const isPoints = (object as THREE.Points).isPoints === true;
            const kind = isLine ? "LINES" : isPoints ? "POINTS" : "MESH";
            const units = isLine ? Math.round(elementCount / 2) : isPoints ? positions : Math.round(elementCount / 3);
            const suffix = isLine ? "SEGMENTS" : isPoints ? "POINTS" : "TRIS";

            if (!isLine && !isPoints) {
              count += elementCount / 3;
              const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : [];
              materials.forEach((material) => {
                material.side = THREE.DoubleSide;
                material.needsUpdate = true;
              });
            }
            renderable.castShadow = !isLine && !isPoints;
            renderable.receiveShadow = !isLine && !isPoints;

            const fallbackName = kind === "MESH" ? "Mesh" : kind === "LINES" ? "Lines" : "Points";
            const baseName = object.name.trim() || `${fallbackName} ${detectedLayers.length + 1}`;
            const duplicateIndex = (usedNames.get(baseName) || 0) + 1;
            usedNames.set(baseName, duplicateIndex);
            const displayName = duplicateIndex === 1 ? baseName : `${baseName} (${duplicateIndex})`;
            const formattedUnits = units >= 1000 ? `${(units / 1000).toFixed(1)}K` : `${units}`;

            detectedLayers.push({
              id: object.uuid,
              name: displayName,
              detail: `${kind} · ${formattedUnits} ${suffix}`,
              visible: object.visible,
            });
          });
          setLayers(detectedLayers);
          setTriangles(count >= 1000 ? `${(count / 1000).toFixed(1)}K` : `${Math.round(count)}`);
          frameObject(); if (shouldRevoke) URL.revokeObjectURL(url);
        }, undefined, () => { setError(localUrl ? "モデルまたは参照ファイルを読み込めませんでした" : "モデルを読み込めませんでした。外部参照のないGLBをお試しください"); if (shouldRevoke) URL.revokeObjectURL(url); });
      },
      reset() { frameObject(); },
      setGrid(value) { gridHelper.visible = value; floor.visible = value; },
      setWireframe(value) { setMaterials((m) => { if ("wireframe" in m) (m as THREE.MeshStandardMaterial).wireframe = value; }); },
      setAutoRotate(value) { controls.autoRotate = value; },
      setPerspective(value) { changeProjection(value); },
      setExposure(value) { renderer.toneMappingExposure = value; },
      setLayerVisible(id, value) {
        const object = root.getObjectByProperty("uuid", id);
        if (object) object.visible = value;
      },
      setAllLayersVisible(value) {
        root.traverse((object) => {
          if ((object as THREE.Mesh).geometry) object.visible = value;
        });
      },
    };

    const resize = () => {
      const parent = canvas.parentElement!;
      renderer.setSize(parent.clientWidth, parent.clientHeight, false);
      viewportAspect = parent.clientWidth / Math.max(parent.clientHeight, 1);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = viewportAspect;
        camera.updateProjectionMatrix();
      } else {
        updateOrthographicFrustum(camera, (camera.top - camera.bottom) / 2);
      }
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
  const togglePerspective = () => setPerspective(v => { api.current?.setPerspective(!v); return !v; });
  const toggleLayer = (id: string) => {
    setLayers(current => current.map(layer => {
      if (layer.id !== id) return layer;
      const visible = !layer.visible;
      api.current?.setLayerVisible(id, visible);
      return { ...layer, visible };
    }));
  };
  const setAllLayers = (visible: boolean) => {
    api.current?.setAllLayersVisible(visible);
    setLayers(current => current.map(layer => ({ ...layer, visible })));
  };

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
          {layers.length > 0 && (
            <div className="layers-panel">
              <div className="layers-heading">
                <span>LAYERS</span>
                <div><button onClick={() => setAllLayers(true)}>ALL</button><button onClick={() => setAllLayers(false)}>NONE</button></div>
              </div>
              <div className="layers-list">
                {layers.map(layer => (
                  <button key={layer.id} className={`layer-item ${layer.visible ? "visible" : "hidden"}`} onClick={() => toggleLayer(layer.id)} aria-pressed={layer.visible}>
                    <span className="layer-eye" aria-hidden="true">{layer.visible ? "●" : "○"}</span>
                    <span><b>{layer.name}</b><small>{layer.detail}</small></span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="panel-footer"><span>{layers.length || 1} OBJECT{layers.length === 1 ? "" : "S"}</span><span>{triangles} TRIS</span></div>
        </aside>

        <div className={`viewport ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}>
          <canvas ref={canvasRef} aria-label="3D model viewport" />
          <div className="viewport-top"><button aria-pressed={perspective} onClick={togglePerspective}>{perspective ? "PERSPECTIVE" : "ORTHOGRAPHIC"}</button><span>SHADED</span></div>
          <div className="axis" aria-label="Z-up coordinate system"><b className="z">Z</b><b className="x">X</b><b className="y">Y</b></div>
          <div className="drop-hint"><strong>{dragging ? "RELEASE TO LOAD" : "DROP GLB / GLTF"}</strong><span>or use Open Model</span></div>
          {error && <div className="error-toast">{error}<button onClick={() => setError("")}>×</button></div>}
          <div className="view-tools"><button aria-label="Reset view" onClick={() => api.current?.reset()}>⌂</button><button aria-label="Toggle auto rotate" className={autoRotate ? "active" : ""} onClick={toggleRotate}>↻</button><button aria-label="Toggle grid" className={grid ? "active" : ""} onClick={toggleGrid}>#</button></div>
        </div>

        <aside className="right-panel">
          <div className="panel-label">INSPECTOR</div>
          <section><h3>DISPLAY</h3><Toggle label="Perspective" active={perspective} onClick={togglePerspective}/><Toggle label="Grid floor" active={grid} onClick={toggleGrid}/><Toggle label="Wireframe" active={wireframe} onClick={toggleWire}/><Toggle label="Auto rotate" active={autoRotate} onClick={toggleRotate}/></section>
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
