import type {
  CameraPreset,
  CameraViewState,
  CapsulePayload,
  DayMood,
  WeatherMode,
} from '../types/capsule';

const VALID_MOODS: DayMood[] = ['morning', 'sunny', 'sunset', 'starry'];
const VALID_WEATHERS: WeatherMode[] = ['auto', 'rain', 'petals', 'mist', 'snow'];
const VALID_VIEWS: CameraPreset[] = ['letter', 'meadow'];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function packCameraView(
  viewState?: CameraViewState | null
): [number, number, number, number, number, number] | undefined {
  if (!viewState) return undefined;
  const nums = [...viewState.pos, ...viewState.target];
  if (nums.length !== 6 || nums.some((v) => !Number.isFinite(v))) return undefined;
  return [
    round2(nums[0]),
    round2(nums[1]),
    round2(nums[2]),
    round2(nums[3]),
    round2(nums[4]),
    round2(nums[5]),
  ];
}

export function unpackCameraView(
  packed?: [number, number, number, number, number, number]
): CameraViewState | null {
  if (!Array.isArray(packed) || packed.length !== 6) return null;
  if (packed.some((v) => typeof v !== 'number' || !Number.isFinite(v))) return null;
  return {
    pos: [packed[0], packed[1], packed[2]],
    target: [packed[3], packed[4], packed[5]],
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeCapsule(
  message: string,
  mood: DayMood,
  weather: WeatherMode = 'auto',
  view: CameraPreset = 'letter',
  cameraView?: CameraViewState | null
): string {
  const packedCam = packCameraView(cameraView);
  const payload: CapsulePayload = {
    m: message.trim().slice(0, 64),
    t: mood,
    ...(weather !== 'auto' ? { w: weather } : {}),
    ...(view !== 'letter' ? { v: view } : {}),
    ...(packedCam ? { c: packedCam } : {}),
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function decodeCapsule(encoded: string): CapsulePayload | null {
  try {
    let token = encoded.trim();
    if (!token) return null;

    // Allow pasting either a full link (?c=... or #c=...) or a raw/MP- prefixed code
    if (token.includes('c=')) {
      try {
        const parsedUrl = new URL(token);
        token =
          parsedUrl.searchParams.get('c') ||
          new URLSearchParams(parsedUrl.hash.replace(/^#/, '')).get('c') ||
          token;
      } catch {
        const match = token.match(/[?&#]c=([^&#]+)/);
        if (match?.[1]) token = decodeURIComponent(match[1]);
      }
    }
    if (token.startsWith('MP-')) {
      token = token.slice(3);
    }

    if (!token || token.length > 1024) return null;
    const bytes = base64UrlToBytes(token);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<CapsulePayload>;
    if (typeof parsed.m !== 'string' || !parsed.m.trim()) return null;
    const mood: DayMood = VALID_MOODS.includes(parsed.t as DayMood)
      ? (parsed.t as DayMood)
      : 'sunny';
    const weather: WeatherMode = VALID_WEATHERS.includes(parsed.w as WeatherMode)
      ? (parsed.w as WeatherMode)
      : 'auto';
    const view: CameraPreset = VALID_VIEWS.includes(parsed.v as CameraPreset)
      ? (parsed.v as CameraPreset)
      : 'letter';
    const camView = unpackCameraView(parsed.c);
    const packedCam = camView ? packCameraView(camView) : undefined;
    return {
      m: parsed.m.trim().slice(0, 64),
      t: mood,
      w: weather,
      v: view,
      ...(packedCam ? { c: packedCam } : {}),
    };
  } catch {
    return null;
  }
}

export function readCapsuleFromUrl(): CapsulePayload | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  let raw = params.get('c');
  if (!raw && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    raw = hashParams.get('c');
  }
  if (!raw) return null;
  return decodeCapsule(raw);
}

export function isDevPreviewOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('ais-dev-');
}

export function getPublicAppOrigin(): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  // AI Studio dev preview hostnames (`ais-dev-*`) are private to the editor session
  // and redirect external phones to aistudio.google.com; map to the public `ais-pre-*` Shared App URL.
  if (url.hostname.startsWith('ais-dev-')) {
    url.hostname = url.hostname.replace(/^ais-dev-/, 'ais-pre-');
  }
  return url.origin;
}

export function buildShareUrl(
  message: string,
  mood: DayMood,
  weather: WeatherMode = 'auto',
  view: CameraPreset = 'letter',
  cameraView?: CameraViewState | null
): string {
  const token = encodeCapsule(message, mood, weather, view, cameraView);
  const baseOrigin = getPublicAppOrigin();
  const url = new URL(baseOrigin || window.location.origin);
  url.pathname = '/';
  url.searchParams.set('c', token);
  return url.toString();
}

export function clearCapsuleUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('c');
  url.hash = '';
  window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
}
