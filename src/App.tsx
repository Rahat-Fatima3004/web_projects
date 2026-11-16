import { Monitor, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MeadowCanvas } from './components/MeadowCanvas';
import { MeadowDock } from './components/MeadowDock';
import { WindowCapsule } from './components/WindowCapsule';
import { resolveWeather } from './scene/moodThemes';
import type {
  CameraPreset,
  CameraViewState,
  DayMood,
  ViewMode,
  WeatherMode,
  WindowStage,
} from './types/capsule';
import {
  buildShareUrl,
  clearCapsuleUrl,
  decodeCapsule,
  encodeCapsule,
  readCapsuleFromUrl,
  unpackCameraView,
} from './utils/capsuleCodec';
import { meadowAudio } from './utils/soundEffects';

export default function App() {
  const initialCapsuleRef = useRef(readCapsuleFromUrl());
  const initialCapsule = initialCapsuleRef.current;

  const [isNativeMobile, setIsNativeMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'phone' : 'pc'
  );

  const [isReceiverMode, setIsReceiverMode] = useState<boolean>(Boolean(initialCapsule));
  const [mood, setMood] = useState<DayMood>(initialCapsule?.t ?? 'sunny');
  const [weatherMode, setWeatherMode] = useState<WeatherMode>(initialCapsule?.w ?? 'auto');
  const [message, setMessage] = useState<string>(initialCapsule?.m ?? '');
  const [sheepMessage, setSheepMessage] = useState<string>(initialCapsule?.m ?? '');
  const [stage, setStage] = useState<WindowStage>('closed_intro');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>(initialCapsule?.v ?? 'letter');
  const [savedCameraView, setSavedCameraView] = useState<CameraViewState | null>(() =>
    unpackCameraView(initialCapsule?.c)
  );
  const [scatterNonce, setScatterNonce] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [shareUrl, setShareUrl] = useState<string>('');

  const transitionTimerRef = useRef<number | null>(null);
  const getCameraViewRef = useRef<(() => CameraViewState) | null>(null);
  const resolvedWeather = resolveWeather(mood, weatherMode);

  useEffect(() => {
    const onResize = () => {
      setIsNativeMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSheepMessage(message);
    }, 140);
    return () => window.clearTimeout(id);
  }, [message]);

  useEffect(() => {
    meadowAudio.setMoodAndWeather(mood, resolvedWeather);
  }, [mood, resolvedWeather]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const clearPendingTimer = () => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  };

  const handleOpenWindow = () => {
    clearPendingTimer();
    meadowAudio.playWindowOpen();
    meadowAudio.startBackgroundMusic(mood, resolvedWeather);
    setStage('opening');
    transitionTimerRef.current = window.setTimeout(() => {
      setStage('open');
    }, 1150);
  };

  const handleCloseAndSeal = () => {
    if (!message.trim()) return;
    clearPendingTimer();
    const liveView = getCameraViewRef.current?.() ?? savedCameraView;
    setSavedCameraView(liveView);
    const url = buildShareUrl(message, mood, weatherMode, cameraPreset, liveView);
    setShareUrl(url);
    meadowAudio.playWindowClose();
    setStage('closing');
    transitionTimerRef.current = window.setTimeout(() => {
      setStage('closed_sealed');
    }, 90);
  };

  const handleReopenToEdit = () => {
    clearPendingTimer();
    meadowAudio.playWindowOpen();
    meadowAudio.startBackgroundMusic(mood, resolvedWeather);
    setStage('opening');
    transitionTimerRef.current = window.setTimeout(() => {
      setStage('open');
    }, 1100);
  };

  const handlePreviewAsFriend = () => {
    clearPendingTimer();
    const token = encodeCapsule(message, mood, weatherMode, cameraPreset, savedCameraView);
    const url = new URL(window.location.href);
    url.searchParams.set('c', token);
    window.history.replaceState({}, '', url.pathname + url.search);
    setIsReceiverMode(true);
    setStage('closed_intro');
  };

  const handleDeleteAndCreateNew = () => {
    clearPendingTimer();
    clearCapsuleUrl();
    setIsReceiverMode(false);
    setMessage('');
    setSheepMessage('');
    setShareUrl('');
    setSavedCameraView(null);
    setCameraPreset('letter');
    setStage('open');
  };

  const handleStartFreshFromSealed = () => {
    clearPendingTimer();
    clearCapsuleUrl();
    setIsReceiverMode(false);
    setMessage('');
    setSheepMessage('');
    setShareUrl('');
    setSavedCameraView(null);
    setCameraPreset('letter');
    meadowAudio.playWindowOpen();
    meadowAudio.startBackgroundMusic(mood, resolvedWeather);
    setStage('opening');
    transitionTimerRef.current = window.setTimeout(() => {
      setStage('open');
    }, 1100);
  };

  const handleCameraPresetChange = (preset: CameraPreset) => {
    setSavedCameraView(null);
    setCameraPreset(preset);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    meadowAudio.setEnabled(next);
    if (next && stage === 'open') {
      meadowAudio.startBackgroundMusic(mood, resolvedWeather);
    }
  };

  const handleOpenByCode = (codeOrUrl: string): boolean => {
    const decoded = decodeCapsule(codeOrUrl);
    if (!decoded) return false;
    setMood(decoded.t);
    setWeatherMode(decoded.w ?? 'auto');
    setCameraPreset(decoded.v ?? 'letter');
    setSavedCameraView(unpackCameraView(decoded.c));
    setMessage(decoded.m);
    setSheepMessage(decoded.m);
    setIsReceiverMode(true);
    setStage('closed_intro');
    return true;
  };

  const isPhoneFrame = !isNativeMobile && viewMode === 'phone';

  return (
    <main
      className="relative w-screen h-[100dvh] overflow-hidden select-none flex items-center justify-center transition-colors duration-500"
      style={{
        backgroundColor: isPhoneFrame ? '#e7ded0' : '#f3ece2',
      }}
    >
      {/* Top-Right Switcher on Closed Window Stage so PC/Phone mode works before opening too */}
      {!isNativeMobile && stage !== 'open' && (
        <div
          className="fixed top-4 right-4 z-30 flex items-center p-0.5 rounded-xl border shadow-sm"
          style={{
            backgroundColor: 'rgba(255, 250, 244, 0.92)',
            borderColor: 'rgba(164, 145, 122, 0.28)',
          }}
          role="group"
          aria-label="Viewport mode"
        >
          <button
            type="button"
            onClick={() => setViewMode('pc')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'pc'
                ? 'bg-[#ebe0cf] text-[#2f2a24]'
                : 'text-[#6a5f53] hover:text-[#2f2a24]'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>PC</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('phone')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'phone'
                ? 'bg-[#ebe0cf] text-[#2f2a24]'
                : 'text-[#6a5f53] hover:text-[#2f2a24]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Phone</span>
          </button>
        </div>
      )}

      {/* Viewport Container (Full-screen PC or Centered Interactive Mobile Phone Frame) */}
      <div
        className={`relative overflow-hidden transition-all duration-500 ${
          isPhoneFrame
            ? 'w-[390px] h-[min(812px,92dvh)] rounded-[42px] border-[10px] border-[#2d2722] shadow-[0_28px_72px_rgba(34,26,18,0.34)]'
            : 'w-full h-full'
        }`}
      >
        {isPhoneFrame && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-40 w-24 h-4 rounded-full bg-[#2d2722]/90"
          />
        )}

        <MeadowCanvas
          mood={mood}
          weather={resolvedWeather}
          message={
            stage === 'closed_intro' || (stage === 'opening' && isReceiverMode)
              ? ''
              : sheepMessage
          }
          cameraPreset={cameraPreset}
          cameraView={savedCameraView}
          scatterNonce={scatterNonce}
          isWindowOpen={stage === 'open'}
          onRegisterCameraGetter={(getter) => {
            getCameraViewRef.current = getter;
          }}
        />

        <WindowCapsule
          stage={stage}
          isReceiverMode={isReceiverMode}
          mood={mood}
          message={message}
          shareUrl={shareUrl}
          isPhoneView={viewMode === 'phone' || isNativeMobile}
          onOpenWindow={handleOpenWindow}
          onReopenToEdit={handleReopenToEdit}
          onPreviewAsFriend={handlePreviewAsFriend}
          onStartFresh={handleStartFreshFromSealed}
          onOpenByCode={handleOpenByCode}
        />

        {stage === 'open' && (
          <MeadowDock
            isReceiverMode={isReceiverMode}
            mood={mood}
            weatherMode={weatherMode}
            message={message}
            cameraPreset={cameraPreset}
            soundEnabled={soundEnabled}
            viewMode={viewMode}
            isNativeMobile={isNativeMobile}
            onMoodChange={setMood}
            onWeatherChange={setWeatherMode}
            onMessageChange={setMessage}
            onCameraPresetChange={handleCameraPresetChange}
            onToggleSound={handleToggleSound}
            onToggleViewMode={setViewMode}
            onScatter={() => setScatterNonce((n) => n + 1)}
            onCloseAndSeal={handleCloseAndSeal}
            onDeleteAndCreateNew={handleDeleteAndCreateNew}
          />
        )}
      </div>
    </main>
  );
}
