export type DayMood = 'morning' | 'sunny' | 'sunset' | 'starry';

export type WeatherMode = 'auto' | 'rain' | 'petals' | 'mist' | 'snow';

export type ResolvedWeather = 'mist' | 'petals' | 'rain' | 'snow' | 'fireflies';

export type ViewMode = 'pc' | 'phone';

export type WindowStage = 'closed_intro' | 'opening' | 'open' | 'closing' | 'closed_sealed';

export type CameraPreset = 'letter' | 'meadow';

export interface CameraViewState {
  pos: [number, number, number];
  target: [number, number, number];
}

export interface CapsulePayload {
  m: string;
  t: DayMood;
  w?: WeatherMode;
  v?: CameraPreset;
  c?: [number, number, number, number, number, number];
}

export interface MoodTheme {
  id: DayMood;
  label: string;
  subtitle: string;
  defaultWeather: ResolvedWeather;
  skyZenith: string;
  skyMid: string;
  skyHorizon: string;
  fogColor: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  rimColor: string;
  rimIntensity: number;
  grassBase: string;
  grassTip: string;
  terrainLight: string;
  terrainDark: string;
  mountainColor: string;
  flowerColors: string[];
  sparkleColors: string[];
  cloudTint: string;
  cloudOpacity: number;
  starOpacity: number;
  cottageGlow: number;
  swatchGradient: string;
}
