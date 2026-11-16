import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface SheepGeometryBundle {
  woolGeo: THREE.BufferGeometry;
  darkGeo: THREE.BufferGeometry;
  eyeWhiteGeo: THREE.BufferGeometry;
  pupilGeo: THREE.BufferGeometry;
  blushGeo: THREE.BufferGeometry;
  shadowGeo: THREE.BufferGeometry;
  shadowTexture: THREE.CanvasTexture;
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, 'rgba(20, 28, 16, 0.72)');
    grad.addColorStop(0.55, 'rgba(20, 28, 16, 0.28)');
    grad.addColorStop(1, 'rgba(20, 28, 16, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeTranslated(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  const mat = new THREE.Matrix4();
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  mat.compose(new THREE.Vector3(x, y, z), quat, new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(mat);
  return g;
}

export function createSheepGeometryBundle(): SheepGeometryBundle {
  // 1. Fluffy Cloud Wool Body (multi-lobe composite cluster + head puff + tail)
  const basePuff = new THREE.IcosahedronGeometry(0.36, 2);
  const woolParts: THREE.BufferGeometry[] = [
    // Main round chubby core
    makeTranslated(basePuff, 0, 0.47, 0.0, 1.15, 0.96, 1.18),
    // Side & top clouds for organic scalloped wool silhouette (like reference video)
    makeTranslated(basePuff, -0.21, 0.48, 0.05, 0.68, 0.68, 0.72),
    makeTranslated(basePuff, 0.21, 0.48, 0.05, 0.68, 0.68, 0.72),
    makeTranslated(basePuff, -0.15, 0.50, -0.22, 0.66, 0.64, 0.66),
    makeTranslated(basePuff, 0.15, 0.50, -0.22, 0.66, 0.64, 0.66),
    makeTranslated(basePuff, 0.0, 0.66, -0.02, 0.72, 0.58, 0.75),
    makeTranslated(basePuff, 0.0, 0.45, -0.27, 0.68, 0.64, 0.66),
    // Cute fluffy wool crown / bangs tuft above face
    makeTranslated(basePuff, 0.0, 0.59, 0.34, 0.46, 0.38, 0.44),
    makeTranslated(basePuff, -0.11, 0.56, 0.31, 0.32, 0.30, 0.32),
    makeTranslated(basePuff, 0.11, 0.56, 0.31, 0.32, 0.30, 0.32),
    // Tiny round tail puff at the back
    makeTranslated(basePuff, 0.0, 0.44, -0.46, 0.30, 0.28, 0.30),
  ];
  basePuff.dispose();
  const woolGeo = mergeGeometries(woolParts, false);
  woolParts.forEach((p) => p.dispose());

  // 2. Dark Velvet Face, Floppy Ears & 4 Stubby Peg Legs (bottom-center grounded at y=0)
  const sphereGeo = new THREE.SphereGeometry(0.18, 16, 12);
  const earGeo = new THREE.CapsuleGeometry(0.052, 0.12, 6, 10);
  const legGeo = new THREE.CylinderGeometry(0.042, 0.034, 0.24, 10);

  const darkParts: THREE.BufferGeometry[] = [
    // Face oval peeking out the front
    makeTranslated(sphereGeo, 0, 0.40, 0.36, 1.02, 0.92, 0.88),
    // Floppy drooping ears
    makeTranslated(earGeo, -0.21, 0.41, 0.33, 1, 1, 1, 0.18, 0.15, 0.72),
    makeTranslated(earGeo, 0.21, 0.41, 0.33, 1, 1, 1, 0.18, -0.15, -0.72),
    // 4 cute little peg legs resting cleanly on y = 0 (center at y = 0.12, height = 0.24)
    makeTranslated(legGeo, -0.16, 0.12, 0.16),
    makeTranslated(legGeo, 0.16, 0.12, 0.16),
    makeTranslated(legGeo, -0.16, 0.12, -0.16),
    makeTranslated(legGeo, 0.16, 0.12, -0.16),
  ];
  sphereGeo.dispose();
  earGeo.dispose();
  legGeo.dispose();
  const darkGeo = mergeGeometries(darkParts, false);
  darkParts.forEach((p) => p.dispose());

  // 3. Big Expressive Eye Whites
  const eyeSphere = new THREE.SphereGeometry(0.062, 14, 10);
  const eyeParts: THREE.BufferGeometry[] = [
    makeTranslated(eyeSphere, -0.072, 0.43, 0.495, 1.0, 1.08, 0.65),
    makeTranslated(eyeSphere, 0.072, 0.43, 0.495, 1.0, 1.08, 0.65),
  ];
  eyeSphere.dispose();
  const eyeWhiteGeo = mergeGeometries(eyeParts, false);
  eyeParts.forEach((p) => p.dispose());

  // 4. Glossy Dark Pupils
  const pupilSphere = new THREE.SphereGeometry(0.039, 12, 8);
  const pupilParts: THREE.BufferGeometry[] = [
    makeTranslated(pupilSphere, -0.068, 0.43, 0.528, 1.0, 1.05, 0.75),
    makeTranslated(pupilSphere, 0.068, 0.43, 0.528, 1.0, 1.05, 0.75),
  ];
  pupilSphere.dispose();
  const pupilGeo = mergeGeometries(pupilParts, false);
  pupilParts.forEach((p) => p.dispose());

  // 5. Rosy Cheek Blush & Tiny Nose Accent
  const blushSphere = new THREE.SphereGeometry(0.036, 10, 8);
  const blushParts: THREE.BufferGeometry[] = [
    makeTranslated(blushSphere, -0.115, 0.365, 0.47, 1.15, 0.75, 0.65),
    makeTranslated(blushSphere, 0.115, 0.365, 0.47, 1.15, 0.75, 0.65),
    makeTranslated(blushSphere, 0.0, 0.36, 0.515, 0.75, 0.55, 0.55),
  ];
  blushSphere.dispose();
  const blushGeo = mergeGeometries(blushParts, false);
  blushParts.forEach((p) => p.dispose());

  // 6. Soft Radial Contact Shadow Plane
  const shadowGeo = new THREE.PlaneGeometry(0.95, 0.95);
  shadowGeo.rotateX(-Math.PI / 2);
  shadowGeo.translate(0, 0.018, 0);

  return {
    woolGeo,
    darkGeo,
    eyeWhiteGeo,
    pupilGeo,
    blushGeo,
    shadowGeo,
    shadowTexture: createRadialShadowTexture(),
  };
}
