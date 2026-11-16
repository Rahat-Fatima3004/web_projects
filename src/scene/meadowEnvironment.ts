import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MoodTheme, ResolvedWeather } from '../types/capsule';

export function groundHeightAt(x: number, z: number): number {
  const nx = x / 15.2;
  const nz = (z - 0.3) / 7.8;
  const ellipseDist = Math.sqrt(nx * nx + nz * nz);
  const hillMask = THREE.MathUtils.smoothstep(ellipseDist, 0.85, 2.05);

  const microWave =
    Math.sin(x * 0.14 + 0.5) * Math.cos(z * 0.18 - 0.3) * 0.11;

  const rollingHills =
    Math.sin(x * 0.085 + 0.8) * 1.45 +
    Math.cos(z * 0.11 - 0.4) * 1.35 +
    Math.sin((x + z) * 0.065) * 1.2 +
    Math.max(0, (-z - 10) * 0.16);

  return microWave + hillMask * Math.max(-0.4, rollingHills + 1.15);
}

function createGrassGroundTexture(): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  if (actx && bctx) {
    actx.fillStyle = '#dce8c8';
    actx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 3200; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const r = 2 + Math.random() * 11;
      const shade = 205 + Math.floor((Math.random() - 0.5) * 44);
      actx.fillStyle = `rgba(${shade - 12}, ${shade + 8}, ${shade - 28}, 0.18)`;
      actx.beginPath();
      actx.arc(px, py, r, 0, Math.PI * 2);
      actx.fill();

      const bVal = 110 + Math.floor(Math.random() * 55);
      bctx.fillStyle = `rgba(${bVal}, ${bVal}, ${bVal}, 0.25)`;
      bctx.fillRect(px, py, 2, 5);
    }
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(14, 14);

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(14, 14);

  return { albedo, bump };
}

function createSoftGlowSpriteTexture(): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.28, 'rgba(255, 252, 240, 0.82)');
    grad.addColorStop(0.6, 'rgba(255, 248, 225, 0.22)');
    grad.addColorStop(1, 'rgba(255, 248, 225, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.28, size * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.045, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftMistTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.05,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
    grad.addColorStop(0.55, 'rgba(248, 252, 255, 0.18)');
    grad.addColorStop(1, 'rgba(248, 252, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface MeadowEnvironmentHandle {
  group: THREE.Group;
  update: (
    elapsed: number,
    dt: number,
    pointerWorld: THREE.Vector3,
    pointerForce: number
  ) => void;
  applyThemeInstant: (theme: MoodTheme) => void;
  setTargetTheme: (theme: MoodTheme) => void;
  setWeather: (weather: ResolvedWeather) => void;
  spawnSparkleBurst: (x: number, y: number, z: number, count?: number) => void;
  dispose: () => void;
}

export function createMeadowEnvironment(
  initialTheme: MoodTheme,
  initialWeather: ResolvedWeather,
  maxAnisotropy: number
): MeadowEnvironmentHandle {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const curZenith = new THREE.Color(initialTheme.skyZenith);
  const tgtZenith = new THREE.Color(initialTheme.skyZenith);
  const curMid = new THREE.Color(initialTheme.skyMid);
  const tgtMid = new THREE.Color(initialTheme.skyMid);
  const curHorizon = new THREE.Color(initialTheme.skyHorizon);
  const tgtHorizon = new THREE.Color(initialTheme.skyHorizon);
  const curSunDir = new THREE.Vector3(...initialTheme.sunPosition).normalize();
  const tgtSunDir = new THREE.Vector3(...initialTheme.sunPosition).normalize();

  const curGrassBase = new THREE.Color(initialTheme.grassBase);
  const tgtGrassBase = new THREE.Color(initialTheme.grassBase);
  const curGrassTip = new THREE.Color(initialTheme.grassTip);
  const tgtGrassTip = new THREE.Color(initialTheme.grassTip);

  const curTerrainLight = new THREE.Color(initialTheme.terrainLight);
  const tgtTerrainLight = new THREE.Color(initialTheme.terrainLight);
  const curTerrainDark = new THREE.Color(initialTheme.terrainDark);
  const tgtTerrainDark = new THREE.Color(initialTheme.terrainDark);

  const curMountain = new THREE.Color(initialTheme.mountainColor);
  const tgtMountain = new THREE.Color(initialTheme.mountainColor);
  const curCloudTint = new THREE.Color(initialTheme.cloudTint);
  const tgtCloudTint = new THREE.Color(initialTheme.cloudTint);

  let curCloudOpacity = initialTheme.cloudOpacity;
  let tgtCloudOpacity = initialTheme.cloudOpacity;
  let curStarOpacity = initialTheme.starOpacity;
  let tgtStarOpacity = initialTheme.starOpacity;
  let curCottageGlow = initialTheme.cottageGlow;
  let tgtCottageGlow = initialTheme.cottageGlow;
  let activeWeather: ResolvedWeather = initialWeather;

  // 1. Sky Dome Shader
  const skyGeo = new THREE.SphereGeometry(145, 36, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: curZenith },
      uMid: { value: curMid },
      uHorizon: { value: curHorizon },
      uSunDir: { value: curSunDir },
      uSunColor: { value: new THREE.Color(initialTheme.sunColor) },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDir;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      void main() {
        float h = clamp(vWorldDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uZenith, smoothstep(0.24, 0.85, h));
        float sunDot = max(dot(normalize(vWorldDir), normalize(uSunDir)), 0.0);
        float halo = pow(sunDot, 10.0) * 0.25 + pow(sunDot, 160.0) * 0.75;
        col += uSunColor * halo;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  root.add(skyMesh);
  disposables.push(skyGeo, skyMat);

  // 2. Twinkling Starfield
  const glowTex = createSoftGlowSpriteTexture();
  glowTex.anisotropy = maxAnisotropy;
  const mistTex = createSoftMistTexture();
  disposables.push(glowTex, mistTex);

  const starCount = 520;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < starCount; i++) {
    if (i === 0) {
      starPos[0] = 2;
      starPos[1] = 44;
      starPos[2] = -92;
      tmpColor.set('#bfe4ff');
    } else {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.12 + Math.random() * 0.88);
      const r = 126;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      tmpColor.setHSL(0.55 + Math.random() * 0.14, 0.45, 0.82 + Math.random() * 0.18);
    }
    starColors[i * 3] = tmpColor.r;
    starColors[i * 3 + 1] = tmpColor.g;
    starColors[i * 3 + 2] = tmpColor.b;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 2.3,
    map: glowTex,
    vertexColors: true,
    transparent: true,
    opacity: curStarOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  root.add(starPoints);
  disposables.push(starGeo, starMat);

  const northStarGeo = new THREE.BufferGeometry();
  northStarGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([2, 39, -95]), 3));
  const northStarMat = new THREE.PointsMaterial({
    size: 8.5,
    color: 0xbde4ff,
    map: glowTex,
    transparent: true,
    opacity: curStarOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const northStar = new THREE.Points(northStarGeo, northStarMat);
  root.add(northStar);
  disposables.push(northStarGeo, northStarMat);

  // 3. Fluffy Layered 2.5D Clouds
  const cloudMat = new THREE.MeshStandardMaterial({
    color: curCloudTint,
    roughness: 0.96,
    metalness: 0.0,
    transparent: true,
    opacity: curCloudOpacity,
    depthWrite: false,
  });
  disposables.push(cloudMat);

  const cloudPuffGeo = new THREE.IcosahedronGeometry(1.0, 2);
  disposables.push(cloudPuffGeo);
  const clouds: Array<{ group: THREE.Group; speed: number; baseY: number; phase: number }> = [];
  const cloudConfigs = [
    { x: -32, y: 19, z: -46, scale: 2.3, speed: 0.32 },
    { x: -10, y: 23, z: -56, scale: 2.9, speed: 0.24 },
    { x: 18, y: 17, z: -42, scale: 2.0, speed: 0.38 },
    { x: 36, y: 22, z: -54, scale: 2.7, speed: 0.28 },
    { x: -24, y: 26, z: -64, scale: 3.1, speed: 0.21 },
    { x: 6, y: 20, z: -48, scale: 1.8, speed: 0.35 },
  ];

  cloudConfigs.forEach((cfg, idx) => {
    const cg = new THREE.Group();
    const offsets = [
      [0, 0, 0, 1.4, 0.78, 1.0],
      [-1.15, -0.18, 0.1, 1.05, 0.68, 0.85],
      [1.2, -0.15, -0.05, 1.1, 0.7, 0.88],
      [-0.45, 0.38, 0.08, 0.95, 0.72, 0.8],
      [0.55, 0.32, -0.08, 0.88, 0.65, 0.78],
    ];
    offsets.forEach(([ox, oy, oz, sx, sy, sz]) => {
      const puff = new THREE.Mesh(cloudPuffGeo, cloudMat);
      puff.position.set(ox, oy, oz);
      puff.scale.set(sx, sy, sz);
      cg.add(puff);
    });
    cg.position.set(cfg.x, cfg.y, cfg.z);
    cg.scale.setScalar(cfg.scale);
    root.add(cg);
    clouds.push({ group: cg, speed: cfg.speed, baseY: cfg.y, phase: idx * 1.3 });
  });

  // 4. Rolling Meadow Terrain
  const { albedo: grassAlbedo, bump: grassBump } = createGrassGroundTexture();
  grassAlbedo.anisotropy = maxAnisotropy;
  grassBump.anisotropy = maxAnisotropy;
  disposables.push(grassAlbedo, grassBump);

  const terrainGeo = new THREE.PlaneGeometry(168, 168, 128, 128);
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position;
  const tHeightNorm = new Float32Array(tPos.count);
  const tColors = new Float32Array(tPos.count * 3);

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    const h = groundHeightAt(x, z);
    tPos.setY(i, h);
    tHeightNorm[i] = THREE.MathUtils.clamp((h + 0.3) / 4.2, 0, 1);
  }
  terrainGeo.computeVertexNormals();
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));

  const terrainMat = new THREE.MeshStandardMaterial({
    map: grassAlbedo,
    bumpMap: grassBump,
    bumpScale: 0.08,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);
  disposables.push(terrainGeo, terrainMat);

  const updateTerrainVertexColors = () => {
    const cAttr = terrainGeo.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < tPos.count; i++) {
      const f = tHeightNorm[i];
      tmpColor.copy(curTerrainDark).lerp(curTerrainLight, f);
      cAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }
    cAttr.needsUpdate = true;
  };
  updateTerrainVertexColors();

  // 5. Distant Mountain Silhouette Ring
  const mtnSegments = 96;
  const mtnPositions: number[] = [];
  const mtnIndices: number[] = [];
  const mtnRadius = 74;
  for (let i = 0; i <= mtnSegments; i++) {
    const a = (i / mtnSegments) * Math.PI * 2;
    const mx = Math.cos(a) * mtnRadius;
    const mz = Math.sin(a) * mtnRadius;
    const peak =
      5.5 +
      Math.sin(a * 5 + 0.7) * 3.1 +
      Math.cos(a * 9 - 0.3) * 1.9 +
      Math.sin(a * 14) * 0.9;
    mtnPositions.push(mx, -2, mz);
    mtnPositions.push(mx, peak, mz);
  }
  for (let i = 0; i < mtnSegments; i++) {
    const b0 = i * 2;
    const t0 = i * 2 + 1;
    const b1 = (i + 1) * 2;
    const t1 = (i + 1) * 2 + 1;
    mtnIndices.push(b0, b1, t0, t0, b1, t1);
  }
  const mountainGeo = new THREE.BufferGeometry();
  mountainGeo.setAttribute('position', new THREE.Float32BufferAttribute(mtnPositions, 3));
  mountainGeo.setIndex(mtnIndices);
  mountainGeo.computeVertexNormals();
  const mountainMat = new THREE.MeshStandardMaterial({
    color: curMountain,
    roughness: 0.98,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const mountainMesh = new THREE.Mesh(mountainGeo, mountainMat);
  root.add(mountainMesh);
  disposables.push(mountainGeo, mountainMat);

  // 6. Composite 3–12 Part Prop A: Lone Pastoral Oak Tree
  const treeGroup = new THREE.Group();
  const tx = -16.2;
  const tz = -13.8;
  const ty = groundHeightAt(tx, tz);
  treeGroup.position.set(tx, ty, tz);

  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5f4636, roughness: 0.9 });
  const leafMatA = new THREE.MeshStandardMaterial({ color: 0x5c8f3b, roughness: 0.88 });
  const leafMatB = new THREE.MeshStandardMaterial({ color: 0x73a64b, roughness: 0.86 });
  disposables.push(barkMat, leafMatA, leafMatB);

  const trunkBaseGeo = new THREE.CylinderGeometry(0.36, 0.62, 1.4, 12);
  const trunkMidGeo = new THREE.CylinderGeometry(0.24, 0.36, 2.2, 12);
  const branchGeo = new THREE.CylinderGeometry(0.11, 0.2, 1.7, 10);
  const canopyGeo = new THREE.IcosahedronGeometry(1.0, 2);
  disposables.push(trunkBaseGeo, trunkMidGeo, branchGeo, canopyGeo);

  const trunkBase = new THREE.Mesh(trunkBaseGeo, barkMat);
  trunkBase.position.y = 0.65;
  trunkBase.castShadow = true;
  treeGroup.add(trunkBase);

  const trunkMid = new THREE.Mesh(trunkMidGeo, barkMat);
  trunkMid.position.set(0.08, 2.15, 0);
  trunkMid.rotation.z = -0.06;
  trunkMid.castShadow = true;
  treeGroup.add(trunkMid);

  const branchL = new THREE.Mesh(branchGeo, barkMat);
  branchL.position.set(-0.55, 2.95, 0.15);
  branchL.rotation.z = 0.62;
  branchL.castShadow = true;
  treeGroup.add(branchL);

  const branchR = new THREE.Mesh(branchGeo, barkMat);
  branchR.position.set(0.62, 2.85, -0.18);
  branchR.rotation.z = -0.58;
  branchR.castShadow = true;
  treeGroup.add(branchR);

  const canopyClusters: Array<[number, number, number, number, boolean]> = [
    [0.0, 3.85, 0.0, 1.65, true],
    [-1.15, 3.45, 0.35, 1.28, false],
    [1.18, 3.38, -0.25, 1.32, true],
    [-0.45, 4.35, -0.65, 1.18, false],
    [0.55, 4.25, 0.65, 1.15, false],
    [0.05, 4.65, 0.05, 1.1, true],
  ];
  canopyClusters.forEach(([cx, cy, cz, sc, useA]) => {
    const puff = new THREE.Mesh(canopyGeo, useA ? leafMatA : leafMatB);
    puff.position.set(cx, cy, cz);
    puff.scale.set(sc * 1.12, sc * 0.88, sc * 1.08);
    puff.castShadow = true;
    puff.receiveShadow = true;
    treeGroup.add(puff);
  });
  root.add(treeGroup);

  // 7. Composite 3–12 Part Prop B: Storybook Meadow Cottage & Fence
  const cottageGroup = new THREE.Group();
  const cx = 17.5;
  const cz = -13.6;
  const cy = groundHeightAt(cx, cz);
  cottageGroup.position.set(cx, cy, cz);
  cottageGroup.rotation.y = -0.45;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf6ebd8, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc97b63, roughness: 0.75 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7b563e, roughness: 0.85 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8882, roughness: 0.92 });
  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffdf9a,
    emissive: 0xffb35c,
    emissiveIntensity: curCottageGlow,
    roughness: 0.25,
  });
  disposables.push(wallMat, roofMat, woodMat, stoneMat, windowGlowMat);

  const plinthGeo = new THREE.BoxGeometry(3.5, 0.45, 2.8);
  const plinth = new THREE.Mesh(plinthGeo, stoneMat);
  plinth.position.y = 0.22;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  cottageGroup.add(plinth);

  const wallsGeo = new THREE.BoxGeometry(3.2, 2.0, 2.5);
  const walls = new THREE.Mesh(wallsGeo, wallMat);
  walls.position.y = 1.4;
  walls.castShadow = true;
  walls.receiveShadow = true;
  cottageGroup.add(walls);

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-2.0, 0);
  roofShape.lineTo(0, 1.65);
  roofShape.lineTo(2.0, 0);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: 2.9,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  roofGeo.translate(0, 0, -1.45);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 2.35;
  roof.castShadow = true;
  cottageGroup.add(roof);

  const chimneyGeo = new THREE.BoxGeometry(0.45, 1.15, 0.45);
  const chimney = new THREE.Mesh(chimneyGeo, stoneMat);
  chimney.position.set(0.95, 3.45, -0.45);
  chimney.castShadow = true;
  cottageGroup.add(chimney);

  const doorGeo = new THREE.BoxGeometry(0.66, 1.15, 0.12);
  const door = new THREE.Mesh(doorGeo, woodMat);
  door.position.set(-0.62, 1.0, 1.25);
  cottageGroup.add(door);

  const winFrameGeo = new THREE.BoxGeometry(0.86, 0.78, 0.1);
  const winFrame = new THREE.Mesh(winFrameGeo, woodMat);
  winFrame.position.set(0.62, 1.42, 1.25);
  cottageGroup.add(winFrame);

  const winPaneGeo = new THREE.BoxGeometry(0.68, 0.6, 0.12);
  const winPane = new THREE.Mesh(winPaneGeo, windowGlowMat);
  winPane.position.set(0.62, 1.42, 1.26);
  cottageGroup.add(winPane);

  const postGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.95, 8);
  const railGeo = new THREE.BoxGeometry(2.2, 0.08, 0.06);
  const fenceGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const fx = 12.2 + i * 2.05;
    const fz = -9.6 - Math.sin(i * 0.45) * 1.2;
    const fy = groundHeightAt(fx, fz);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(fx, fy + 0.44, fz);
    post.rotation.z = (Math.random() - 0.5) * 0.08;
    post.castShadow = true;
    fenceGroup.add(post);

    if (i < 5) {
      const nx = 12.2 + (i + 1) * 2.05;
      const nz = -9.6 - Math.sin((i + 1) * 0.45) * 1.2;
      const ny = groundHeightAt(nx, nz);
      const midX = (fx + nx) * 0.5;
      const midY = (fy + ny) * 0.5;
      const midZ = (fz + nz) * 0.5;
      const angle = Math.atan2(nz - fz, nx - fx);
      [0.36, 0.68].forEach((ry) => {
        const rail = new THREE.Mesh(railGeo, woodMat);
        rail.position.set(midX, midY + ry, midZ);
        rail.rotation.y = -angle;
        rail.castShadow = true;
        fenceGroup.add(rail);
      });
    }
  }
  root.add(cottageGroup);
  root.add(fenceGroup);
  disposables.push(
    plinthGeo,
    wallsGeo,
    roofGeo,
    chimneyGeo,
    doorGeo,
    winFrameGeo,
    winPaneGeo,
    postGeo,
    railGeo
  );

  // 8. Swaying Instanced Grass Blades with Touch-Wind & Weather Wind Strength
  const bladeCount = 3400;
  const bladeGeo = new THREE.PlaneGeometry(0.085, 0.62, 1, 3);
  bladeGeo.translate(0, 0.31, 0);
  const bPos = bladeGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const yNorm = bPos.getY(i) / 0.62;
    bPos.setX(i, bPos.getX(i) * (1.0 - yNorm * 0.82));
    bPos.setZ(i, yNorm * yNorm * 0.1);
  }
  bladeGeo.computeVertexNormals();

  const windUniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: 1.0 },
    uPointerPos: { value: new THREE.Vector3(0, -100, 0) },
    uPointerForce: { value: 0 },
    uGrassBase: { value: curGrassBase },
    uGrassTip: { value: curGrassTip },
  };

  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.uniforms.uPointerPos = windUniforms.uPointerPos;
    shader.uniforms.uPointerForce = windUniforms.uPointerForce;
    shader.uniforms.uGrassBase = windUniforms.uGrassBase;
    shader.uniforms.uGrassTip = windUniforms.uGrassTip;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindStrength;
        uniform vec3 uPointerPos;
        uniform float uPointerForce;
        varying float vBladeH;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float hFrac = clamp(position.y / 0.62, 0.0, 1.0);
        vBladeH = hFrac;
        vec4 instWorld = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = (sin(uTime * 2.1 + instWorld.x * 0.35 + instWorld.z * 0.28) * 0.14
                   + sin(uTime * 3.7 + instWorld.x * 0.9) * 0.04) * uWindStrength;
        transformed.x += sway * hFrac * hFrac;
        transformed.z += sway * 0.45 * hFrac * hFrac;

        vec2 toBlade = instWorld.xz - uPointerPos.xz;
        float dist = length(toBlade);
        float push = smoothstep(3.4, 0.0, dist) * uPointerForce * hFrac * hFrac;
        if (dist > 0.001) {
          vec2 dir = toBlade / dist;
          transformed.xz += dir * push * 0.95;
          transformed.y -= push * 0.18;
        }`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uGrassBase;
        uniform vec3 uGrassTip;
        varying float vBladeH;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 bladeTint = mix(uGrassBase, uGrassTip, vBladeH);
        diffuseColor.rgb *= bladeTint;`
      );
  };

  const grassInstanced = new THREE.InstancedMesh(bladeGeo, grassMat, bladeCount);
  grassInstanced.frustumCulled = false;
  const dummy = new THREE.Object3D();

  for (let i = 0; i < bladeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 2.0 + Math.pow(Math.random(), 0.72) * 34;
    const gx = Math.cos(angle) * radius * 1.15;
    const gz = Math.sin(angle) * radius * 0.85 - 2.0;
    const gy = groundHeightAt(gx, gz);

    const inTextZone = Math.abs(gx) < 14 && Math.abs(gz) < 6.5;
    const hScale = inTextZone
      ? 0.42 + Math.random() * 0.32
      : 0.75 + Math.random() * 0.85;

    dummy.position.set(gx, gy - 0.03, gz);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.scale.set(0.85 + Math.random() * 0.4, hScale, 1);
    dummy.updateMatrix();
    grassInstanced.setMatrixAt(i, dummy.matrix);

    const shade = 0.85 + Math.random() * 0.3;
    tmpColor.setRGB(shade, shade, shade);
    grassInstanced.setColorAt(i, tmpColor);
  }
  grassInstanced.instanceMatrix.needsUpdate = true;
  if (grassInstanced.instanceColor) grassInstanced.instanceColor.needsUpdate = true;
  root.add(grassInstanced);
  disposables.push(bladeGeo, grassMat);

  // 9. Instanced Little Wildflowers
  const flowerCount = 460;
  const petalParts: THREE.BufferGeometry[] = [];
  const petalGeoBase = new THREE.SphereGeometry(0.068, 8, 6);
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    const g = petalGeoBase.clone();
    g.scale(1.0, 0.48, 0.72);
    g.translate(Math.cos(a) * 0.065, 0.24, Math.sin(a) * 0.065);
    petalParts.push(g);
  }
  const centerGeo = petalGeoBase.clone();
  centerGeo.scale(0.82, 0.65, 0.82);
  centerGeo.translate(0, 0.255, 0);
  petalParts.push(centerGeo);
  petalGeoBase.dispose();

  const flowerGeo = mergeGeometries(petalParts, false);
  petalParts.forEach((p) => p.dispose());

  const flowerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.75,
    metalness: 0.0,
  });
  flowerMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindStrength;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 instW = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uTime * 1.9 + instW.x * 0.4 + instW.z * 0.3) * 0.065 * uWindStrength;
        transformed.x += sway * (position.y / 0.26);`
      );
  };

  const flowerInstanced = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  flowerInstanced.frustumCulled = false;
  const flowerSeeds: number[] = [];

  for (let i = 0; i < flowerCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 5.5 + Math.pow(Math.random(), 0.75) * 29;
    const fx = Math.cos(angle) * dist * 1.2;
    const fz = Math.sin(angle) * dist * 0.8 - 1.5;
    const fy = groundHeightAt(fx, fz);

    dummy.position.set(fx, fy - 0.02, fz);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    const fScale = 0.75 + Math.random() * 0.75;
    dummy.scale.setScalar(fScale);
    dummy.updateMatrix();
    flowerInstanced.setMatrixAt(i, dummy.matrix);
    flowerSeeds.push(i % 4);
  }
  flowerInstanced.instanceMatrix.needsUpdate = true;
  root.add(flowerInstanced);
  disposables.push(flowerGeo, flowerMat);

  const applyFlowerPalette = (theme: MoodTheme) => {
    for (let i = 0; i < flowerCount; i++) {
      const hex = theme.flowerColors[flowerSeeds[i] % theme.flowerColors.length];
      tmpColor.set(hex);
      flowerInstanced.setColorAt(i, tmpColor);
    }
    if (flowerInstanced.instanceColor) flowerInstanced.instanceColor.needsUpdate = true;
  };
  applyFlowerPalette(initialTheme);

  // 10. 3D WEATHER EFFECTS SYSTEMS
  // A) Light Rain Streaks (`LineSegments`)
  const rainCount = 460;
  const rainPos = new Float32Array(rainCount * 6);
  const rainSpeeds = new Float32Array(rainCount);
  const rainOrigins = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    const rx = (Math.random() - 0.5) * 46;
    const ry = Math.random() * 24;
    const rz = (Math.random() - 0.5) * 34 - 2;
    rainOrigins[i * 3] = rx;
    rainOrigins[i * 3 + 1] = ry;
    rainOrigins[i * 3 + 2] = rz;
    rainSpeeds[i] = 16 + Math.random() * 8;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0xd8ecff,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  root.add(rainLines);
  disposables.push(rainGeo, rainMat);

  // B) Swirling Blossom Petals (`InstancedMesh`)
  const petalDropCount = 55;
  const singlePetalGeo = new THREE.CircleGeometry(0.14, 7);
  singlePetalGeo.scale(1.25, 0.72, 1);
  const singlePetalMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const petalDrops = new THREE.InstancedMesh(singlePetalGeo, singlePetalMat, petalDropCount);
  petalDrops.frustumCulled = false;
  const petalData: Array<{
    x: number;
    y: number;
    z: number;
    vy: number;
    phase: number;
    spin: number;
  }> = [];
  const petalPalette = ['#ffd7e4', '#fff7d6', '#ffe4d1', '#ffffff', '#f8d8ff'];
  for (let i = 0; i < petalDropCount; i++) {
    petalData.push({
      x: (Math.random() - 0.5) * 42,
      y: 0.5 + Math.random() * 14,
      z: (Math.random() - 0.5) * 30 - 1,
      vy: 0.8 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.5,
    });
    tmpColor.set(petalPalette[i % petalPalette.length]);
    petalDrops.setColorAt(i, tmpColor);
  }
  if (petalDrops.instanceColor) petalDrops.instanceColor.needsUpdate = true;
  root.add(petalDrops);
  disposables.push(singlePetalGeo, singlePetalMat);

  // C) Soft Snowfall (`Points`)
  const snowCount = 140;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(snowCount * 3);
  const snowPhase = new Float32Array(snowCount);
  for (let i = 0; i < snowCount; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 44;
    snowPos[i * 3 + 1] = Math.random() * 18;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 32 - 2;
    snowPhase[i] = Math.random() * Math.PI * 2;
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snowMat = new THREE.PointsMaterial({
    size: 0.42,
    color: 0xffffff,
    map: mistTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const snowPoints = new THREE.Points(snowGeo, snowMat);
  snowPoints.frustumCulled = false;
  root.add(snowPoints);
  disposables.push(snowGeo, snowMat);

  // D) Drifting Morning Mist Wisps (`Points`)
  const mistCount = 14;
  const mistGeo = new THREE.BufferGeometry();
  const mistPos = new Float32Array(mistCount * 3);
  const mistBase = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    const mx = (Math.random() - 0.5) * 44;
    const mz = (Math.random() - 0.5) * 28 - 4;
    const my = groundHeightAt(mx, mz) + 0.9 + Math.random() * 1.8;
    mistPos[i * 3] = mx;
    mistPos[i * 3 + 1] = my;
    mistPos[i * 3 + 2] = mz;
    mistBase[i * 3] = mx;
    mistBase[i * 3 + 1] = my;
    mistBase[i * 3 + 2] = mz;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  const mistMat = new THREE.PointsMaterial({
    size: 7.5,
    color: 0xf7fbf9,
    map: mistTex,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const mistPoints = new THREE.Points(mistGeo, mistMat);
  mistPoints.frustumCulled = false;
  root.add(mistPoints);
  disposables.push(mistGeo, mistMat);

  // E) Glowing Night Fireflies (`Points`)
  const fireflyCount = 42;
  const fireflyGeo = new THREE.BufferGeometry();
  const fireflyPos = new Float32Array(fireflyCount * 3);
  const fireflyBase = new Float32Array(fireflyCount * 3);
  const fireflyCol = new Float32Array(fireflyCount * 3);
  for (let i = 0; i < fireflyCount; i++) {
    const fx = (Math.random() - 0.5) * 34;
    const fz = (Math.random() - 0.5) * 24 - 1;
    const fy = groundHeightAt(fx, fz) + 0.5 + Math.random() * 2.8;
    fireflyPos[i * 3] = fx;
    fireflyPos[i * 3 + 1] = fy;
    fireflyPos[i * 3 + 2] = fz;
    fireflyBase[i * 3] = fx;
    fireflyBase[i * 3 + 1] = fy;
    fireflyBase[i * 3 + 2] = fz;
    tmpColor.set(i % 2 === 0 ? '#ffeaa7' : '#b8ffcf');
    fireflyCol[i * 3] = tmpColor.r;
    fireflyCol[i * 3 + 1] = tmpColor.g;
    fireflyCol[i * 3 + 2] = tmpColor.b;
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
  fireflyGeo.setAttribute('color', new THREE.BufferAttribute(fireflyCol, 3));
  const fireflyMat = new THREE.PointsMaterial({
    size: 0.65,
    map: glowTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
  fireflyPoints.frustumCulled = false;
  root.add(fireflyPoints);
  disposables.push(fireflyGeo, fireflyMat);

  // 11. Subtle Ambient Floating Sparkles & Touch-Reactive Burst Sparkles
  const ambientCount = 38;
  const ambGeo = new THREE.BufferGeometry();
  const ambPos = new Float32Array(ambientCount * 3);
  const ambCol = new Float32Array(ambientCount * 3);
  const ambPhase = new Float32Array(ambientCount);
  const ambBase = new Float32Array(ambientCount * 3);

  for (let i = 0; i < ambientCount; i++) {
    const sx = (Math.random() - 0.5) * 38;
    const sz = (Math.random() - 0.5) * 26 - 1;
    const sy = groundHeightAt(sx, sz) + 0.5 + Math.random() * 4.2;
    ambPos[i * 3] = sx;
    ambPos[i * 3 + 1] = sy;
    ambPos[i * 3 + 2] = sz;
    ambBase[i * 3] = sx;
    ambBase[i * 3 + 1] = sy;
    ambBase[i * 3 + 2] = sz;
    ambPhase[i] = Math.random() * Math.PI * 2;
  }
  ambGeo.setAttribute('position', new THREE.BufferAttribute(ambPos, 3));
  ambGeo.setAttribute('color', new THREE.BufferAttribute(ambCol, 3));

  const ambMat = new THREE.PointsMaterial({
    size: 0.34,
    map: glowTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ambPoints = new THREE.Points(ambGeo, ambMat);
  ambPoints.frustumCulled = false;
  root.add(ambPoints);
  disposables.push(ambGeo, ambMat);

  const burstCount = 72;
  const burstGeo = new THREE.BufferGeometry();
  const burstPos = new Float32Array(burstCount * 3);
  const burstCol = new Float32Array(burstCount * 3);
  const burstVel = new Float32Array(burstCount * 3);
  const burstLife = new Float32Array(burstCount);
  for (let i = 0; i < burstCount; i++) {
    burstPos[i * 3 + 1] = -200;
    burstLife[i] = 0;
  }
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  burstGeo.setAttribute('color', new THREE.BufferAttribute(burstCol, 3));

  const burstMat = new THREE.PointsMaterial({
    size: 0.62,
    map: glowTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const burstPoints = new THREE.Points(burstGeo, burstMat);
  burstPoints.frustumCulled = false;
  root.add(burstPoints);
  disposables.push(burstGeo, burstMat);

  let activeSparklePalette = initialTheme.sparkleColors;
  const applySparklePalette = (theme: MoodTheme) => {
    activeSparklePalette = theme.sparkleColors;
    for (let i = 0; i < ambientCount; i++) {
      tmpColor.set(theme.sparkleColors[i % theme.sparkleColors.length]);
      ambCol[i * 3] = tmpColor.r;
      ambCol[i * 3 + 1] = tmpColor.g;
      ambCol[i * 3 + 2] = tmpColor.b;
    }
    (ambGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  };
  applySparklePalette(initialTheme);

  const setWeather = (weather: ResolvedWeather) => {
    activeWeather = weather;
    rainLines.visible = weather === 'rain';
    petalDrops.visible = weather === 'petals';
    snowPoints.visible = weather === 'snow';
    mistPoints.visible = weather === 'mist';
    fireflyPoints.visible = weather === 'fireflies';
  };
  setWeather(initialWeather);

  let burstCursor = 0;
  const spawnSparkleBurst = (x: number, y: number, z: number, count = 12) => {
    for (let n = 0; n < count; n++) {
      const idx = burstCursor % burstCount;
      burstCursor++;
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.7 + Math.random() * 2.2;
      burstPos[idx * 3] = x + (Math.random() - 0.5) * 0.45;
      burstPos[idx * 3 + 1] = y + 0.15 + Math.random() * 0.4;
      burstPos[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.45;

      burstVel[idx * 3] = Math.cos(angle) * spd;
      burstVel[idx * 3 + 1] = 1.1 + Math.random() * 1.9;
      burstVel[idx * 3 + 2] = Math.sin(angle) * spd;
      burstLife[idx] = 0.75 + Math.random() * 0.55;

      tmpColor.set(activeSparklePalette[idx % activeSparklePalette.length]);
      burstCol[idx * 3] = tmpColor.r;
      burstCol[idx * 3 + 1] = tmpColor.g;
      burstCol[idx * 3 + 2] = tmpColor.b;
    }
    (burstGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (burstGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  };

  const setTargetTheme = (theme: MoodTheme) => {
    tgtZenith.set(theme.skyZenith);
    tgtMid.set(theme.skyMid);
    tgtHorizon.set(theme.skyHorizon);
    tgtSunDir.set(...theme.sunPosition).normalize();
    skyMat.uniforms.uSunColor.value.set(theme.sunColor);

    tgtGrassBase.set(theme.grassBase);
    tgtGrassTip.set(theme.grassTip);
    tgtTerrainLight.set(theme.terrainLight);
    tgtTerrainDark.set(theme.terrainDark);
    tgtMountain.set(theme.mountainColor);
    tgtCloudTint.set(theme.cloudTint);
    tgtCloudOpacity = theme.cloudOpacity;
    tgtStarOpacity = theme.starOpacity;
    tgtCottageGlow = theme.cottageGlow;

    applyFlowerPalette(theme);
    applySparklePalette(theme);
  };

  const applyThemeInstant = (theme: MoodTheme) => {
    setTargetTheme(theme);
    curZenith.copy(tgtZenith);
    curMid.copy(tgtMid);
    curHorizon.copy(tgtHorizon);
    curSunDir.copy(tgtSunDir);
    curGrassBase.copy(tgtGrassBase);
    curGrassTip.copy(tgtGrassTip);
    curTerrainLight.copy(tgtTerrainLight);
    curTerrainDark.copy(tgtTerrainDark);
    curMountain.copy(tgtMountain);
    curCloudTint.copy(tgtCloudTint);
    curCloudOpacity = tgtCloudOpacity;
    curStarOpacity = tgtStarOpacity;
    curCottageGlow = tgtCottageGlow;

    cloudMat.color.copy(curCloudTint);
    cloudMat.opacity = curCloudOpacity;
    starMat.opacity = curStarOpacity;
    northStarMat.opacity = curStarOpacity;
    mountainMat.color.copy(curMountain);
    windowGlowMat.emissiveIntensity = curCottageGlow;
    updateTerrainVertexColors();
  };

  let terrainColorTimer = 0;

  const update = (
    elapsed: number,
    dt: number,
    pointerWorld: THREE.Vector3,
    pointerForce: number
  ) => {
    const alpha = 1 - Math.exp(-3.2 * dt);

    curZenith.lerp(tgtZenith, alpha);
    curMid.lerp(tgtMid, alpha);
    curHorizon.lerp(tgtHorizon, alpha);
    curSunDir.lerp(tgtSunDir, alpha).normalize();
    curGrassBase.lerp(tgtGrassBase, alpha);
    curGrassTip.lerp(tgtGrassTip, alpha);
    curTerrainLight.lerp(tgtTerrainLight, alpha);
    curTerrainDark.lerp(tgtTerrainDark, alpha);
    curMountain.lerp(tgtMountain, alpha);
    curCloudTint.lerp(tgtCloudTint, alpha);
    curCloudOpacity = THREE.MathUtils.lerp(curCloudOpacity, tgtCloudOpacity, alpha);
    curStarOpacity = THREE.MathUtils.lerp(curStarOpacity, tgtStarOpacity, alpha);
    curCottageGlow = THREE.MathUtils.lerp(curCottageGlow, tgtCottageGlow, alpha);

    cloudMat.color.copy(curCloudTint);
    cloudMat.opacity = curCloudOpacity;
    starMat.opacity = curStarOpacity * (0.85 + Math.sin(elapsed * 2.3) * 0.15);
    northStarMat.opacity = curStarOpacity * (0.9 + Math.sin(elapsed * 3.1) * 0.1);
    mountainMat.color.copy(curMountain);
    windowGlowMat.emissiveIntensity = curCottageGlow;

    terrainColorTimer += dt;
    if (terrainColorTimer > 0.05) {
      terrainColorTimer = 0;
      if (
        Math.abs(curTerrainLight.r - tgtTerrainLight.r) > 0.002 ||
        Math.abs(curTerrainDark.r - tgtTerrainDark.r) > 0.002
      ) {
        updateTerrainVertexColors();
      }
    }

    windUniforms.uTime.value = elapsed;
    const targetWindStrength =
      activeWeather === 'rain' ? 1.7 : activeWeather === 'petals' ? 1.25 : 1.0;
    windUniforms.uWindStrength.value = THREE.MathUtils.lerp(
      windUniforms.uWindStrength.value,
      targetWindStrength,
      alpha
    );
    windUniforms.uPointerPos.value.copy(pointerWorld);
    windUniforms.uPointerForce.value = pointerForce;

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > 48) c.group.position.x = -48;
      c.group.position.y = c.baseY + Math.sin(elapsed * 0.4 + c.phase) * 0.25;
    }

    treeGroup.rotation.z = Math.sin(elapsed * 1.1) * 0.014;

    // Update active 3D Weather Particles
    if (activeWeather === 'rain') {
      const rAttr = rainGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < rainCount; i++) {
        rainOrigins[i * 3] += dt * 2.8;
        rainOrigins[i * 3 + 1] -= rainSpeeds[i] * dt;
        if (rainOrigins[i * 3 + 1] < 0) {
          rainOrigins[i * 3 + 1] = 22 + Math.random() * 4;
          rainOrigins[i * 3] = (Math.random() - 0.5) * 46;
        }
        const rx = rainOrigins[i * 3];
        const ry = rainOrigins[i * 3 + 1];
        const rz = rainOrigins[i * 3 + 2];
        rAttr.setXYZ(i * 2, rx, ry, rz);
        rAttr.setXYZ(i * 2 + 1, rx - 0.14, ry + 0.72, rz);
      }
      rAttr.needsUpdate = true;
    } else if (activeWeather === 'petals') {
      for (let i = 0; i < petalDropCount; i++) {
        const p = petalData[i];
        p.x += (0.85 + Math.sin(elapsed * 1.1 + p.phase) * 0.45) * dt;
        p.y -= p.vy * dt;
        p.z += Math.cos(elapsed * 0.9 + p.phase) * 0.35 * dt;
        if (p.y < 0.1 || p.x > 24) {
          p.y = 11 + Math.random() * 4;
          p.x = -22 + Math.random() * 38;
        }
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(
          elapsed * p.spin + p.phase,
          elapsed * 1.2 + p.phase,
          Math.sin(elapsed + p.phase) * 0.6
        );
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        petalDrops.setMatrixAt(i, dummy.matrix);
      }
      petalDrops.instanceMatrix.needsUpdate = true;
    } else if (activeWeather === 'snow') {
      const sAttr = snowGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < snowCount; i++) {
        let sx = sAttr.getX(i) + Math.sin(elapsed * 1.4 + snowPhase[i]) * 0.45 * dt;
        let sy = sAttr.getY(i) - (1.15 + (i % 4) * 0.22) * dt;
        const sz = sAttr.getZ(i) + Math.cos(elapsed * 1.1 + snowPhase[i]) * 0.25 * dt;
        if (sy < 0.05) {
          sy = 17 + Math.random() * 2;
          sx = (Math.random() - 0.5) * 44;
        }
        sAttr.setXYZ(i, sx, sy, sz);
      }
      sAttr.needsUpdate = true;
    } else if (activeWeather === 'mist') {
      const mAttr = mistGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < mistCount; i++) {
        const mx = mistBase[i * 3] + Math.sin(elapsed * 0.25 + i) * 3.5;
        const my = mistBase[i * 3 + 1] + Math.sin(elapsed * 0.4 + i * 0.7) * 0.25;
        const mz = mistBase[i * 3 + 2] + Math.cos(elapsed * 0.22 + i) * 1.8;
        mAttr.setXYZ(i, mx, my, mz);
      }
      mAttr.needsUpdate = true;
    } else if (activeWeather === 'fireflies') {
      const fAttr = fireflyGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < fireflyCount; i++) {
        const fx = fireflyBase[i * 3] + Math.sin(elapsed * 0.8 + i * 1.1) * 1.6;
        const fy = fireflyBase[i * 3 + 1] + Math.sin(elapsed * 1.5 + i * 0.9) * 0.45;
        const fz = fireflyBase[i * 3 + 2] + Math.cos(elapsed * 0.7 + i * 1.3) * 1.4;
        fAttr.setXYZ(i, fx, fy, fz);
      }
      fAttr.needsUpdate = true;
      fireflyMat.opacity = 0.65 + Math.sin(elapsed * 2.8) * 0.28;
    }

    // Ambient floating sparkles + cursor breeze swirl
    const aPos = ambGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < ambientCount; i++) {
      const ph = ambPhase[i];
      let sx =
        ambBase[i * 3] +
        Math.sin(elapsed * 0.55 + ph) * 1.15 +
        ((elapsed * 0.45 + ph) % 8.0) -
        4.0;
      let sy = ambBase[i * 3 + 1] + Math.sin(elapsed * 1.3 + ph * 1.7) * 0.35;
      let sz = ambBase[i * 3 + 2] + Math.cos(elapsed * 0.45 + ph) * 0.8;

      if (pointerForce > 0.05) {
        const dx = sx - pointerWorld.x;
        const dz = sz - pointerWorld.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 4.5 && dist > 0.01) {
          const swirl = (1 - dist / 4.5) * pointerForce;
          sx += (dx / dist) * swirl * 1.2;
          sz += (dz / dist) * swirl * 1.2;
          sy += swirl * 0.9;
        }
      }

      aPos.setXYZ(i, sx, sy, sz);
    }
    aPos.needsUpdate = true;

    let anyBurstAlive = false;
    const bPosAttr = burstGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < burstCount; i++) {
      if (burstLife[i] > 0) {
        anyBurstAlive = true;
        burstLife[i] -= dt * 0.95;
        if (burstLife[i] <= 0) {
          burstLife[i] = 0;
          bPosAttr.setXYZ(i, 0, -200, 0);
        } else {
          const x = bPosAttr.getX(i) + burstVel[i * 3] * dt;
          const y = bPosAttr.getY(i) + burstVel[i * 3 + 1] * dt;
          const z = bPosAttr.getZ(i) + burstVel[i * 3 + 2] * dt;
          burstVel[i * 3] *= 0.96;
          burstVel[i * 3 + 1] -= dt * 0.9;
          burstVel[i * 3 + 2] *= 0.96;
          bPosAttr.setXYZ(i, x, y, z);
        }
      }
    }
    if (anyBurstAlive) {
      bPosAttr.needsUpdate = true;
    }
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return {
    group: root,
    update,
    applyThemeInstant,
    setTargetTheme,
    setWeather,
    spawnSparkleBurst,
    dispose,
  };
}
