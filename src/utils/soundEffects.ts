import type { DayMood, ResolvedWeather } from '../types/capsule';

const MOOD_BGM_URLS: Record<DayMood, string> = {
  morning: '/assets/aistudio/sonican-curious-background-music-634638_500b384b.mp3',
  sunny: '/assets/aistudio/viacheslavstarostin-artoon-cartoon-music-634403_e999a346.mp3',
  sunset: '/assets/aistudio/lux-aeterna-dramamine-flawed-mangoes-537281_e40cd875.mp3',
  starry: '/assets/aistudio/sub_clair-soft-ambient-634887_4be370f5.mp3',
};

const BGM_TARGET_VOLUME = 0.34;

class MeadowAudio {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private musicActive = false;
  private currentMood: DayMood = 'sunny';
  private currentWeather: ResolvedWeather = 'petals';
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private lastSparkleTime = 0;
  private lastBaaTime = 0;

  private audioElements: Partial<Record<DayMood, HTMLAudioElement>> = {};
  private fadeTimer: number | null = null;
  private playRequestId = 0;

  setEnabled(value: boolean) {
    this.enabled = value;
    this.playRequestId += 1;

    if (!value) {
      this.pauseAllBgm();
      this.stopRainAmbience(true);
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      if (this.ctx && this.ctx.state === 'running') {
        void this.ctx.suspend().catch(() => {});
      }
    } else {
      const ctx = this.getContext();
      if (ctx && this.masterGain) {
        this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
        this.masterGain.gain.setTargetAtTime(0.85, ctx.currentTime, 0.08);
      }
      if (this.musicActive) {
        this.playBgmForMood(this.currentMood);
        this.syncRainAmbience();
      }
    }
  }

  isEnabled() {
    return this.enabled;
  }

  private getOrCreateAudio(mood: DayMood): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioElements[mood]) {
      const audio = new Audio(MOOD_BGM_URLS[mood]);
      audio.loop = true;
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.muted = !this.enabled;
      audio.volume = 0;
      this.audioElements[mood] = audio;
    }
    return this.audioElements[mood] ?? null;
  }

  unlockOnGesture() {
    if (!this.enabled) return;
    this.getContext();
    if (this.musicActive) {
      const activeEl = this.audioElements[this.currentMood];
      if (!activeEl || activeEl.paused || activeEl.muted) {
        this.playBgmForMood(this.currentMood);
      }
    }
  }

  private pauseAllBgm() {
    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
    (Object.keys(this.audioElements) as DayMood[]).forEach((m) => {
      const el = this.audioElements[m];
      if (el) {
        el.muted = true;
        el.volume = 0;
        el.pause();
      }
    });
  }

  private playBgmForMood(mood: DayMood) {
    if (!this.enabled || !this.musicActive) {
      this.pauseAllBgm();
      return;
    }

    const targetAudio = this.getOrCreateAudio(mood);
    if (!targetAudio) return;

    const reqId = ++this.playRequestId;
    targetAudio.muted = false;

    const anyOtherPlaying = (Object.keys(this.audioElements) as DayMood[]).some(
      (m) => m !== mood && this.audioElements[m] && !this.audioElements[m]!.paused
    );

    if (
      !targetAudio.paused &&
      !anyOtherPlaying &&
      targetAudio.volume >= BGM_TARGET_VOLUME - 0.02
    ) {
      return;
    }

    if (targetAudio.paused) {
      targetAudio.volume = 0;
      void targetAudio
        .play()
        .then(() => {
          if (
            !this.enabled ||
            !this.musicActive ||
            reqId !== this.playRequestId ||
            mood !== this.currentMood
          ) {
            targetAudio.muted = true;
            targetAudio.volume = 0;
            targetAudio.pause();
          }
        })
        .catch(() => {
          // Autoplay blocked until next user gesture
        });
    }

    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    const startVols: Partial<Record<DayMood, number>> = {};
    (Object.keys(MOOD_BGM_URLS) as DayMood[]).forEach((m) => {
      const el = this.audioElements[m];
      if (el) startVols[m] = el.volume;
    });

    let step = 0;
    const maxSteps = 12;

    this.fadeTimer = window.setInterval(() => {
      if (!this.enabled || !this.musicActive || mood !== this.currentMood) {
        this.pauseAllBgm();
        return;
      }

      step += 1;
      const t = Math.min(1, step / maxSteps);

      (Object.keys(MOOD_BGM_URLS) as DayMood[]).forEach((m) => {
        const el = this.audioElements[m];
        if (!el) return;
        const v0 = startVols[m] ?? 0;
        if (m === mood) {
          el.muted = false;
          el.volume = v0 + (BGM_TARGET_VOLUME - v0) * t;
        } else {
          el.volume = v0 * (1 - t);
          if (t >= 1) {
            el.muted = true;
            el.volume = 0;
            if (!el.paused) el.pause();
          }
        }
      });

      if (t >= 1 && this.fadeTimer !== null) {
        window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, 45);
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 24;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.12;
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private withRunningContext(fn: (ctx: AudioContext, dest: GainNode, warmLead: number) => void) {
    const wasFresh = !this.ctx || this.ctx.state === 'suspended';
    const ctx = this.getContext();
    if (!ctx || !this.masterGain || !this.enabled) return;
    if (ctx.state === 'running') {
      fn(ctx, this.masterGain, wasFresh ? 0.04 : 0.015);
      return;
    }
    const requestedAt = performance.now();
    void ctx
      .resume()
      .then(() => {
        if (!this.enabled || !this.masterGain || ctx.state !== 'running') return;
        if (performance.now() - requestedAt > 250) return;
        fn(ctx, this.masterGain, 0.045);
      })
      .catch(() => {});
  }

  startBackgroundMusic(mood: DayMood, weather: ResolvedWeather) {
    this.currentMood = mood;
    this.currentWeather = weather;
    this.musicActive = true;
    if (!this.enabled) {
      this.pauseAllBgm();
      return;
    }
    this.getContext();
    this.playBgmForMood(mood);
    this.syncRainAmbience();
  }

  setMoodAndWeather(mood: DayMood, weather: ResolvedWeather) {
    const moodChanged = this.currentMood !== mood;
    this.currentMood = mood;
    this.currentWeather = weather;
    if (!this.enabled || !this.musicActive) {
      if (!this.enabled) this.pauseAllBgm();
      return;
    }

    if (moodChanged) {
      this.playBgmForMood(mood);
    }
    this.syncRainAmbience();
  }

  private syncRainAmbience() {
    if (!this.enabled || !this.musicActive || this.currentWeather !== 'rain') {
      this.stopRainAmbience(!this.enabled);
      return;
    }

    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    if (!this.rainSource) {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.05 * white) / 1.05;
        data[i] = lastOut * 2.5;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1150;
      filter.Q.value = 0.65;

      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.5);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start();

      this.rainSource = src;
      this.rainGain = gain;
    } else if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.4);
    }
  }

  private stopRainAmbience(immediate = false) {
    if (this.rainGain && this.ctx) {
      if (immediate) {
        this.rainGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } else {
        this.rainGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
      }
    }
    if (this.rainSource) {
      const src = this.rainSource;
      this.rainSource = null;
      this.rainGain = null;
      if (immediate) {
        try {
          src.stop();
        } catch {
          // ignore
        }
      } else {
        window.setTimeout(() => {
          try {
            src.stop();
          } catch {
            // ignore
          }
        }, 350);
      }
    }
  }

  playWindowOpen() {
    this.withRunningContext((ctx, dest, lead) => {
      const now = ctx.currentTime + lead;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = now + i * 0.095;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.036, t0 + 0.045);
        gain.gain.linearRampToValueAtTime(0.004, t0 + 0.65);
        gain.gain.linearRampToValueAtTime(0, t0 + 0.85);
        osc.connect(gain);
        gain.connect(dest);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t0);
        osc.stop(t0 + 0.88);
      });
    });
  }

  playWindowClose() {
    this.withRunningContext((ctx, dest, lead) => {
      const now = ctx.currentTime + lead;
      const notes = [783.99, 659.25, 523.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = now + i * 0.07;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.036, t0 + 0.035);
        gain.gain.linearRampToValueAtTime(0, t0 + 0.55);
        osc.connect(gain);
        gain.connect(dest);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t0);
        osc.stop(t0 + 0.58);
      });
    });
  }

  playSheepBaa() {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBaaTime < 240) return;
    this.lastBaaTime = nowMs;

    this.withRunningContext((ctx, dest, lead) => {
      const now = ctx.currentTime + lead;
      const oscMain = ctx.createOscillator();
      const oscWarm = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const baseFreq = 275 + Math.random() * 75;
      oscMain.type = 'triangle';
      oscMain.frequency.setValueAtTime(baseFreq, now);
      oscMain.frequency.linearRampToValueAtTime(baseFreq * 0.9, now + 0.28);

      oscWarm.type = 'sine';
      oscWarm.frequency.setValueAtTime(baseFreq * 2, now);
      oscWarm.frequency.linearRampToValueAtTime(baseFreq * 1.78, now + 0.28);

      // Gentle sheep vibrato without harsh FM spikes
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(13, now);
      lfoGain.gain.setValueAtTime(7.5, now);
      lfo.connect(lfoGain);
      lfoGain.connect(oscMain.frequency);
      lfoGain.connect(oscWarm.frequency);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1150, now);
      filter.Q.setValueAtTime(1.4, now);

      const warmGain = ctx.createGain();
      warmGain.gain.value = 0.28;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.045);
      gain.gain.linearRampToValueAtTime(0.038, now + 0.19);
      gain.gain.linearRampToValueAtTime(0, now + 0.34);

      oscMain.connect(filter);
      oscWarm.connect(warmGain);
      warmGain.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      oscMain.onended = () => {
        oscMain.disconnect();
        oscWarm.disconnect();
        warmGain.disconnect();
        lfo.disconnect();
        lfoGain.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      oscMain.start(now);
      oscWarm.start(now);
      lfo.start(now);
      oscMain.stop(now + 0.36);
      oscWarm.stop(now + 0.36);
      lfo.stop(now + 0.36);
    });
  }

  playSparkleChime() {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastSparkleTime < 190) return;
    this.lastSparkleTime = nowMs;

    this.withRunningContext((ctx, dest, lead) => {
      const now = ctx.currentTime + lead;
      const pentatonic = [880, 987.77, 1174.66, 1318.51, 1567.98, 1760];
      const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.022, now + 0.025);
      gain.gain.linearRampToValueAtTime(0, now + 0.42);

      osc.connect(gain);
      gain.connect(dest);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.44);
    });
  }
}

export const meadowAudio = new MeadowAudio();
