

import React, { useEffect, useRef, useState } from 'react';
import { BeatmapData, GameStats, HitObject } from '../types';

interface GameCanvasProps {
  beatmap: BeatmapData;
  autoPlay: boolean;
  showLinearAssist: boolean;
  enableRecording: boolean;
  noteSpeed: number;
  audioOffset: number;
  onGameEnd: (stats: GameStats) => void;
  onExit: () => void;
}

// Timing Windows
const HIT_WINDOW_PERFECT = 80;
const HIT_WINDOW_GOOD = 120;
const HIT_WINDOW_BAD = 160; 

// Rotation Offset (aligned for D-F-J-K corner sectors)
const ROTATION_OFFSET = Math.PI / 8;

// Colors - Cyan/Blue/White Palette
const COLORS: string[] = [
  '#06b6d4', // 0: Cyan (TR Sector)
  '#0ea5e9', // 1: Sky (TR Sector)
  '#2563eb', // 2: Blue (BR Sector)
  '#1d4ed8', // 3: Deep Blue (BR Sector)
  '#0ea5e9', // 4: Sky (BL Sector)
  '#06b6d4', // 5: Cyan (BL Sector)
  '#2563eb', // 6: Blue (TL Sector)
  '#1d4ed8', // 7: Deep Blue (TL Sector)
];

// MAPPING: D=BL(4,5), F=TL(6,7), J=TR(0,1), K=BR(2,3)
const INPUT_MAPPING: Record<string, number[]> = {
    'KeyD': [4, 5], // Bottom-Left
    'KeyF': [6, 7], // Top-Left
    'KeyJ': [0, 1], // Top-Right
    'KeyK': [2, 3], // Bottom-Right
};

const RADIAL_TO_LINEAR_MAP: number[] = [2, 2, 3, 3, 0, 0, 1, 1];
const KEY_INDEX_MAP: { [key: string]: number } = {
    'KeyD': 0, 'KeyF': 1, 'KeyJ': 2, 'KeyK': 3,
};
const LINEAR_COLORS = ['#0ea5e9', '#2563eb', '#06b6d4', '#1d4ed8']; 

interface JudgementText {
    id: number;
    text: string;
    color: string;
    time: number;
    rotation: number;
}

interface GeometricFlash {
    points: {x: number, y: number}[];
    color: string;
    life: number;
    type: 'line' | 'triangle' | 'quad' | 'poly';
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'ring' | 'hold' | 'shockwave' | 'fire' | 'burst';
  angle: number;

  constructor(x: number, y: number, color: string, type: 'spark' | 'ring' | 'hold' | 'shockwave' | 'fire' | 'burst' = 'spark', angle: number = 0) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.color = color;
    this.angle = angle;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.vx = 0;
    this.vy = 0;
    this.size = 10;

    if (type === 'spark') {
      const spread = (Math.random() - 0.5) * 2.0; 
      const moveAngle = angle + spread; 
      const speed = Math.random() * 8 + 4; 
      this.vx = Math.cos(moveAngle) * speed;
      this.vy = Math.sin(moveAngle) * speed;
      this.size = Math.random() * 4 + 2;
    } else if (type === 'fire') {
      const spread = (Math.random() - 0.5) * 1.0;
      const moveAngle = angle + spread;
      const speed = Math.random() * 8 + 4;
      this.vx = Math.cos(moveAngle) * speed;
      this.vy = Math.sin(moveAngle) * speed;
      this.life = 0.6;
      this.size = Math.random() * 5 + 3;
    } else if (type === 'hold') {
       this.vx = (Math.random() - 0.5) * 4;
       this.vy = (Math.random() - 0.5) * 4;
       this.life = 0.5;
       this.maxLife = 0.5;
       this.size = 7;
    } else if (type === 'shockwave') {
        this.size = 15;
        this.life = 0.6;
    } else if (type === 'burst') {
        this.size = 5;
        this.life = 0.4;
        this.color = '#ffffff'; 
    }
  }

  update() {
    if (this.type === 'spark') {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.90;
      this.vy *= 0.90;
      this.life -= 0.02;
      this.size *= 0.95;
    } else if (this.type === 'fire') {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.90;
      this.vy *= 0.90;
      this.life -= 0.04;
      this.size *= 0.90;
    } else if (this.type === 'hold') {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
        this.size *= 0.90;
    } else if (this.type === 'shockwave') {
        this.size += 8.0; 
        this.life -= 0.03;
    } else if (this.type === 'burst') {
        this.size += 12.0; 
        this.life -= 0.05;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.life <= 0) return;
    ctx.save();
    if (this.type === 'shockwave') {
        ctx.globalAlpha = Math.max(0, this.life * 0.8);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3 * this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.stroke();
    } else if (this.type === 'burst') {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4 * this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

interface GameStateRef {
    startTime: number;
    isPlaying: boolean;
    score: number;
    combo: number;
    maxCombo: number;
    perfect: number;
    good: number;
    bad: number;
    miss: number;
    processedIndices: Set<number>;
    missedIndices: Set<number>; 
    holdingIndices: Set<number>;
    particles: Particle[];
    geoFlashes: GeometricFlash[];
    judgement: JudgementText | null;
    keyState: boolean[];
    inputState: boolean[];
    lastPressTimes: number[];
    lastHitTimes: number[]; 
    screenShake: number;
    ringPulse: number;
    rotation: number;
    bassPulse: number;
    notePulse: number;
    rhythmIndex: number;
    musicIntensity: number;
    tick: number;
    hitDeviations: { diff: number, time: number, type: 'perfect' | 'good' | 'bad' }[]; 
    doubleHitCount: number;
    hitSoundBuffer: AudioBuffer | null;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ beatmap, autoPlay, showLinearAssist, enableRecording, noteSpeed, audioOffset, onGameEnd, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  const state = useRef<GameStateRef>({
    startTime: 0,
    isPlaying: false,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    good: 0,
    bad: 0,
    miss: 0,
    processedIndices: new Set<number>(),
    missedIndices: new Set<number>(),
    holdingIndices: new Set<number>(), 
    particles: [],
    geoFlashes: [],
    judgement: null,
    keyState: new Array(8).fill(false),
    inputState: new Array(4).fill(false),
    lastPressTimes: new Array(8).fill(0),
    lastHitTimes: new Array(8).fill(0),
    screenShake: 0,
    ringPulse: 0,
    rotation: 0,
    bassPulse: 1.0,
    notePulse: 1.0,
    rhythmIndex: 0,
    musicIntensity: 0,
    tick: 0,
    hitDeviations: [],
    doubleHitCount: 0,
    hitSoundBuffer: null,
  });

  const [currentStats, setCurrentStats] = useState<GameStats>({
      score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, bad: 0, miss: 0, accuracy: 101
  });

  useEffect(() => {
      if (beatmap.backgroundImage) {
          const img = new Image();
          img.src = beatmap.backgroundImage;
          img.onload = () => { bgImageRef.current = img; };
      }
  }, [beatmap.backgroundImage]);

  useEffect(() => {
    const generateHitSound = async () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const sampleRate = ctx.sampleRate;
            const duration = 0.1; 
            const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
            for (let channel = 0; channel < 2; channel++) {
                const nowBuffering = buffer.getChannelData(channel);
                for (let i = 0; i < buffer.length; i++) {
                    const t = i / sampleRate;
                    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 60);
                    const click = Math.sin(t * 800 * Math.PI * 2) * Math.exp(-t * 100);
                    nowBuffering[i] = (noise * 0.6 + click * 0.4) * 0.8; 
                }
            }
            state.current.hitSoundBuffer = buffer;
            ctx.close();
        } catch (e) { console.error(e); }
    };
    generateHitSound();
  }, []);

  const playHitSound = () => {
    if (!audioContextRef.current || !state.current.hitSoundBuffer) return;
    try {
        const src = audioContextRef.current.createBufferSource();
        src.buffer = state.current.hitSoundBuffer;
        const gain = audioContextRef.current.createGain();
        src.playbackRate.value = 1.0 + (Math.random() * 0.1 - 0.05);
        gain.gain.value = 0.5;
        src.connect(gain);
        gain.connect(audioContextRef.current.destination);
        src.start(0);
    } catch(e) {}
  };

  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      const code = ev.code;
      if (autoPlay || ev.repeat) return;
      const lanes = INPUT_MAPPING[code];
      if (lanes) {
        handleInput(lanes, true);
        const keyIdx = KEY_INDEX_MAP[code];
        if (keyIdx !== undefined) state.current.inputState[keyIdx] = true;
      }
      if (code === 'Escape') onExit();
    };

    const handleKeyUp = (ev: KeyboardEvent) => {
      const code = ev.code;
      if (autoPlay) return; 
      const lanes = INPUT_MAPPING[code];
      if (lanes) {
        handleInput(lanes, false); 
        lanes.forEach(l => state.current.keyState[l] = false);
        const keyIdx = KEY_INDEX_MAP[code];
        if (keyIdx !== undefined) state.current.inputState[keyIdx] = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [autoPlay, audioOffset]);

  const handleInput = (lanes: number[], isDown: boolean) => {
    if (!audioContextRef.current) return;
    const currentTimeMs = (audioContextRef.current.currentTime * 1000) - state.current.startTime - audioOffset;

    if (isDown) {
        let bestHit: { note: HitObject, idx: number, diff: number, absDiff: number } | null = null;
        lanes.forEach(col => {
            const visibleNotes = beatmap.hitObjects.filter((obj, idx) => 
                obj.column === col && 
                !state.current.processedIndices.has(idx) &&
                (obj.time - currentTimeMs) < HIT_WINDOW_BAD
            );
            if (visibleNotes.length > 0) {
                 visibleNotes.sort((a, b) => Math.abs(a.time - currentTimeMs) - Math.abs(b.time - currentTimeMs));
                 const candidate = visibleNotes[0];
                 const diff = candidate.time - currentTimeMs;
                 const absDiff = Math.abs(diff);
                 if (!bestHit || absDiff < bestHit.absDiff) {
                     bestHit = { note: candidate, idx: beatmap.hitObjects.indexOf(candidate), diff, absDiff };
                 }
            }
        });

        const now = performance.now();
        if (bestHit) {
             const { note, idx, diff, absDiff } = bestHit;
             const col = note.column;
             state.current.keyState[col] = true;
             state.current.lastPressTimes[col] = now;
             const timeSinceLastHit = currentTimeMs - state.current.lastHitTimes[col];
             const isJack = timeSinceLastHit < 130 && timeSinceLastHit > 0;

             if (absDiff <= HIT_WINDOW_PERFECT) {
                state.current.processedIndices.add(idx);
                if (note.endTime) state.current.holdingIndices.add(idx);
                registerHit('perfect', col, diff, isJack);
            } else if (absDiff <= HIT_WINDOW_GOOD) {
                state.current.processedIndices.add(idx);
                if (note.endTime) state.current.holdingIndices.add(idx);
                registerHit('good', col, diff, isJack);
            } else if (diff > HIT_WINDOW_GOOD && diff <= HIT_WINDOW_BAD) {
                 state.current.processedIndices.add(idx);
                 if (note.endTime) state.current.holdingIndices.add(idx);
                 registerHit('bad', col, diff, false);
            }
        } else {
             const randomLane = lanes[Math.floor(Math.random() * lanes.length)];
             state.current.keyState[randomLane] = true;
             state.current.lastPressTimes[randomLane] = now;
        }
        detectPatterns(currentTimeMs);
    } else {
        lanes.forEach(col => {
            // Fix: Added explicit type annotation (idx: number) for Set element within Array.from to resolve unknown index type.
            const holdingIdx = Array.from(state.current.holdingIndices).find((idx: number) => beatmap.hitObjects[idx].column === col);
            if (holdingIdx !== undefined) state.current.holdingIndices.delete(holdingIdx);
        });
    }
  };

  const detectPatterns = (currentTimeMs: number) => {
      const recentHits = beatmap.hitObjects.filter((obj, idx) => 
          state.current.processedIndices.has(idx) && 
          Math.abs(obj.time - currentTimeMs) < 40
      );
      // Fix: Added explicit type <number> to Set constructor to ensure correct inference for Array.from.
      const uniqueCols = new Set<number>(recentHits.map(h => h.column));
      if (uniqueCols.size >= 2) {
          // Fix: Added type assertion as number[] to resolve unknown[] assignment error.
          spawnGeometricFlash(Array.from(uniqueCols) as number[]);
      }
  }

  const registerHit = (type: 'perfect' | 'good' | 'bad' | 'miss', col: number, diffMs: number = 0, isJack: boolean = false) => {
    const s = state.current;
    if (type !== 'miss' && type !== 'bad') playHitSound();

    const color = type === 'perfect' ? '#06b6d4' : type === 'good' ? '#2563eb' : type === 'bad' ? '#7dd3fc' : '#94a3b8';
    s.judgement = {
        id: Math.random(),
        text: type === 'perfect' ? 'PERFECT' : type.toUpperCase(),
        color: color,
        time: performance.now(),
        rotation: (Math.random() - 0.5) * 0.1 
    };

    if (type === 'miss') {
      s.combo = 0;
      s.miss++;
      s.screenShake = 3; 
    } else {
      s.combo++;
      if (s.combo > s.maxCombo) s.maxCombo = s.combo;
      if (audioContextRef.current) {
          s.hitDeviations.push({ diff: diffMs, time: audioContextRef.current.currentTime, type: type });
          if (s.hitDeviations.length > 30) s.hitDeviations.shift();
          s.lastHitTimes[col] = (audioContextRef.current.currentTime * 1000) - s.startTime - audioOffset;
      }
      if (type === 'perfect') { 
          s.score += 300; 
          s.perfect++; 
          s.ringPulse = 0.8; 
          s.screenShake = 2;
          spawnParticles(col, 'burst');
          spawnParticles(col, 'spark'); 
      }
      if (type === 'good') { s.score += 100; s.good++; s.ringPulse = 0.4; spawnParticles(col, 'spark'); }
      if (type === 'bad') { s.score += 50; s.bad++; }
      if (isJack) spawnParticles(col, 'fire');
    }
    updateStats();
  };

  const updateStats = () => {
    const s = state.current;
    const currentPoints = (s.perfect * 300) + (s.good * 100) + (s.bad * 50);
    const hitsSoFar = s.perfect + s.good + s.bad + s.miss;
    const maxPointsSoFar = hitsSoFar * 300;
    const accuracy = maxPointsSoFar > 0 ? (currentPoints / maxPointsSoFar) * 101 : 101;
    const totalMapNotes = beatmap.hitObjects.length;
    const maxMapPoints = totalMapNotes * 300;
    const scoreDisplay = maxMapPoints > 0 ? Math.floor((currentPoints / maxMapPoints) * 1010000) : 0;
    setCurrentStats({ score: scoreDisplay, combo: s.combo, maxCombo: s.maxCombo, perfect: s.perfect, good: s.good, bad: s.bad, miss: s.miss, accuracy });
  };

  const spawnParticles = (col: number, type: 'spark' | 'ring' | 'hold' | 'shockwave' | 'fire' | 'burst') => {
    const angles = [-Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*0.75, Math.PI, -Math.PI*0.75];
    const angle = angles[col] + ROTATION_OFFSET;
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const radius = minDim * 0.38;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    if (type === 'shockwave' || type === 'burst') {
        state.current.particles.push(new Particle(x, y, COLORS[col], type));
        if (type === 'burst') return;
    }
    if (type === 'shockwave') return;

    const count = type === 'hold' ? 2 : type === 'fire' ? 8 : 12; 
    for (let i = 0; i < count; i++) {
      state.current.particles.push(new Particle(x, y, COLORS[col], type, angle));
    }
  };

  const spawnGeometricFlash = (cols: number[]) => {
      const angles = [-Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*0.75, Math.PI, -Math.PI*0.75];
      const minDim = Math.min(window.innerWidth, window.innerHeight);
      const radius = minDim * 0.38;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const points = cols.map(col => {
          const angle = angles[col] + ROTATION_OFFSET;
          return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
      });

      let type: 'line' | 'triangle' | 'quad' | 'poly' = 'poly';
      let color = '#1e3a8a'; // Dark Blue default
      if (cols.length === 2) { type = 'line'; color = '#7dd3fc'; state.current.screenShake = 4; }
      else if (cols.length === 3) { type = 'triangle'; color = '#2563eb'; state.current.screenShake = 6; }
      else if (cols.length >= 4) { type = 'quad'; color = '#1e3a8a'; state.current.screenShake = 10; }

      state.current.geoFlashes.push({ points, color, life: 1.0, type });
  }

  useEffect(() => {
    if (!beatmap.audioBuffer) return;
    const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = actx;
    if (actx.state === 'suspended') actx.resume();

    const analyser = actx.createAnalyser();
    analyser.fftSize = 2048; 
    analyserRef.current = analyser;
    const source = actx.createBufferSource();
    source.buffer = beatmap.audioBuffer;
    
    const dest = actx.createMediaStreamDestination();
    source.connect(analyser);
    analyser.connect(actx.destination);
    source.connect(dest);

    if (enableRecording && canvasRef.current) {
        try {
            const canvasStream = canvasRef.current.captureStream(60);
            const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
            const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus', videoBitsPerSecond: 15000000 });
            recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `cycles-clip.webm`; a.click();
                recordedChunksRef.current = [];
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
        } catch (e) { console.error(e); }
    }

    source.onended = () => { 
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
        onGameEnd(currentStats); 
    };
    sourceNodeRef.current = source;
    const startTime = actx.currentTime + 1.2; 
    state.current.startTime = startTime * 1000;
    source.start(startTime);
    state.current.isPlaying = true;
    
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(requestRef.current);
      if (sourceNodeRef.current) try { sourceNodeRef.current.stop(); } catch(e) {}
      if (audioContextRef.current) audioContextRef.current.close();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    };
  }, [beatmap]);

  const gameLoop = () => {
    if (!canvasRef.current || !audioContextRef.current || !uiCanvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const uiCtx = uiCanvasRef.current.getContext('2d');
    if (!ctx || !uiCtx) return;

    const currentTimeMs = (audioContextRef.current.currentTime * 1000) - state.current.startTime - audioOffset;

    if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0; for (let i = 0; i < 40; i++) sum += dataArray[i]; 
        const targetPulse = 1.0 + (sum / 40 / 255) * 0.4;
        state.current.bassPulse += (targetPulse - state.current.bassPulse) * 0.2;
    }

    state.current.notePulse = Math.max(1.0, state.current.notePulse * 0.92);
    state.current.tick += 1;
    state.current.rotation += 0.001 + (state.current.notePulse - 1.0) * 0.01;
    state.current.bassPulse = Math.max(1.0, state.current.bassPulse * 0.96); 

    let shakeX = 0; let shakeY = 0;
    if (state.current.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * state.current.screenShake;
      shakeY = (Math.random() - 0.5) * state.current.screenShake;
      state.current.screenShake *= 0.85; 
    }
    if (state.current.ringPulse > 0) state.current.ringPulse *= 0.95;

    canvasRef.current.width = window.innerWidth;
    canvasRef.current.height = window.innerHeight;
    uiCanvasRef.current.width = window.innerWidth;
    uiCanvasRef.current.height = window.innerHeight;
    
    const cx = canvasRef.current.width / 2 + shakeX;
    const cy = canvasRef.current.height / 2 + shakeY;
    const minDim = Math.min(canvasRef.current.width, canvasRef.current.height);
    const HIT_RADIUS = minDim * 0.38; 
    const CENTER_EMBLEM_RADIUS = minDim * 0.12; 
    const angles: number[] = [-Math.PI/2, -Math.PI/4, 0, Math.PI/4, Math.PI/2, Math.PI*0.75, Math.PI, -Math.PI*0.75];

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Background Image
    if (bgImageRef.current) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(state.current.rotation * 0.3 + ROTATION_OFFSET); 
        ctx.globalAlpha = 0.1; 
        const scale = Math.max(canvasRef.current.width / bgImageRef.current.width, canvasRef.current.height / bgImageRef.current.height);
        ctx.drawImage(bgImageRef.current, -bgImageRef.current.width * scale / 2, -bgImageRef.current.height * scale / 2, bgImageRef.current.width * scale, bgImageRef.current.height * scale);
        ctx.restore();
    }

    // Hexagon Grid
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.current.rotation + ROTATION_OFFSET);
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for(let r=100; r<1000; r+=150) {
        ctx.beginPath();
        for(let i=0; i<=6; i++) { 
            const a = (i/6) * Math.PI * 2;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
    ctx.restore();

    // Lasers
    state.current.keyState.forEach((isDown, i) => {
        if (isDown) {
            const a = angles[i] + ROTATION_OFFSET;
            const grad = ctx.createLinearGradient(cx + Math.cos(a) * CENTER_EMBLEM_RADIUS, cy + Math.sin(a) * CENTER_EMBLEM_RADIUS, cx + Math.cos(a) * 1000, cy + Math.sin(a) * 1000);
            grad.addColorStop(0, `${COLORS[i]}44`);
            grad.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * CENTER_EMBLEM_RADIUS, cy + Math.sin(a) * CENTER_EMBLEM_RADIUS);
            ctx.lineTo(cx + Math.cos(a) * 1000, cy + Math.sin(a) * 1000);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 40;
            ctx.stroke();
        }
    });

    // Hit Circle
    ctx.beginPath();
    ctx.arc(cx, cy, HIT_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.stroke();
    if (state.current.ringPulse > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, HIT_RADIUS + state.current.ringPulse * 20, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(14, 165, 233, ${state.current.ringPulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Center Disc
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.current.rotation);
    ctx.beginPath();
    ctx.arc(0, 0, CENTER_EMBLEM_RADIUS * state.current.bassPulse, 0, Math.PI * 2);
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Receptors
    angles.forEach((baseAngle, idx) => {
        const angle = baseAngle + ROTATION_OFFSET;
        const rx = cx + Math.cos(angle) * HIT_RADIUS;
        const ry = cy + Math.sin(angle) * HIT_RADIUS;
        const isPressed = state.current.keyState[idx];
        ctx.beginPath();
        ctx.arc(rx, ry, isPressed ? 24 : 18, 0, Math.PI * 2);
        ctx.fillStyle = isPressed ? COLORS[idx] : '#f8fafc';
        ctx.fill();
        ctx.strokeStyle = isPressed ? '#fff' : COLORS[idx];
        ctx.lineWidth = 3;
        ctx.stroke();
    });

    // Notes
    const visibleNotes = beatmap.hitObjects.filter(obj => {
      const idx = beatmap.hitObjects.indexOf(obj);
      if (state.current.processedIndices.has(idx) && !state.current.holdingIndices.has(idx)) return false;
      return obj.time >= currentTimeMs - 200 && obj.time <= currentTimeMs + (noteSpeed * 1000);
    });

    visibleNotes.forEach(obj => {
       const idx = beatmap.hitObjects.indexOf(obj);
       const timeUntilHit = obj.time - currentTimeMs;
       const progress = 1 - (timeUntilHit / (noteSpeed * 1000));
       if (progress < 0) return;
       
       if (!state.current.processedIndices.has(idx) && timeUntilHit < -HIT_WINDOW_BAD) {
           state.current.processedIndices.add(idx);
           registerHit('miss', obj.column);
           return;
       }

       const angle = angles[obj.column] + ROTATION_OFFSET;
       const travelDist = HIT_RADIUS - CENTER_EMBLEM_RADIUS;
       const currentDist = CENTER_EMBLEM_RADIUS + (progress * travelDist);
       const nx = cx + Math.cos(angle) * currentDist;
       const ny = cy + Math.sin(angle) * currentDist;

       ctx.save();
       ctx.globalAlpha = Math.min(1, progress * 4);
       if (obj.endTime) {
           const tailProgress = 1 - ((obj.endTime - currentTimeMs) / (noteSpeed * 1000));
           const tailDist = CENTER_EMBLEM_RADIUS + (tailProgress * travelDist);
           const tx = cx + Math.cos(angle) * tailDist;
           const ty = cy + Math.sin(angle) * tailDist;
           ctx.beginPath();
           ctx.moveTo(nx, ny);
           ctx.lineTo(tx, ty);
           ctx.strokeStyle = COLORS[obj.column];
           ctx.lineWidth = 14;
           ctx.lineCap = 'round';
           ctx.stroke();
           ctx.strokeStyle = '#fff';
           ctx.lineWidth = 4;
           ctx.stroke();
       } else if (!state.current.processedIndices.has(idx)) {
           ctx.beginPath();
           ctx.arc(nx, ny, 14, 0, Math.PI * 2);
           ctx.fillStyle = COLORS[obj.column];
           ctx.fill();
           ctx.strokeStyle = '#fff';
           ctx.lineWidth = 2;
           ctx.stroke();
       }
       ctx.restore();
    });

    // Chord Lines & Flashes
    const chordGroups = new Map<number, HitObject[]>();
    visibleNotes.forEach(n => {
        if (!state.current.processedIndices.has(beatmap.hitObjects.indexOf(n))) {
            const t = Math.round(n.time / 5) * 5;
            if (!chordGroups.has(t)) chordGroups.set(t, []);
            chordGroups.get(t)!.push(n);
        }
    });
    chordGroups.forEach(group => {
        if (group.length >= 2) { group.sort((a,b) => a.column - b.column);
            ctx.beginPath();
            group.forEach((obj, i) => {
                const angle = angles[obj.column] + ROTATION_OFFSET;
                const progress = 1 - ((obj.time - currentTimeMs) / (noteSpeed * 1000));
                const dist = CENTER_EMBLEM_RADIUS + progress * (HIT_RADIUS - CENTER_EMBLEM_RADIUS);
                const px = cx + Math.cos(angle) * dist;
                const py = cy + Math.sin(angle) * dist;
                if (i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
            ctx.strokeStyle = group.length === 2 ? '#7dd3fc' : group.length === 3 ? '#2563eb' : '#1e3a8a';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    state.current.geoFlashes.forEach((f, idx) => {
        if (f.life <= 0) { state.current.geoFlashes.splice(idx, 1); return; }
        ctx.save();
        ctx.beginPath();
        f.points.forEach((p, i) => { if (i===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.closePath();
        ctx.globalAlpha = f.life * 0.3;
        ctx.fillStyle = f.color;
        ctx.fill();
        ctx.globalAlpha = f.life;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = f.type === 'quad' ? 6 : 2;
        ctx.stroke();
        f.life -= 0.05;
        ctx.restore();
    });

    state.current.particles.forEach((p, i) => {
        p.update(); p.draw(ctx);
        if (p.life <= 0) state.current.particles.splice(i, 1);
    });

    // HUD
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 32px Rajdhani';
    ctx.fillText(state.current.score.toLocaleString().padStart(7,'0'), 40, 60);
    ctx.font = 'bold 20px Rajdhani';
    ctx.fillText(`${state.current.combo} COMBO`, 40, 90);
    
    if (state.current.judgement) {
        const j = state.current.judgement;
        const age = performance.now() - j.time;
        if (age < 500) {
            ctx.save();
            ctx.translate(cx, cy - 80);
            ctx.globalAlpha = 1 - (age / 500);
            ctx.font = 'bold 40px Rajdhani';
            ctx.fillStyle = j.color;
            ctx.textAlign = 'center';
            ctx.fillText(j.text, 0, 0);
            ctx.restore();
        }
    }

    uiCtx.clearRect(0, 0, uiCanvasRef.current.width, uiCanvasRef.current.height);
    if (showLinearAssist) drawLinearAssist(uiCtx, uiCanvasRef.current.width, uiCanvasRef.current.height, currentTimeMs, visibleNotes);

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const drawLinearAssist = (ctx: CanvasRenderingContext2D, width: number, height: number, currentTimeMs: number, notes: HitObject[]) => {
      const LANE_W = 20; const TRACK_H = 150;
      const START_X = width - (LANE_W * 4) - 40;
      const START_Y = height - TRACK_H - 40;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(START_X, START_Y, LANE_W * 4, TRACK_H);
      for(let i=0; i<4; i++) {
          ctx.strokeStyle = '#e2e8f0';
          ctx.strokeRect(START_X + i * LANE_W, START_Y, LANE_W, TRACK_H);
          if (state.current.inputState[i]) { ctx.fillStyle = LINEAR_COLORS[i]; ctx.fillRect(START_X + i * LANE_W, START_Y + TRACK_H - 4, LANE_W, 4); }
      }
      notes.forEach(n => {
          const lCol = RADIAL_TO_LINEAR_MAP[n.column];
          const progress = 1 - ((n.time - currentTimeMs) / (noteSpeed * 1000));
          if (progress < 0 || progress > 1) return;
          ctx.fillStyle = LINEAR_COLORS[lCol];
          ctx.fillRect(START_X + lCol * LANE_W + 2, START_Y + progress * TRACK_H - 2, LANE_W - 4, 4);
      });
  }

  return (
    <div className="relative w-full h-full bg-white overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 z-10 w-full h-full" />
      <canvas ref={uiCanvasRef} className="absolute inset-0 z-20 w-full h-full pointer-events-none" />
      {autoPlay && <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-sky-500 text-white px-4 py-1 rounded-full text-xs font-bold z-30 tracking-widest">AUTOPLAY ON</div>}
    </div>
  );
};

export default GameCanvas;
