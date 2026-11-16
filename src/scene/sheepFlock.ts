import * as THREE from 'three';
import type { DayMood } from '../types/capsule';
import { groundHeightAt } from './meadowEnvironment';
import { createSheepGeometryBundle } from './sheepGeometry';
import { generateSheepTargetsFromText } from './textToSheepTargets';

export const MAX_SHEEP = 380;
const IDLE_GRAZING_COUNT = 34;

interface SheepAgent {
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  homeX: number;
  homeZ: number;
  yaw: number;
  targetYaw: number;
  scale: number;
  targetScale: number;
  hopPhase: number;
  hopBoost: number;
  grazePhase: number;
  wanderTimer: number;
  frolicTimer: number;
  isFormationMember: boolean;
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _shadowPos = new THREE.Vector3();
const _shadowQuat = new THREE.Quaternion();
const _shadowScale = new THREE.Vector3();
const _shadowMat = new THREE.Matrix4();
const _color = new THREE.Color();

export interface SheepFlockHandle {
  group: THREE.Group;
  setMessage: (text: string) => void;
  setMood: (mood: DayMood) => void;
  scatterAndRegather: () => void;
  pokeNear: (worldX: number, worldZ: number, radius?: number) => boolean;
  update: (elapsed: number, dt: number) => void;
  dispose: () => void;
}

export function createSheepFlock(): SheepFlockHandle {
  const group = new THREE.Group();
  const bundle = createSheepGeometryBundle();

  const woolMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x3b312d,
    roughness: 0.72,
    metalness: 0.02,
  });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xfffef9,
    roughness: 0.22,
    metalness: 0.0,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x161211,
    roughness: 0.08,
    metalness: 0.14,
  });
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xf4a6a2,
    roughness: 0.85,
    metalness: 0.0,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    map: bundle.shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.36,
  });

  const woolMesh = new THREE.InstancedMesh(bundle.woolGeo, woolMat, MAX_SHEEP);
  const darkMesh = new THREE.InstancedMesh(bundle.darkGeo, darkMat, MAX_SHEEP);
  const eyeWhiteMesh = new THREE.InstancedMesh(bundle.eyeWhiteGeo, eyeWhiteMat, MAX_SHEEP);
  const pupilMesh = new THREE.InstancedMesh(bundle.pupilGeo, pupilMat, MAX_SHEEP);
  const blushMesh = new THREE.InstancedMesh(bundle.blushGeo, blushMat, MAX_SHEEP);
  const shadowMesh = new THREE.InstancedMesh(bundle.shadowGeo, shadowMat, MAX_SHEEP);

  const allMeshes = [woolMesh, darkMesh, eyeWhiteMesh, pupilMesh, blushMesh, shadowMesh];
  allMeshes.forEach((m) => {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
  });

  woolMesh.castShadow = true;
  woolMesh.receiveShadow = true;
  darkMesh.castShadow = true;

  const woolTints = ['#fffcf5', '#fbf5e9', '#fff8ee', '#f6efe4', '#fef7ec'];
  for (let i = 0; i < MAX_SHEEP; i++) {
    _color.set(woolTints[i % woolTints.length]);
    woolMesh.setColorAt(i, _color);
  }
  if (woolMesh.instanceColor) woolMesh.instanceColor.needsUpdate = true;

  const agents: SheepAgent[] = [];
  for (let i = 0; i < MAX_SHEEP; i++) {
    const angle = (i / MAX_SHEEP) * Math.PI * 2 + (i % 7) * 0.41;
    const isInitial = i < IDLE_GRAZING_COUNT;
    const radius = isInitial
      ? 2.5 + ((i * 1.73) % 10.5)
      : 19 + ((i * 2.17) % 10);
    const hx = Math.cos(angle) * radius * 1.15;
    const hz = Math.sin(angle) * radius * 0.65 - 0.5;
    const yaw = (Math.random() - 0.5) * Math.PI * 2;

    agents.push({
      x: hx,
      z: hz,
      targetX: hx,
      targetZ: hz,
      homeX: hx,
      homeZ: hz,
      yaw,
      targetYaw: yaw,
      scale: isInitial ? 0.78 + (i % 5) * 0.04 : 0.0001,
      targetScale: isInitial ? 0.78 + (i % 5) * 0.04 : 0.0001,
      hopPhase: Math.random() * Math.PI * 2,
      hopBoost: 0,
      grazePhase: Math.random() * 10,
      wanderTimer: Math.random() * 5,
      frolicTimer: 1.5 + Math.random() * 6,
      isFormationMember: false,
    });
  }

  let currentMessage = '';
  let currentMood: DayMood = 'sunny';

  const assignTargets = (text: string) => {
    const wasEmpty = currentMessage.length === 0;
    currentMessage = text.trim();
    if (!currentMessage) {
      for (let i = 0; i < MAX_SHEEP; i++) {
        const a = agents[i];
        a.isFormationMember = false;
        if (i < IDLE_GRAZING_COUNT) {
          const ang = (i / IDLE_GRAZING_COUNT) * Math.PI * 2;
          const r = 3.2 + (i % 6) * 1.65;
          a.targetX = Math.cos(ang) * r * 1.25;
          a.targetZ = Math.sin(ang) * r * 0.68;
          a.targetScale = 0.78 + (i % 4) * 0.045;
          a.targetYaw = (Math.random() - 0.5) * 2.2;
        } else {
          a.targetX = a.homeX;
          a.targetZ = a.homeZ;
          a.targetScale = 0.0001;
        }
      }
      return;
    }

    const { points, recommendedScale } = generateSheepTargetsFromText(
      currentMessage,
      MAX_SHEEP - 16
    );

    const needed = points.length;
    for (let i = 0; i < MAX_SHEEP; i++) {
      const a = agents[i];
      if (i < needed) {
        a.isFormationMember = true;
        a.targetX = points[i].x;
        a.targetZ = points[i].z;
        a.targetScale = recommendedScale * (0.94 + (i % 5) * 0.03);
        a.targetYaw = ((i % 7) - 3) * 0.11;
        if (wasEmpty) {
          a.hopBoost = Math.max(a.hopBoost, 0.25 + (i % 5) * 0.06);
        }
      } else if (i < needed + 16) {
        a.isFormationMember = false;
        const extraIdx = i - needed;
        const side = extraIdx % 2 === 0 ? -1 : 1;
        a.targetX = side * (11.5 + (extraIdx % 5) * 1.8);
        a.targetZ = -7.5 + (extraIdx % 4) * 2.4;
        a.targetScale = 0.76 + (extraIdx % 3) * 0.06;
        a.targetYaw = -side * 0.7 + (Math.random() - 0.5) * 0.6;
      } else {
        a.isFormationMember = false;
        a.targetX = a.homeX;
        a.targetZ = a.homeZ;
        a.targetScale = 0.0001;
      }
    }
  };

  const setMessage = (text: string) => {
    assignTargets(text);
  };

  const setMood = (mood: DayMood) => {
    currentMood = mood;
  };

  const scatterAndRegather = () => {
    for (let i = 0; i < MAX_SHEEP; i++) {
      const a = agents[i];
      if (a.targetScale > 0.05) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 3.5 + Math.random() * 5.0;
        a.x += Math.cos(ang) * dist;
        a.z += Math.sin(ang) * dist;
        a.hopBoost = 0.6 + Math.random() * 0.5;
      }
    }
  };

  const pokeNear = (worldX: number, worldZ: number, radius = 2.2): boolean => {
    let hitAny = false;
    for (let i = 0; i < MAX_SHEEP; i++) {
      const a = agents[i];
      if (a.scale < 0.1) continue;
      const d = Math.hypot(a.x - worldX, a.z - worldZ);
      if (d < radius) {
        a.hopBoost = Math.max(a.hopBoost, 1.0 - d / (radius * 1.4));
        hitAny = true;
      }
    }
    return hitAny;
  };

  const update = (elapsed: number, dt: number) => {
    const moveDamp = 1 - Math.exp(-3.4 * dt);
    const scaleDamp = 1 - Math.exp(-5.0 * dt);
    const rotDamp = 1 - Math.exp(-6.0 * dt);

    // Mood-driven personality multipliers
    const isSunny = currentMood === 'sunny';
    const isStarry = currentMood === 'starry';
    const isSunset = currentMood === 'sunset';
    const isMorning = currentMood === 'morning';

    const breathSpeed = isStarry ? 1.4 : isSunny ? 3.2 : 2.3;
    const frolicIntervalBase = isSunny ? 3.2 : isMorning ? 6.5 : isSunset ? 8.0 : 12.0;

    for (let i = 0; i < MAX_SHEEP; i++) {
      const a = agents[i];

      if (!a.isFormationMember && a.targetScale > 0.1) {
        a.wanderTimer -= dt;
        if (a.wanderTimer <= 0) {
          a.wanderTimer = 3.0 + Math.random() * 4.5;
          a.targetX += (Math.random() - 0.5) * 2.2;
          a.targetZ += (Math.random() - 0.5) * 1.8;
          a.targetX = THREE.MathUtils.clamp(a.targetX, -18, 18);
          a.targetZ = THREE.MathUtils.clamp(a.targetZ, -11, 8.5);
          a.targetYaw = Math.atan2(a.targetX - a.x, a.targetZ - a.z);
        }
      }

      // Spontaneous playful hops (livelier in Sunny/Morning, calmer at Starry night)
      if (a.targetScale > 0.1) {
        a.frolicTimer -= dt;
        if (a.frolicTimer <= 0) {
          a.frolicTimer = frolicIntervalBase + Math.random() * 6.0;
          if (!isStarry) {
            a.hopBoost = Math.max(a.hopBoost, isSunny ? 0.62 : 0.35);
          }
        }
      }

      const dx = a.targetX - a.x;
      const dz = a.targetZ - a.z;
      const dist = Math.hypot(dx, dz);

      a.x += dx * moveDamp;
      a.z += dz * moveDamp;
      a.scale = THREE.MathUtils.lerp(a.scale, a.targetScale, scaleDamp);

      if (a.hopBoost > 0) {
        a.hopBoost = Math.max(0, a.hopBoost - dt * 1.85);
      }

      if (dist > 0.45) {
        const moveYaw = Math.atan2(dx, dz);
        let diff = moveYaw - a.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        a.yaw += diff * rotDamp;
      } else {
        let diff = a.targetYaw - a.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        a.yaw += diff * rotDamp;
      }

      if (a.scale < 0.015) {
        _pos.set(0, -100, 0);
        _scale.setScalar(0.0001);
        _quat.identity();
        _mat.compose(_pos, _quat, _scale);
        woolMesh.setMatrixAt(i, _mat);
        darkMesh.setMatrixAt(i, _mat);
        eyeWhiteMesh.setMatrixAt(i, _mat);
        pupilMesh.setMatrixAt(i, _mat);
        blushMesh.setMatrixAt(i, _mat);
        shadowMesh.setMatrixAt(i, _mat);
        continue;
      }

      const groundY = groundHeightAt(a.x, a.z);

      const runFactor = THREE.MathUtils.clamp(dist * 0.8, 0, 1);
      const trotHop = Math.abs(Math.sin(elapsed * 9.5 + a.hopPhase)) * 0.22 * runFactor;
      const pokeHop = Math.sin(a.hopBoost * Math.PI) * 0.42;
      const totalHop = (trotHop + pokeHop) * a.scale;

      const waddleRoll = Math.sin(elapsed * 9.5 + a.hopPhase) * 0.12 * runFactor;

      // Daytime-aware idle expression:
      // - Morning/Sunny grazers dip down to nibble grass periodically
      // - Sunset sways cozily side-to-side
      // - Starry tilts slightly upward stargazing with gentle sleepy nod
      const grazeCycle = Math.max(0, Math.sin(elapsed * 0.65 + a.grazePhase) - 0.55) * 2.2;
      const grazeDip = !a.isFormationMember && !isStarry ? grazeCycle * 0.28 : 0;
      const starGazePitch = isStarry ? -0.14 + Math.sin(elapsed * 0.9 + a.hopPhase) * 0.05 : 0;
      const cozySway = isSunset
        ? Math.sin(elapsed * 1.6 + a.hopPhase) * 0.06
        : Math.sin(elapsed * 2.4 + a.hopPhase) * 0.025;

      const idlePitch =
        (starGazePitch + grazeDip + Math.sin(elapsed * 2.1 + a.hopPhase) * 0.04) *
        (1 - runFactor);

      const breathe = 1 + Math.sin(elapsed * breathSpeed + a.hopPhase) * 0.04;
      const jumpStretch = 1 + (trotHop + pokeHop) * 0.28;
      const sx = (a.scale / Math.sqrt(jumpStretch)) * (2 - breathe) * 0.5 + a.scale * 0.5;
      const sy = a.scale * jumpStretch * breathe;
      const sz = sx;

      _pos.set(a.x, groundY + totalHop, a.z);
      _euler.set(idlePitch, a.yaw, waddleRoll + cozySway * (1 - runFactor));
      _quat.setFromEuler(_euler);
      _scale.set(sx, sy, sz);
      _mat.compose(_pos, _quat, _scale);

      woolMesh.setMatrixAt(i, _mat);
      darkMesh.setMatrixAt(i, _mat);
      eyeWhiteMesh.setMatrixAt(i, _mat);
      pupilMesh.setMatrixAt(i, _mat);
      blushMesh.setMatrixAt(i, _mat);

      const shadowScale = a.scale * THREE.MathUtils.clamp(1.0 - totalHop * 0.45, 0.55, 1.0);
      _shadowPos.set(a.x, groundY, a.z);
      _shadowQuat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, a.yaw);
      _shadowScale.set(shadowScale, shadowScale, shadowScale);
      _shadowMat.compose(_shadowPos, _shadowQuat, _shadowScale);
      shadowMesh.setMatrixAt(i, _shadowMat);
    }

    allMeshes.forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
    });
  };

  const dispose = () => {
    bundle.woolGeo.dispose();
    bundle.darkGeo.dispose();
    bundle.eyeWhiteGeo.dispose();
    bundle.pupilGeo.dispose();
    bundle.blushGeo.dispose();
    bundle.shadowGeo.dispose();
    bundle.shadowTexture.dispose();
    woolMat.dispose();
    darkMat.dispose();
    eyeWhiteMat.dispose();
    pupilMat.dispose();
    blushMat.dispose();
    shadowMat.dispose();
  };

  return {
    group,
    setMessage,
    setMood,
    scatterAndRegather,
    pokeNear,
    update,
    dispose,
  };
}
