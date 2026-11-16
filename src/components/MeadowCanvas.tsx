import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMeadowEnvironment, groundHeightAt } from '../scene/meadowEnvironment';
import { MOOD_THEMES } from '../scene/moodThemes';
import { createSheepFlock } from '../scene/sheepFlock';
import type { CameraPreset, CameraViewState, DayMood, ResolvedWeather } from '../types/capsule';
import { meadowAudio } from '../utils/soundEffects';

interface MeadowCanvasProps {
  mood: DayMood;
  weather: ResolvedWeather;
  message: string;
  cameraPreset: CameraPreset;
  cameraView?: CameraViewState | null;
  scatterNonce: number;
  isWindowOpen: boolean;
  onRegisterCameraGetter?: (getter: (() => CameraViewState) | null) => void;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  letter: {
    pos: [0, 17.5, 16.5],
    target: [0, 0.2, 0.3],
  },
  meadow: {
    pos: [0, 5.8, 22.0],
    target: [0, 1.5, -2.8],
  },
};

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function MeadowCanvas({
  mood,
  weather,
  message,
  cameraPreset,
  cameraView = null,
  scatterNonce,
  isWindowOpen,
  onRegisterCameraGetter,
}: MeadowCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const moodRef = useRef<DayMood>(mood);
  const weatherRef = useRef<ResolvedWeather>(weather);
  const messageRef = useRef<string>(message);
  const presetRef = useRef<CameraPreset>(cameraPreset);
  const cameraViewRef = useRef<CameraViewState | null>(cameraView);
  const isOpenRef = useRef<boolean>(isWindowOpen);
  const transitionActiveRef = useRef<boolean>(false);

  const sceneApiRef = useRef<{
    applyMood: (m: DayMood) => void;
    applyWeather: (w: ResolvedWeather) => void;
    setMessage: (msg: string) => void;
    scatter: () => void;
    triggerPreset: (p: CameraPreset) => void;
    applyCameraView: (view: CameraViewState) => void;
    getCameraView: () => CameraViewState;
  } | null>(null);

  useEffect(() => {
    moodRef.current = mood;
    sceneApiRef.current?.applyMood(mood);
  }, [mood]);

  useEffect(() => {
    weatherRef.current = weather;
    sceneApiRef.current?.applyWeather(weather);
  }, [weather]);

  useEffect(() => {
    messageRef.current = message;
    sceneApiRef.current?.setMessage(message);
  }, [message]);

  useEffect(() => {
    presetRef.current = cameraPreset;
    cameraViewRef.current = cameraView;
    if (cameraView) {
      sceneApiRef.current?.applyCameraView(cameraView);
    } else {
      sceneApiRef.current?.triggerPreset(cameraPreset);
    }
  }, [cameraPreset, cameraView]);

  useEffect(() => {
    isOpenRef.current = isWindowOpen;
  }, [isWindowOpen]);

  useEffect(() => {
    if (scatterNonce > 0) {
      sceneApiRef.current?.scatter();
    }
  }, [scatterNonce]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const isMobileViewport = window.innerWidth < 768;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: isMobileViewport ? 'default' : 'high-performance',
        failIfMajorPerformanceCaveat: false,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio || 1, isMobileViewport ? 1.75 : 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;
    renderer.setSize(initW, initH);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    const onContextRestored = () => {
      sceneApiRef.current?.applyMood(moodRef.current);
      sceneApiRef.current?.applyWeather(weatherRef.current);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const initialTheme = MOOD_THEMES[moodRef.current];
    scene.fog = new THREE.Fog(initialTheme.fogColor, 58, 150);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.45;
    pmremGenerator.dispose();

    const initAspect = initW / Math.max(1, initH);
    const camera = new THREE.PerspectiveCamera(42, initAspect, 0.2, 260);

    const computePresetPos = (preset: CameraPreset, aspect: number, out: THREE.Vector3) => {
      const cfg = CAMERA_PRESETS[preset];
      // Compensate distance on portrait phone screens so the full sheep text fits width-wise
      const scale = aspect < 1.0 ? Math.min(1.95, 1.08 / Math.max(0.45, aspect)) : 1.0;
      out.set(cfg.pos[0] * scale, cfg.pos[1] * scale, cfg.pos[2] * scale);
    };

    const initialSavedView = cameraViewRef.current;
    const startTarget: [number, number, number] = initialSavedView
      ? initialSavedView.target
      : CAMERA_PRESETS[presetRef.current].target;
    if (initialSavedView) {
      camera.position.set(...initialSavedView.pos);
    } else {
      computePresetPos(presetRef.current, initAspect, camera.position);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...startTarget);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 10;
    controls.maxDistance = 56;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.enablePan = true;
    controls.panSpeed = 0.7;

    const desiredCamPos = new THREE.Vector3().copy(camera.position);
    const desiredTarget = new THREE.Vector3(...startTarget);

    controls.addEventListener('start', () => {
      transitionActiveRef.current = false;
    });

    const hemiLight = new THREE.HemisphereLight(
      initialTheme.hemiSky,
      initialTheme.hemiGround,
      initialTheme.hemiIntensity
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(initialTheme.sunColor, initialTheme.sunIntensity);
    keyLight.position.set(...initialTheme.sunPosition);
    keyLight.castShadow = !isSoftwareGl;
    const shadowSize = isMobileViewport ? 1024 : 2048;
    keyLight.shadow.mapSize.width = shadowSize;
    keyLight.shadow.mapSize.height = shadowSize;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 90;
    const d = 22;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.025;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(initialTheme.rimColor, initialTheme.rimIntensity);
    rimLight.position.set(-14, 10, -24);
    scene.add(rimLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const environment = createMeadowEnvironment(initialTheme, weatherRef.current, maxAnisotropy);
    scene.add(environment.group);

    const flock = createSheepFlock();
    flock.setMood(moodRef.current);
    flock.setMessage(messageRef.current);
    scene.add(flock.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const tgtFogColor = new THREE.Color(initialTheme.fogColor);
    const tgtSunColor = new THREE.Color(initialTheme.sunColor);
    const tgtHemiSky = new THREE.Color(initialTheme.hemiSky);
    const tgtHemiGround = new THREE.Color(initialTheme.hemiGround);
    const tgtRimColor = new THREE.Color(initialTheme.rimColor);
    const tgtKeyPos = new THREE.Vector3(...initialTheme.sunPosition);
    let tgtFogDensity = initialTheme.fogDensity;
    let tgtSunIntensity = initialTheme.sunIntensity;
    let tgtHemiIntensity = initialTheme.hemiIntensity;
    let tgtRimIntensity = initialTheme.rimIntensity;

    sceneApiRef.current = {
      applyMood: (m: DayMood) => {
        const theme = MOOD_THEMES[m];
        environment.setTargetTheme(theme);
        flock.setMood(m);
        tgtFogColor.set(theme.fogColor);
        tgtFogDensity = theme.fogDensity;
        tgtSunColor.set(theme.sunColor);
        tgtSunIntensity = theme.sunIntensity;
        tgtKeyPos.set(...theme.sunPosition);
        tgtHemiSky.set(theme.hemiSky);
        tgtHemiGround.set(theme.hemiGround);
        tgtHemiIntensity = theme.hemiIntensity;
        tgtRimColor.set(theme.rimColor);
        tgtRimIntensity = theme.rimIntensity;
      },
      applyWeather: (w: ResolvedWeather) => {
        environment.setWeather(w);
      },
      setMessage: (msg: string) => {
        flock.setMessage(msg);
      },
      scatter: () => {
        flock.scatterAndRegather();
        environment.spawnSparkleBurst(0, 0.8, 0, 28);
      },
      triggerPreset: (p: CameraPreset) => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        computePresetPos(p, w / Math.max(1, h), desiredCamPos);
        desiredTarget.set(...CAMERA_PRESETS[p].target);
        transitionActiveRef.current = true;
      },
      applyCameraView: (view: CameraViewState) => {
        desiredCamPos.set(...view.pos);
        desiredTarget.set(...view.target);
        transitionActiveRef.current = true;
      },
      getCameraView: (): CameraViewState => ({
        pos: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
      }),
    };
    onRegisterCameraGetter?.(() => sceneApiRef.current!.getCameraView());

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15);
    const pointerWorld = new THREE.Vector3(0, -100, 0);
    const hitPoint = new THREE.Vector3();
    let pointerForce = 0;
    let pointerDownPos: { x: number; y: number } | null = null;
    let lastTrailTime = 0;
    const activePointers = new Set<number>();
    let multiTouchGesture = false;

    const projectPointer = (clientX: number, clientY: number): boolean => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      return raycaster.ray.intersectPlane(groundPlane, hitPoint) !== null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isOpenRef.current || !e.isPrimary || multiTouchGesture) return;
      if (projectPointer(e.clientX, e.clientY)) {
        pointerWorld.copy(hitPoint);
        pointerForce = 1.0;

        const now = performance.now();
        if (now - lastTrailTime > 140) {
          lastTrailTime = now;
          const gy = groundHeightAt(hitPoint.x, hitPoint.z);
          environment.spawnSparkleBurst(hitPoint.x, gy + 0.25, hitPoint.z, 1);
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      activePointers.add(e.pointerId);
      if (activePointers.size > 1) {
        multiTouchGesture = true;
        pointerDownPos = null;
        return;
      }
      meadowAudio.unlockOnGesture();
      if (!e.isPrimary) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      if (!isOpenRef.current) return;
      if (projectPointer(e.clientX, e.clientY)) {
        pointerWorld.copy(hitPoint);
        pointerForce = 1.3;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0 && multiTouchGesture) {
        multiTouchGesture = false;
        pointerDownPos = null;
        return;
      }
      if (!isOpenRef.current || !pointerDownPos || !e.isPrimary || multiTouchGesture) return;
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      pointerDownPos = null;
      if (moved < 10 && projectPointer(e.clientX, e.clientY)) {
        const gy = groundHeightAt(hitPoint.x, hitPoint.z);
        environment.spawnSparkleBurst(hitPoint.x, gy + 0.3, hitPoint.z, 6);
        const pokedSheep = flock.pokeNear(hitPoint.x, hitPoint.z, 2.5);
        if (pokedSheep) {
          meadowAudio.playSheepBaa();
        } else {
          meadowAudio.playSparkleChime();
        }
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) {
        multiTouchGesture = false;
      }
      pointerDownPos = null;
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);

    const handleContainerResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const aspect = w / Math.max(1, h);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleContainerResize);
    resizeObserver.observe(container);

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;
      elapsed += dt;

      pointerForce = Math.max(0, pointerForce - dt * 1.4);

      const lightAlpha = 1 - Math.exp(-3.2 * dt);
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.lerp(tgtFogColor, lightAlpha);
        const camDist = camera.position.distanceTo(controls.target);
        const densityFactor = THREE.MathUtils.clamp(tgtFogDensity * 80, 0.65, 1.25);
        const weatherPull =
          weatherRef.current === 'mist' ? -6 : weatherRef.current === 'rain' ? -4 : 0;
        const targetNear = camDist + Math.max(24, 34 / densityFactor + weatherPull);
        const targetFar = targetNear + Math.max(66, 90 / densityFactor + weatherPull);
        scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, targetNear, lightAlpha);
        scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, targetFar, lightAlpha);
      }
      keyLight.color.lerp(tgtSunColor, lightAlpha);
      keyLight.intensity = THREE.MathUtils.lerp(keyLight.intensity, tgtSunIntensity, lightAlpha);
      keyLight.position.lerp(tgtKeyPos, lightAlpha);
      hemiLight.color.lerp(tgtHemiSky, lightAlpha);
      hemiLight.groundColor.lerp(tgtHemiGround, lightAlpha);
      hemiLight.intensity = THREE.MathUtils.lerp(hemiLight.intensity, tgtHemiIntensity, lightAlpha);
      rimLight.color.lerp(tgtRimColor, lightAlpha);
      rimLight.intensity = THREE.MathUtils.lerp(rimLight.intensity, tgtRimIntensity, lightAlpha);

      if (transitionActiveRef.current) {
        const camAlpha = 1 - Math.exp(-4.5 * dt);
        camera.position.lerp(desiredCamPos, camAlpha);
        controls.target.lerp(desiredTarget, camAlpha);
        if (
          camera.position.distanceTo(desiredCamPos) < 0.05 &&
          controls.target.distanceTo(desiredTarget) < 0.05
        ) {
          transitionActiveRef.current = false;
        }
      }

      controls.update();
      environment.update(elapsed, dt, pointerWorld, pointerForce);
      flock.update(elapsed, dt);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      onRegisterCameraGetter?.(null);
      controls.dispose();
      environment.dispose();
      flock.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglUnavailable) {
    return (
      <div
        className="w-full h-full flex items-center justify-center p-8 text-center"
        style={{ background: MOOD_THEMES[mood].swatchGradient }}
      >
        <div className="max-w-md rounded-2xl p-6 bg-[#fffaf4]/95 border border-[#d8cbb8] shadow-lg">
          <h2 className="font-display text-2xl text-[#2f2a24] mb-2">Meadowpost</h2>
          <p className="text-sm text-[#5c5349]">
            {message ? `"${message}"` : 'A cozy pastoral sheep meadow awaits your note.'}
          </p>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing select-none" />;
}
