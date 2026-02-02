
import JSZip from 'https://esm.sh/jszip@3.10.1';
import { BeatmapData, HitObject, COLUMNS } from '../types';

interface TimingPoint {
  time: number;
  beatLength: number;
  uninherited: boolean;
}

export const parseOSZ = async (file: File): Promise<BeatmapData> => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  // Find .osu file
  const osuFile = Object.keys(loadedZip.files).find(filename => filename.endsWith('.osu'));
  
  if (!osuFile) {
    throw new Error("No .osu file found in the archive.");
  }

  const osuContent = await loadedZip.file(osuFile)?.async('string');
  if (!osuContent) throw new Error("Could not read .osu file.");

  const data = parseOsuText(osuContent);

  // Load Audio
  const audioFile = Object.keys(loadedZip.files).find(filename => 
    filename.toLowerCase() === data.audioFilename.toLowerCase()
  );

  if (audioFile) {
    const audioBlob = await loadedZip.file(audioFile)?.async('blob');
    if (audioBlob) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      data.audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    }
  }

  // Load Background Image
  if (data.backgroundImage) {
      const bgFilename = data.backgroundImage;
      const bgFile = Object.keys(loadedZip.files).find(filename => 
          filename.toLowerCase() === bgFilename.toLowerCase()
      );
      if (bgFile) {
          const bgBlob = await loadedZip.file(bgFile)?.async('blob');
          if (bgBlob) {
              data.backgroundImage = URL.createObjectURL(bgBlob);
          } else {
              data.backgroundImage = undefined;
          }
      } else {
          data.backgroundImage = undefined;
      }
  }

  // Assign a unique ID
  data.id = `${data.title}-${Date.now()}`;

  return data;
};

const parseOsuText = (text: string): BeatmapData => {
  const lines = text.split('\n');
  let section = '';
  
  const data: BeatmapData = {
    id: '',
    title: 'Unknown',
    artist: 'Unknown',
    creator: 'Unknown',
    version: 'Normal',
    audioFilename: '',
    hitObjects: [],
    bpm: 120, // Default
  };

  let circleSize = 4;
  const timingPoints: TimingPoint[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('//')) continue;
    
    if (line.startsWith('[')) {
      section = line.slice(1, -1);
      continue;
    }

    if (section === 'General') {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key === 'AudioFilename') data.audioFilename = value;
    } else if (section === 'Metadata') {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key === 'Title') data.title = value;
      if (key === 'Artist') data.artist = value;
      if (key === 'Creator') data.creator = value;
      if (key === 'Version') data.version = value;
    } else if (section === 'Difficulty') {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key === 'CircleSize') circleSize = parseInt(value);
    } else if (section === 'Events') {
      if (line.startsWith('0,0,')) {
         const parts = line.split(',');
         if (parts.length >= 3) {
             let bgName = parts[2];
             if (bgName.startsWith('"') && bgName.endsWith('"')) {
                 bgName = bgName.slice(1, -1);
             }
             if (!data.backgroundImage && bgName.match(/\.(jpg|jpeg|png)$/i)) {
                 data.backgroundImage = bgName;
             }
         }
      }
    } else if (section === 'TimingPoints') {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const time = parseFloat(parts[0]);
            const beatLength = parseFloat(parts[1]);
            const uninherited = parts.length >= 7 ? parts[6] !== '0' : true;
            
            timingPoints.push({ time, beatLength, uninherited });
        }
    } else if (section === 'HitObjects') {
      const parts = line.split(',');
      const x = parseInt(parts[0]);
      const y = parseInt(parts[1]);
      const time = parseInt(parts[2]);
      const type = parseInt(parts[3]);
      const hitSound = parseInt(parts[4]);
      
      // Calculate 4k column index (0-3)
      let column = Math.floor(x * circleSize / 512);
      
      // QUADRANT MAPPING for 4K -> 8K Radial
      // F (TL): [6, 7], D (BL): [5, 4], J (TR): [0, 1], K (BR): [2, 3]
      if (circleSize === 4) {
          const snap = Math.floor(time / 20); 
          const variance = (snap + column) % 2;
          
          if (column === 0) column = variance === 0 ? 5 : 4;      // D (Bottom-Left quadrant)
          else if (column === 1) column = variance === 0 ? 6 : 7; // F (Top-Left quadrant)
          else if (column === 2) column = variance === 0 ? 0 : 1; // J (Top-Right quadrant)
          else if (column === 3) column = variance === 0 ? 2 : 3; // K (Bottom-Right quadrant)
      }
      
      const clampedColumn = Math.max(0, Math.min(column, 7)); 

      let endTime = undefined;
      if ((type & 128) > 0) {
        const extraParts = parts[5].split(':');
        endTime = parseInt(extraParts[0]);
      }

      data.hitObjects.push({
        x, y, time, type, hitSound, endTime, column: clampedColumn
      });
    }
  }

  data.hitObjects.sort((a, b) => a.time - b.time);

  if (timingPoints.length > 0) {
      const bpmCounts: {[key: number]: number} = {};
      const lastObjTime = data.hitObjects[data.hitObjects.length - 1]?.time || 0;
      const redPoints = timingPoints.filter(tp => tp.uninherited && tp.beatLength > 0);
      
      if (redPoints.length > 0) {
        redPoints.sort((a, b) => a.time - b.time);
        for (let i = 0; i < redPoints.length; i++) {
            const pt = redPoints[i];
            const nextTime = (i === redPoints.length - 1) ? lastObjTime : redPoints[i+1].time;
            const duration = Math.max(0, nextTime - pt.time);
            const roundedBL = Math.round(pt.beatLength * 10) / 10;
            if (roundedBL > 0) {
                 bpmCounts[roundedBL] = (bpmCounts[roundedBL] || 0) + duration;
            }
        }
        let maxDur = -1;
        let mainBeatLength = 500;
        for (const [bl, dur] of Object.entries(bpmCounts)) {
            if (dur > maxDur) {
                maxDur = dur;
                mainBeatLength = parseFloat(bl);
            }
        }
        if (mainBeatLength > 0) {
            data.bpm = Math.round(60000 / mainBeatLength);
        }
      }
  }

  return data;
};

export const generateDemoTrack = async (): Promise<BeatmapData> => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const duration = 60; 
    const bpm = 120;
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(2, sampleRate * duration, sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < buffer.length; i++) {
             const t = i / sampleRate;
             const bass = Math.sin(t * 100 * Math.PI * 2) * Math.exp(-(t % 0.5) * 5);
             const high = Math.random() * 0.1 * Math.exp(-(t % 0.25) * 10);
             channelData[i] = (bass + high) * 0.5;
        }
    }

    const hitObjects: HitObject[] = [];
    const beatInterval = 60000 / bpm;
    
    for (let t = 2000; t < duration * 1000; t += beatInterval / 2) {
        if (Math.random() > 0.3) {
            const col = Math.floor(Math.random() * 8);
            const isHold = Math.random() > 0.8;
            hitObjects.push({
                x: 0, y: 0, 
                time: t, 
                type: isHold ? 128 : 1, 
                hitSound: 0, 
                column: col,
                endTime: isHold ? t + beatInterval : undefined
            });
        }
    }

    return {
        id: `demo-${Date.now()}`,
        title: "Neon Pulse (Procedural 8K)",
        artist: "System AI",
        creator: "Generated",
        version: "Infinite",
        audioFilename: "generated.wav",
        hitObjects: hitObjects,
        audioBuffer: buffer,
        bpm: 120
    };
}
