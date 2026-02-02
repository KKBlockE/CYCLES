import React, { useState, useEffect, useRef } from 'react';
import { GameState, BeatmapData, GameStats } from './types';
import { parseOSZ, generateDemoTrack } from './utils/osuParser';
import GameCanvas from './components/GameCanvas';
import { Music, Upload, Trophy, Settings, ChevronLeft, ChevronRight, X, Volume2, Gauge, Zap, Disc, Video, Star, User, Hash, Crown, Play, Search } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  
  // Library Management
  const [library, setLibrary] = useState<BeatmapData[]>([]);
  const [selectedSongIndex, setSelectedSongIndex] = useState<number>(0);
  
  // Stats
  const [stats, setStats] = useState<GameStats | null>(null);
  
  // System
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Game Settings
  const [autoPlay, setAutoPlay] = useState(false);
  const [showLinearAssist, setShowLinearAssist] = useState(false);
  const [enableRecording, setEnableRecording] = useState(false);
  const [noteSpeed, setNoteSpeed] = useState(0.8);
  const [audioOffset, setAudioOffset] = useState(0);

  // Mock Player Data
  const [playerLevel, setPlayerLevel] = useState(15);
  const [playerRating, setPlayerRating] = useState(12450);

  // Refs for scrolling
  const songListRef = useRef<HTMLDivElement>(null);

  // Initialize with a demo track if library is empty
  useEffect(() => {
     if (library.length === 0) {
         generateDemoTrack().then(demo => {
             setLibrary([demo]);
         });
     }
  }, []);

  // Auto-scroll to selected song
  useEffect(() => {
      if (gameState === GameState.MENU && songListRef.current) {
          const selectedEl = songListRef.current.children[selectedSongIndex] as HTMLElement;
          if (selectedEl) {
              selectedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
  }, [selectedSongIndex, gameState]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setError(null);
    
    try {
      const newSongs: BeatmapData[] = [];
      for (let i = 0; i < files.length; i++) {
          const data = await parseOSZ(files[i]);
          newSongs.push(data);
      }
      setLibrary(prev => [...prev, ...newSongs]);
      setSelectedSongIndex(library.length + newSongs.length - 1);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = () => {
      if (library[selectedSongIndex]) {
          setGameState(GameState.PLAYING);
      }
  };

  const handleGameEnd = (finalStats: GameStats) => {
    setStats(finalStats);
    setGameState(GameState.RESULTS);
    if (finalStats.accuracy > 90) {
        setPlayerRating(prev => prev + Math.floor(finalStats.score / 10000));
    }
  };

  const returnToMenu = () => {
    setGameState(GameState.MENU);
    setStats(null);
  };

  const currentSong = library[selectedSongIndex];

  // Helper to determine mock difficulty
  const getDifficultyInfo = (song: BeatmapData) => {
      const density = song.hitObjects.length; 
      if (density < 200) return { label: 'EZY', color: 'bg-green-400', active: 0, level: 3 };
      if (density < 400) return { label: 'NOR', color: 'bg-blue-400', active: 1, level: 7 };
      if (density < 800) return { label: 'HAD', color: 'bg-yellow-400', active: 2, level: 11 };
      if (density < 1200) return { label: 'EXP', color: 'bg-red-500', active: 3, level: 14 };
      return { label: 'EXT', color: 'bg-purple-500', active: 4, level: 16 };
  };

  const currentDiff = currentSong ? getDifficultyInfo(currentSong) : { label: 'EZY', color: 'bg-green-400', active: 0, level: 1 };

  return (
    <div className="w-full h-screen relative overflow-hidden font-sans select-none bg-sky-50 text-slate-800">
      
      {/* --- GLOBAL BACKGROUND (Light/Bright Mode) --- */}
      {gameState !== GameState.PLAYING && (
        <>
            <div className="arcade-bg opacity-60"></div>
            
            {/* Soft Gradients for brightness */}
            <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-white via-white/80 to-transparent z-0"></div>
            <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-white via-white/80 to-transparent z-0"></div>
            
            {/* Dynamic Background Image - Very subtle and blended */}
            {currentSong?.backgroundImage && (
                <div 
                    className="absolute inset-0 z-[-1] bg-cover bg-center transition-all duration-700 ease-in-out opacity-20 blur-sm scale-110 mix-blend-multiply"
                    style={{ backgroundImage: `url(${currentSong.backgroundImage})` }}
                />
            )}
            
            {/* Animated Decor */}
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-tr from-sky-100/50 to-pink-100/50 -z-10"></div>
        </>
      )}

      {/* --- HEADER --- */}
      {gameState !== GameState.PLAYING && (
        <header className="absolute top-0 left-0 w-full h-24 z-50 pointer-events-none">
            
            {/* Logo (Top Left) - Bright */}
            <div className="absolute top-6 left-8 pointer-events-auto">
                 <div className="flex items-center gap-3">
                     <div className="bg-white p-2 rounded-xl shadow-lg border border-sky-100 transform -rotate-3">
                        <Music className="text-pink-500" size={28} />
                     </div>
                     <div>
                        <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-pink-500 drop-shadow-sm">
                            CYCLES
                        </h1>
                        <div className="text-[10px] font-bold text-sky-400 tracking-[0.3em] uppercase ml-1">Rhythm Game</div>
                     </div>
                 </div>
            </div>

            {/* PLAYER SLOT (Top Center) - Bright & Float */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
                 <div className="bg-white/80 backdrop-blur-xl border border-white/60 px-8 py-2 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.05)] flex items-center gap-6 relative group hover:scale-105 transition-transform duration-300">
                     
                     {/* Level Badge */}
                     <div className="absolute -left-3 top-1/2 -translate-y-1/2 bg-gradient-to-br from-yellow-400 to-orange-500 text-white w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-md border-2 border-white">
                         {playerLevel}
                     </div>

                     <div className="pl-6 flex flex-col items-center">
                         <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Guest Player</div>
                         <div className="flex items-baseline gap-1">
                             <span className="font-black text-2xl text-slate-800 font-num tracking-tight">{playerRating.toLocaleString()}</span>
                             <span className="text-[10px] font-bold text-sky-500 bg-sky-100 px-1.5 rounded">PP</span>
                         </div>
                     </div>

                     <div className="w-px h-8 bg-gray-200"></div>

                     <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border-2 border-sky-200">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Guest`} alt="Avatar" className="w-full h-full" />
                     </div>
                 </div>
            </div>

            {/* Settings (Top Right) */}
            <div className="absolute top-6 right-8 pointer-events-auto">
                 <button 
                    onClick={() => setShowSettings(true)}
                    className="bg-white hover:bg-sky-50 text-slate-600 p-3 rounded-2xl shadow-lg border border-sky-100 transition-all hover:rotate-45 active:scale-95"
                 >
                     <Settings size={24} />
                 </button>
            </div>
        </header>
      )}

      {/* --- MENU STATE (Song Select) --- */}
      {gameState === GameState.MENU && (
        <main className="relative z-10 w-full h-full pt-28 pb-4 flex overflow-hidden">
            
            {loading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-md z-[100] flex items-center justify-center">
                    <div className="flex flex-col items-center animate-bounce">
                        <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mb-4 shadow-lg">
                            <Upload size={32} className="text-sky-500" />
                        </div>
                        <span className="font-black text-2xl text-slate-700 tracking-widest">LOADING BEATMAPS...</span>
                    </div>
                </div>
            )}

            {/* LEFT SIDE: Active Song Details (Bright & Clean) */}
            <div className="w-[55%] h-full flex flex-col justify-center pl-16 pr-8 relative">
                 
                 {library.length > 0 ? (
                    <div className="flex flex-col gap-8 w-full max-w-2xl animate-in slide-in-from-bottom-10 duration-500">
                        
                        {/* Song Header */}
                        <div>
                            <div className="flex items-center gap-3 mb-2 opacity-70">
                                <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded tracking-widest">NOW PLAYING</span>
                                <div className="h-px w-20 bg-slate-300"></div>
                            </div>
                            <h1 className="text-6xl md:text-7xl font-black text-slate-800 italic tracking-tighter leading-[0.9] drop-shadow-sm line-clamp-2">
                                {currentSong.title}
                            </h1>
                            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-pink-500 mt-2 tracking-wide uppercase truncate">
                                {currentSong.artist}
                            </h2>
                        </div>

                        {/* Stats / Info Bar */}
                        <div className="flex gap-4">
                            {/* BPM Display */}
                            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-100 flex flex-col min-w-[100px]">
                                <span className="text-[10px] font-bold text-gray-400">BPM</span>
                                <span className="font-bold text-slate-700 text-sm font-num">{currentSong.bpm}</span>
                            </div>
                            {/* Version Display */}
                            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-100 flex flex-col flex-1">
                                <span className="text-[10px] font-bold text-gray-400">VERSION</span>
                                <span className="font-bold text-slate-700 text-sm truncate">{currentSong.version}</span>
                            </div>
                        </div>

                        {/* Main Content Area: Jacket + Difficulty */}
                        <div className="flex items-stretch gap-6 h-56">
                            
                            {/* Jacket Art */}
                            <div className="h-full aspect-square rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] overflow-hidden border-4 border-white relative group">
                                {currentSong.backgroundImage ? (
                                     <img src={currentSong.backgroundImage} alt="bg" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                 ) : (
                                     <div className="w-full h-full bg-gradient-to-br from-gray-100 to-white flex items-center justify-center">
                                         <Music size={64} className="text-gray-200" />
                                     </div>
                                 )}
                            </div>

                            {/* Right of Jacket: Scores & Play */}
                            <div className="flex-1 flex flex-col justify-between">
                                
                                {/* Personal Best Block */}
                                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex-1 mb-4 flex justify-between items-center relative overflow-hidden">
                                    <div className="absolute right-0 top-0 p-4 opacity-5">
                                        <Trophy size={80} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-1">Personal Best</div>
                                        <div className="text-4xl font-black text-slate-800 font-num tracking-tight">000,000</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-5xl font-black italic text-gray-200 font-num">--</div>
                                    </div>
                                </div>

                                {/* Difficulty Pill */}
                                <div className={`${currentDiff.color} p-4 rounded-2xl shadow-md text-slate-900 flex justify-between items-center transform transition-transform hover:scale-[1.02]`}>
                                    <div className="flex flex-col leading-none">
                                        <span className="font-black text-2xl tracking-tighter">{currentDiff.label}</span>
                                        <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Difficulty</span>
                                    </div>
                                    <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full font-black text-lg shadow-sm">
                                        Lv.{currentDiff.level}
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* START BUTTON */}
                        <div className="flex gap-4">
                            <button 
                                onClick={handleStartGame}
                                className="flex-1 h-20 bg-gradient-to-r from-sky-500 to-blue-600 rounded-full shadow-[0_10px_30px_rgba(14,165,233,0.3)] hover:shadow-[0_15px_40px_rgba(14,165,233,0.4)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 text-white group"
                            >
                                <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition-colors">
                                    <Play size={28} fill="white" className="ml-1" />
                                </div>
                                <span className="font-black text-3xl italic tracking-widest pr-2">START GAME</span>
                            </button>
                            
                            <label className="h-20 w-20 bg-white hover:bg-gray-50 rounded-full shadow-lg border-2 border-slate-100 cursor-pointer flex items-center justify-center text-slate-400 hover:text-sky-500 transition-all active:scale-90 group">
                                <Upload size={28} className="group-hover:-translate-y-1 transition-transform" />
                                <input type="file" accept=".osz" multiple onChange={handleFileUpload} className="hidden" />
                            </label>
                        </div>

                    </div>
                 ) : (
                    <div className="flex flex-col items-start gap-6 opacity-60">
                        <div className="h-px w-24 bg-slate-300"></div>
                        <h1 className="text-6xl font-black text-slate-300">EMPTY<br/>LIBRARY</h1>
                        <p className="text-lg text-slate-500 max-w-md">
                            Drag & drop <strong>.osz</strong> files anywhere or click the button below to get started.
                        </p>
                        <label className="cursor-pointer bg-slate-800 text-white px-8 py-4 rounded-full font-bold flex items-center gap-3 hover:bg-slate-700 transition-colors shadow-xl">
                            <Upload size={20} />
                            <span>IMPORT BEATMAPS</span>
                            <input type="file" accept=".osz" multiple onChange={handleFileUpload} className="hidden" />
                        </label>
                    </div>
                 )}
            </div>

            {/* RIGHT SIDE: Song Wheel (Bright Osu Style) */}
            <div className="w-[45%] h-full relative">
                
                {/* Search Bar / Sort (Top of list) */}
                <div className="absolute top-0 right-0 w-full pr-8 flex justify-end items-center h-16 z-20 pointer-events-none">
                     <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-sm border border-slate-200 flex items-center gap-2 pointer-events-auto text-slate-400">
                         <Search size={16} />
                         <span className="text-xs font-bold tracking-widest">SORT: DATE</span>
                     </div>
                </div>

                <div className="w-full h-full overflow-y-auto pl-4 pr-0 no-scrollbar scroll-smooth py-24" ref={songListRef}>
                    <div className="flex flex-col gap-3 items-end pr-4">
                        {library.map((song, idx) => {
                            const isSelected = selectedSongIndex === idx;
                            const diffInfo = getDifficultyInfo(song);
                            
                            return (
                                <div 
                                    key={song.id}
                                    onClick={() => setSelectedSongIndex(idx)}
                                    className={`
                                        group cursor-pointer transition-all duration-300 ease-out transform
                                        flex relative overflow-hidden rounded-l-2xl shadow-sm
                                        ${isSelected 
                                            ? 'w-[105%] h-36 bg-gradient-to-r from-sky-500 to-blue-600 -mr-4 z-10 translate-x-0 shadow-2xl' 
                                            : 'w-[90%] h-24 bg-white hover:bg-gray-50 border border-slate-100 translate-x-4 opacity-90 hover:opacity-100 hover:translate-x-0'}
                                    `}
                                >
                                    {/* Decor Bar Left */}
                                    <div className={`w-3 shrink-0 ${diffInfo.color} h-full ${isSelected ? 'shadow-[0_0_20px_rgba(255,255,255,0.5)]' : ''}`}></div>

                                    {/* Content */}
                                    <div className="flex-1 flex flex-col justify-center pl-4 pr-6 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className={`font-black truncate text-xl leading-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                                    {song.title}
                                                </h3>
                                                <p className={`text-sm font-bold truncate ${isSelected ? 'text-sky-100 mt-1' : 'text-gray-400 mt-0.5'}`}>
                                                    {song.artist}
                                                </p>
                                            </div>
                                            
                                            {/* Tags (Active Only) */}
                                            {isSelected && (
                                                <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                                    <div className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                                                        {diffInfo.label}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {isSelected && (
                                            <div className="flex gap-3 mt-4 opacity-90">
                                                <div className="flex items-center gap-1 text-white text-xs font-bold bg-black/20 px-2 py-1 rounded">
                                                    <Star size={10} fill="white" /> {diffInfo.level}
                                                </div>
                                                <div className="flex items-center gap-1 text-white text-xs font-bold bg-black/20 px-2 py-1 rounded">
                                                    <Hash size={10} /> BPM {song.bpm}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Background Image for Card (Subtle) */}
                                    {song.backgroundImage && (
                                        <div className={`absolute inset-0 z-[-1] pointer-events-none transition-opacity duration-300 ${isSelected ? 'opacity-30 mix-blend-overlay' : 'opacity-10 grayscale'}`}>
                                            <img src={song.backgroundImage} className="w-full h-full object-cover" alt="" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        
                        {/* Empty State Spacer */}
                        {library.length === 0 && (
                            <div className="h-full w-full flex items-center justify-center opacity-20 pr-12">
                                <span className="font-bold text-2xl tracking-widest rotate-90 text-slate-400">SONG LIST</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </main>
      )}

      {/* --- PLAYING STATE --- */}
      {gameState === GameState.PLAYING && currentSong && (
        <div className="absolute inset-0 z-50 bg-black">
             <GameCanvas 
                beatmap={currentSong} 
                autoPlay={autoPlay}
                showLinearAssist={showLinearAssist}
                enableRecording={enableRecording}
                noteSpeed={noteSpeed}
                audioOffset={audioOffset}
                onGameEnd={handleGameEnd} 
                onExit={returnToMenu}
             />
        </div>
      )}

      {/* --- RESULTS STATE --- */}
      {gameState === GameState.RESULTS && stats && (
         <main className="relative z-20 w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-300 bg-white/50 backdrop-blur-sm">
             
             {/* Results Card */}
             <div className="bg-white border border-white/50 p-8 rounded-[3rem] shadow-2xl max-w-3xl w-full relative overflow-hidden">
                 {/* Decorative background stripes */}
                 <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-pink-500 via-yellow-400 to-sky-500"></div>
                 
                 <div className="text-center mb-8 mt-4">
                     <h2 className="text-sky-500 font-bold tracking-[0.2em] uppercase mb-2">Result</h2>
                     <div className="text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-pink-500 to-purple-600 drop-shadow-sm font-num">
                        {stats.accuracy >= 98 ? 'SSS' : stats.accuracy >= 95 ? 'S' : stats.accuracy >= 90 ? 'A' : stats.accuracy >= 80 ? 'B' : 'C'}
                     </div>
                     <div className="text-2xl font-bold text-gray-400 mt-2 font-num">{stats.accuracy.toFixed(2)}%</div>
                 </div>

                 <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'PERFECT', val: stats.perfect, color: 'text-sky-500', bg: 'bg-sky-50' },
                        { label: 'GOOD', val: stats.good, color: 'text-green-500', bg: 'bg-green-50' },
                        { label: 'BAD', val: stats.bad, color: 'text-yellow-500', bg: 'bg-yellow-50' },
                        { label: 'MISS', val: stats.miss, color: 'text-red-500', bg: 'bg-red-50' },
                    ].map(s => (
                        <div key={s.label} className={`${s.bg} rounded-2xl p-4 flex flex-col items-center shadow-sm`}>
                             <span className={`font-black text-3xl font-num ${s.color}`}>{s.val}</span>
                             <span className="text-xs font-bold text-gray-400">{s.label}</span>
                        </div>
                    ))}
                 </div>
                 
                 <div className="flex justify-between items-center bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                     <div>
                         <div className="text-xs font-bold text-gray-400 uppercase">Total Score</div>
                         <div className="text-4xl font-black text-slate-700 font-num">{stats.score.toLocaleString()}</div>
                     </div>
                     <div className="text-right">
                         <div className="text-xs font-bold text-gray-400 uppercase">Max Combo</div>
                         <div className="text-4xl font-black text-pink-500 font-num">{stats.maxCombo}</div>
                     </div>
                 </div>

                 <button 
                    onClick={returnToMenu}
                    className="w-full py-4 bg-sky-500 text-white font-bold text-xl rounded-2xl hover:bg-sky-400 shadow-lg shadow-sky-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                     <Trophy className="animate-bounce" />
                     CONTINUE
                 </button>
             </div>
         </main>
      )}

      {/* --- SETTINGS MODAL --- */}
      {showSettings && (
          <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-200 text-slate-800">
                  <div className="bg-sky-100 p-6 flex justify-between items-center border-b-2 border-sky-200">
                      <h2 className="text-2xl font-black text-sky-600 flex items-center gap-2">
                          <Settings className="animate-spin-slow" /> GAME OPTIONS
                      </h2>
                      <button onClick={() => setShowSettings(false)} className="p-2 bg-white rounded-full text-gray-400 hover:text-red-500 transition-colors">
                          <X size={24} strokeWidth={3} />
                      </button>
                  </div>

                  <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                      
                      {/* Speed */}
                      <div className="space-y-3">
                          <div className="flex justify-between font-bold text-gray-600">
                              <span className="flex items-center gap-2"><Gauge size={20}/> NOTE SPEED</span>
                              <span className="text-sky-500 font-num text-xl">{noteSpeed.toFixed(1)}x</span>
                          </div>
                          <input 
                            type="range" min="0.5" max="2.5" step="0.1"
                            value={noteSpeed} onChange={(e) => setNoteSpeed(parseFloat(e.target.value))}
                            className="w-full h-4 bg-gray-200 rounded-full appearance-none accent-sky-500 cursor-pointer"
                          />
                      </div>

                      {/* Offset */}
                      <div className="space-y-3">
                          <div className="flex justify-between font-bold text-gray-600">
                              <span className="flex items-center gap-2"><Volume2 size={20}/> GLOBAL OFFSET</span>
                              <span className="text-sky-500 font-num text-xl">{audioOffset}ms</span>
                          </div>
                          <input 
                            type="range" min="-200" max="200" step="5"
                            value={audioOffset} onChange={(e) => setAudioOffset(parseInt(e.target.value))}
                            className="w-full h-4 bg-gray-200 rounded-full appearance-none accent-sky-500 cursor-pointer"
                          />
                      </div>

                      <div className="h-px bg-gray-200 w-full my-4"></div>

                      {/* Toggles */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <button 
                             onClick={() => setAutoPlay(!autoPlay)}
                             className={`p-4 rounded-xl border-4 font-bold transition-all flex flex-col items-center gap-2 ${autoPlay ? 'border-yellow-400 bg-yellow-50 text-yellow-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                           >
                               <Zap size={32} />
                               AUTO PLAY
                           </button>

                           <button 
                             onClick={() => setShowLinearAssist(!showLinearAssist)}
                             className={`p-4 rounded-xl border-4 font-bold transition-all flex flex-col items-center gap-2 ${showLinearAssist ? 'border-sky-400 bg-sky-50 text-sky-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                           >
                               <Gauge size={32} />
                               LANE ASSIST
                           </button>

                           <button 
                             onClick={() => setEnableRecording(!enableRecording)}
                             className={`p-4 rounded-xl border-4 font-bold transition-all flex flex-col items-center gap-2 ${enableRecording ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                           >
                               <Video size={32} />
                               REC MODE
                           </button>
                      </div>

                  </div>

                  <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
                      <button onClick={() => setShowSettings(false)} className="bg-sky-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-sky-600 transition-colors">
                          SAVE & CLOSE
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;