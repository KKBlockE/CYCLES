export interface HitObject {
  x: number;
  y: number;
  time: number;
  type: number;
  hitSound: number;
  endTime?: number; // For hold notes
  column: number;
}

export interface BeatmapData {
  id: string; // Unique Identifier for library
  title: string;
  artist: string;
  creator: string;
  version: string;
  audioFilename: string;
  hitObjects: HitObject[];
  audioBuffer?: AudioBuffer;
  backgroundImage?: string;
  bpm: number; // Calculated main BPM
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  good: number;
  bad: number;
  miss: number;
  accuracy: number;
}

export enum GameState {
  MENU,
  LOADING,
  PLAYING,
  RESULTS
}

export const KEYS = ['KeyS', 'KeyD', 'KeyF', 'Space', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
export const COLUMNS = 8;