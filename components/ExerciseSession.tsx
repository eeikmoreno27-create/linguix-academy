
import React, { useState, useEffect, useRef } from 'react';
import { Exercise, UserPreferences } from '../types';
import { generateExercises, speakText, decodeBase64, decodeAudioData } from '../geminiService';
import Avatar3D from './Avatar3D';
import { ChevronRight, CheckCircle2, AlertCircle, Loader2, Volume2, Mic, Sparkles, Wand2 } from 'lucide-react';

interface Props {
  prefs: UserPreferences;
  onFinish: (performanceScore: number, failedTopics: string[]) => void;
}

const ExerciseSession: React.FC<Props> = ({ prefs, onFinish }) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalErrors, setTotalErrors] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const ex = await generateExercises(prefs);
      setExercises(ex);
      setLoading(false);
    };
    fetch();
  }, [prefs]);

  const playTTS = async (text: string, lang?: string) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();

    setIsSpeaking(true);
    try {
      const targetLang = lang || prefs.targetLanguage;
      const base64 = await speakText(text, targetLang);
      if (base64) {
        const raw = decodeBase64(base64);
        const buffer = await decodeAudioData(raw, audioCtxRef.current, 24000, 1);
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtxRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (e) {
      setIsSpeaking(false);
    }
  };

  const handleSelection = (opt: string) => {
    if (isCorrect !== null) return;
    setSelectedAnswer(opt);
    playTTS(opt);
  };

  const handleCheck = () => {
    const current = exercises[currentIndex];
    if (selectedAnswer === current.correctAnswer) {
      setIsCorrect(true);
      playTTS("¡Perfecto! Muy bien.", 'es');
    } else {
      setIsCorrect(false);
      setTotalErrors(prev => prev + 1);
      playTTS(current.explanation, 'es');
    }
  };

  const handleNext = () => {
    if (isCorrect === false) {
      setIsCorrect(null);
      setSelectedAnswer(null);
    } else {
      if (currentIndex < exercises.length - 1) {
        setCurrentIndex(c => c + 1);
        setSelectedAnswer(null);
        setIsCorrect(null);
      } else {
        const score = Math.max(0, 100 - (totalErrors * 10));
        onFinish(score, []);
      }
    }
  };

  const startVoiceCapture = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      const current = exercises[currentIndex];
      const success = Math.random() > 0.4;
      if (success) {
        setSelectedAnswer(current.correctAnswer);
        setIsCorrect(true);
        playTTS("¡Excelente pronunciación!", 'es');
      } else {
        setIsCorrect(false);
        setTotalErrors(prev => prev + 1);
        playTTS(`Estás mal, se dice "${current.correctAnswer}". Inténtalo de nuevo.`, 'es');
      }
    }, 2500);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#020617] text-center">
      <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
      <h2 className="text-2xl font-bold text-white font-heading uppercase italic tracking-tighter">Sincronizando Linguix...</h2>
      <p className="text-slate-500 mt-2 font-black uppercase tracking-widest text-[10px]">by ERIK ZAVALA</p>
    </div>
  );

  const current = exercises[currentIndex];
  const progress = ((currentIndex + (isCorrect === true ? 1 : 0)) / exercises.length) * 100;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 min-h-screen flex flex-col lg:flex-row gap-12 items-center">
      <div className="lg:w-1/3 w-full flex flex-col items-center">
        <div className="w-full h-[450px] relative">
          <Avatar3D isSpeaking={isSpeaking} gender={prefs.gender} />
        </div>
        <div className="mt-6 px-8 py-4 glass rounded-[2rem] text-center border-white/5 bg-slate-900/40">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Tutor Linguix</p>
          <p className="text-slate-300 text-sm italic">Escuchando con atención...</p>
        </div>
      </div>

      <div className="lg:w-2/3 w-full space-y-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-blue-500" /> Nivel {prefs.subLevel}
            </span>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-blue-500 transition-all duration-700 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="glass rounded-[3.5rem] p-10 md:p-14 border-white/5 relative shadow-2xl bg-slate-900/10">
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-8">
               <span className="px-6 py-2.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                {current.type === 'pronunciation' ? 'Desafío Fonético' : 'Entrenamiento de Fluidez'}
              </span>
              <button onClick={() => playTTS(current.question)} className="p-4 bg-slate-800 rounded-2xl text-slate-400 hover:text-blue-400 transition-all shadow-xl active:scale-90">
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold font-heading text-white leading-tight tracking-tighter italic">
              {current.question}
            </h2>
          </div>

          {current.type === 'pronunciation' ? (
            <div className="flex flex-col items-center justify-center py-16 bg-slate-900/40 rounded-[3rem] border border-white/5 mb-10 shadow-inner">
              <button 
                onClick={startVoiceCapture}
                disabled={isRecording}
                className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 border-8 ${isRecording ? 'bg-red-500 border-red-400/40 animate-pulse shadow-[0_0_60px_rgba(239,68,68,0.5)]' : 'bg-blue-600 border-blue-500/30 shadow-2xl hover:scale-105 active:scale-95'}`}
              >
                <Mic className="w-16 h-16 text-white" />
              </button>
              <p className="mt-10 text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">
                {isRecording ? 'Capturando fonemas...' : 'Mantén pulsado para hablar'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 mb-12">
              {current.options?.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelection(opt)}
                  className={`p-7 md:p-9 rounded-[2.5rem] border-2 text-left transition-all flex items-center justify-between group transform ${
                    selectedAnswer === opt 
                    ? isCorrect === null 
                      ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' 
                      : isCorrect ? 'border-green-500 bg-green-500/10 scale-[1.01]' : 'border-red-500 bg-red-500/10'
                    : 'border-white/5 bg-slate-900/50 hover:bg-slate-800'
                  }`}
                >
                  <span className={`text-2xl font-black ${selectedAnswer === opt ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{opt}</span>
                  <div className={`p-4 rounded-2xl transition-all ${selectedAnswer === opt ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-600'}`}>
                    <Volume2 className="w-5 h-5" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {isCorrect !== null && (
            <div className={`p-10 rounded-[3rem] mb-12 border-2 animate-in slide-in-from-top-6 duration-700 ${isCorrect ? 'bg-green-500/5 border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.1)]' : 'bg-red-500/5 border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.1)]'}`}>
              <div className="flex gap-8 items-start">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 shadow-2xl ${isCorrect ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                  {isCorrect ? <CheckCircle2 className="w-9 h-9" /> : <AlertCircle className="w-9 h-9" />}
                </div>
                <div>
                  <p className={`font-black uppercase tracking-[0.3em] text-xs mb-3 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                    {isCorrect ? 'Módulo Superado' : 'Corrección Crítica'}
                  </p>
                  <p className="text-slate-200 text-xl leading-relaxed italic font-bold">
                    {current.explanation}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            {isCorrect === null ? (
              <button
                onClick={handleCheck}
                disabled={!selectedAnswer}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-black uppercase tracking-[0.5em] text-xs py-8 rounded-[2.5rem] transition-all shadow-2xl flex items-center justify-center gap-4 active:scale-95"
              >
                <Wand2 className="w-6 h-6" /> Analizar Respuesta
              </button>
            ) : (
              <button
                onClick={handleNext}
                className={`w-full font-black uppercase tracking-[0.5em] text-xs py-8 rounded-[2.5rem] transition-all flex items-center justify-center gap-4 active:scale-95 ${isCorrect ? 'bg-white text-slate-950 shadow-2xl hover:bg-slate-100' : 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700'}`}
              >
                {isCorrect ? (currentIndex === exercises.length - 1 ? 'Misión Finalizada' : 'Siguiente Paso') : 'Reintentar Desafío'}
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
          <p className="text-center mt-10 text-[11px] font-black uppercase tracking-[1em] text-slate-800 italic">by ERIK ZAVALA</p>
        </div>
      </div>
    </div>
  );
};

export default ExerciseSession;
