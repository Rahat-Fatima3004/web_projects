import {
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Lock,
  Monitor,
  Plus,
  Shuffle,
  Smartphone,
  Trash2,
  Type,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { MOOD_ORDER, MOOD_THEMES, WEATHER_OPTIONS } from '../scene/moodThemes';
import type { CameraPreset, DayMood, ViewMode, WeatherMode } from '../types/capsule';

interface MeadowDockProps {
  isReceiverMode: boolean;
  mood: DayMood;
  weatherMode: WeatherMode;
  message: string;
  cameraPreset: CameraPreset;
  soundEnabled: boolean;
  viewMode: ViewMode;
  isNativeMobile: boolean;
  onMoodChange: (mood: DayMood) => void;
  onWeatherChange: (weather: WeatherMode) => void;
  onMessageChange: (msg: string) => void;
  onCameraPresetChange: (preset: CameraPreset) => void;
  onToggleSound: () => void;
  onToggleViewMode: (mode: ViewMode) => void;
  onScatter: () => void;
  onCloseAndSeal: () => void;
  onDeleteAndCreateNew: () => void;
}

const SAMPLE_NOTES = [
  'Hello, how are you?',
  'Thinking of you under this sky.',
  'Sending warm hugs from afar!',
  'Hope your day feels soft & bright.',
];

export function MeadowDock({
  isReceiverMode,
  mood,
  weatherMode,
  message,
  cameraPreset,
  soundEnabled,
  viewMode,
  isNativeMobile,
  onMoodChange,
  onWeatherChange,
  onMessageChange,
  onCameraPresetChange,
  onToggleSound,
  onToggleViewMode,
  onScatter,
  onCloseAndSeal,
  onDeleteAndCreateNew,
}: MeadowDockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmingNew, setConfirmingNew] = useState(false);
  const [draft, setDraft] = useState(message);
  const [sampleIdx, setSampleIdx] = useState(0);

  useEffect(() => {
    setDraft(message);
  }, [message]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleDraftChange = (val: string) => {
    const trimmed = val.slice(0, 56);
    setDraft(trimmed);
    onMessageChange(trimmed);
  };

  const handleUseSample = () => {
    const next = SAMPLE_NOTES[sampleIdx % SAMPLE_NOTES.length];
    setSampleIdx((i) => i + 1);
    setDraft(next);
    onMessageChange(next);
  };

  const theme = MOOD_THEMES[mood];
  const isStarry = mood === 'starry';
  const isPhoneLayout = viewMode === 'phone' || isNativeMobile;

  return (
    <>
      {/* Minimal Top Bar inside Viewport */}
      <header className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div
          className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-colors duration-300"
          style={{
            backgroundColor: isStarry
              ? 'rgba(18, 32, 68, 0.88)'
              : 'rgba(255, 250, 244, 0.92)',
            borderColor: isStarry
              ? 'rgba(155, 185, 240, 0.25)'
              : 'rgba(164, 145, 122, 0.28)',
            color: isStarry ? '#edf3ff' : '#2f2a24',
          }}
        >
          <span className="font-display text-sm sm:text-base font-medium whitespace-nowrap shrink-0">
            Meadowpost
          </span>
          <span aria-hidden="true" className="opacity-40 text-xs">
            ·
          </span>
          <span className="text-xs opacity-80 whitespace-nowrap shrink-0">
            {theme.label}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {!isNativeMobile && (
            <div
              className="flex items-center p-0.5 rounded-xl border"
              style={{
                backgroundColor: isStarry
                  ? 'rgba(18, 32, 68, 0.88)'
                  : 'rgba(255, 250, 244, 0.92)',
                borderColor: isStarry
                  ? 'rgba(155, 185, 240, 0.25)'
                  : 'rgba(164, 145, 122, 0.28)',
              }}
              role="group"
              aria-label="Viewport mode"
            >
              <button
                type="button"
                onClick={() => onToggleViewMode('pc')}
                aria-label="PC mode"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'pc'
                    ? isStarry
                      ? 'bg-[#2a4586] text-[#ffffff]'
                      : 'bg-[#ebe0cf] text-[#2f2a24]'
                    : isStarry
                      ? 'text-[#b7cbef] hover:text-white'
                      : 'text-[#6a5f53] hover:text-[#2f2a24]'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>PC</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleViewMode('phone')}
                aria-label="Phone mode"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'phone'
                    ? isStarry
                      ? 'bg-[#2a4586] text-[#ffffff]'
                      : 'bg-[#ebe0cf] text-[#2f2a24]'
                    : isStarry
                      ? 'text-[#b7cbef] hover:text-white'
                      : 'text-[#6a5f53] hover:text-[#2f2a24]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Phone</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute music and sound' : 'Enable music and sound'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[38px]"
            style={{
              backgroundColor: isStarry
                ? 'rgba(18, 32, 68, 0.88)'
                : 'rgba(255, 250, 244, 0.92)',
              borderColor: isStarry
                ? 'rgba(155, 185, 240, 0.25)'
                : 'rgba(164, 145, 122, 0.28)',
              color: isStarry ? '#edf3ff' : '#2f2a24',
            }}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            {!isPhoneLayout && (
              <span>{soundEnabled ? 'Music On' : 'Muted'}</span>
            )}
          </button>
        </div>
      </header>

      {/* Collapsible Bottom Control Dock */}
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isPhoneLayout ? 'w-[calc(100%-20px)]' : 'w-[min(820px,94vw)]'
        } ${collapsed ? 'translate-y-[calc(100%+18px)]' : 'translate-y-0'}`}
      >
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: 'rgba(255, 250, 244, 0.92)',
              borderColor: 'rgba(164, 145, 122, 0.28)',
              color: '#4c4339',
              transform: collapsed ? 'translateY(-42px)' : 'none',
            }}
          >
            {collapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        <div
          className="rounded-2xl border p-3 sm:p-3.5 shadow-[0_18px_46px_rgba(36,28,18,0.16)]"
          style={{
            backgroundColor: 'rgba(255, 250, 244, 0.94)',
            borderColor: 'rgba(164, 145, 122, 0.30)',
            color: '#2f2a24',
          }}
        >
          {isReceiverMode ? (
            <div className="flex flex-col gap-2.5">
              {confirmingNew ? (
                <div className="flex flex-col gap-2.5 py-0.5">
                  <div>
                    <p className="text-sm font-semibold text-[#2f2a24]">
                      Delete present message and create a new one?
                    </p>
                    <p className="text-xs text-[#695e52] mt-0.5">
                      Clears your friend&apos;s note so the sheep can form a new message to send.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingNew(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#5c5349] hover:bg-[#efe6d8] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
                    >
                      Keep Reading
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingNew(false);
                        onDeleteAndCreateNew();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#fffaf4] bg-[#b55a4c] hover:bg-[#9f4b3e] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete &amp; Write New</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="min-w-0">
                    <p className="font-display text-base sm:text-lg text-[#2f2a24] truncate">
                      &ldquo;{message}&rdquo;
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[#6b6054] mt-0.5">
                      <span>{theme.label} Sky</span>
                      <span aria-hidden="true">·</span>
                      <span>Tap grass or sheep</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onCameraPresetChange(cameraPreset === 'letter' ? 'meadow' : 'letter')
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#4a4137] bg-[#efe6d8] hover:bg-[#e5d9c7] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
                    >
                      {cameraPreset === 'letter' ? (
                        <>
                          <Compass className="w-3.5 h-3.5" />
                          <span>Horizon</span>
                        </>
                      ) : (
                        <>
                          <Type className="w-3.5 h-3.5" />
                          <span>Letter View</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingNew(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#fffaf4] bg-[#4c6b47] hover:bg-[#3f5b3a] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Another Message</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* Row 1: Daytime Moods, Weather Selector, Camera & Scatter */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div
                  className="flex items-center gap-1 p-1 rounded-xl bg-[#efe6d8] overflow-x-auto max-w-full"
                  role="group"
                  aria-label="Daytime mood"
                >
                  {MOOD_ORDER.map((m) => {
                    const mt = MOOD_THEMES[m];
                    const active = mood === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onMoodChange(m)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[34px] ${
                          active
                            ? 'bg-[#fffdf9] text-[#2f2a24] shadow-sm'
                            : 'text-[#665b4f] hover:text-[#2f2a24]'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                          style={{ background: mt.swatchGradient }}
                        />
                        <span>{mt.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Weather Selector */}
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#efe6d8] text-xs font-medium text-[#544a40] min-h-[36px]">
                    <CloudRain className="w-3.5 h-3.5 shrink-0" />
                    <select
                      aria-label="Weather effect"
                      value={weatherMode}
                      onChange={(e) => onWeatherChange(e.target.value as WeatherMode)}
                      className="bg-transparent text-xs font-medium text-[#2f2a24] focus:outline-none cursor-pointer pr-1"
                    >
                      {WEATHER_OPTIONS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onCameraPresetChange(cameraPreset === 'letter' ? 'meadow' : 'letter')
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#544a40] bg-[#efe6d8] hover:bg-[#e5d9c6] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[36px]"
                  >
                    {cameraPreset === 'letter' ? (
                      <>
                        <Compass className="w-3.5 h-3.5" />
                        <span>Horizon</span>
                      </>
                    ) : (
                      <>
                        <Type className="w-3.5 h-3.5" />
                        <span>Letter</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onScatter}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#544a40] bg-[#efe6d8] hover:bg-[#e5d9c6] transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[36px]"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Scatter</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Message Input & Seal CTA */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) onCloseAndSeal();
                }}
                className={`flex gap-2 ${
                  isPhoneLayout ? 'flex-col items-stretch' : 'flex-row items-center'
                }`}
              >
                <div className="relative flex-1 flex items-center rounded-xl bg-[#fffdf9] border border-[#d6c8b6] focus-within:border-[#4c6b47] transition-colors">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    maxLength={56}
                    placeholder="Hello, how are you?"
                    aria-label="Message for the sheep to form"
                    className="w-full bg-transparent px-3 py-2.5 text-sm text-[#2f2a24] placeholder:text-[#a29586] focus:outline-none min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={handleUseSample}
                    className="mr-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#64594d] hover:text-[#2f2a24] hover:bg-[#efe6d8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Sample
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#fffaf4] bg-[#4c6b47] hover:bg-[#3f5b3a] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Close Window &amp; Create Link</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
