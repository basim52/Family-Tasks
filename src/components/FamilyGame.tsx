import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, 
  Dice5, 
  Trophy, 
  User, 
  Users, 
  ChevronRight, 
  Sparkles, 
  HelpCircle, 
  CheckCircle, 
  XCircle, 
  RotateCcw,
  Clock,
  Volume2,
  VolumeX,
  ArrowRight,
  Flame,
  Award,
  BookOpen
} from 'lucide-react';
import { UserProfile } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';

const sendNotification = async (userId: string, title: string, body: string, type: string = 'info') => {
  await addDoc(collection(db, 'notifications'), {
    userId,
    title,
    body,
    type,
    read: false,
    createdAt: serverTimestamp()
  });
};

interface FamilyGameProps {
  profile: UserProfile;
  family: UserProfile[];
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  position: number;
  score: number;
  isBot?: boolean;
}

interface BoardCell {
  index: number;
  type: 'start' | 'quiz' | 'challenge' | 'luck' | 'safety' | 'end';
  title: string;
  description: string;
  bgClass: string;
  icon: any;
}

const BOARD_CELLS: BoardCell[] = [
  { index: 0, type: 'start', title: 'البداية 🚢', description: 'انطلاق سفينة الانتعاش العائلية!', bgClass: 'from-blue-600 to-indigo-600 text-white border-blue-400', icon: Gamepad2 },
  { index: 1, type: 'quiz', title: 'لغز ذكي 💡', description: 'سؤال ينشط خلايا عقلك المبدع!', bgClass: 'from-amber-500/10 to-amber-600/10 border-amber-500/30 text-amber-300', icon: HelpCircle },
  { index: 2, type: 'challenge', title: 'تحدي حركي ⚡', description: 'نشاط سريع يصنع الحيوية والضحك!', bgClass: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/30 text-emerald-300', icon: Flame },
  { index: 3, type: 'luck', title: 'بوابة الحظ 🌀', description: 'صندوق المفاجآت، قد يدفعك للأمام أو يُكسبك كنزاً!', bgClass: 'from-pink-500/10 to-pink-600/10 border-pink-500/30 text-pink-300', icon: Sparkles },
  { index: 4, type: 'quiz', title: 'لغز ذكي 💡', description: 'اختبر ذكاءك ومستواك المعرفي!', bgClass: 'from-amber-500/10 to-amber-600/10 border-amber-500/30 text-amber-300', icon: HelpCircle },
  { index: 5, type: 'challenge', title: 'تحدي حركي ⚡', description: 'مهمة ممتعة تشاركها مع العائلة!', bgClass: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/30 text-emerald-300', icon: Flame },
  { index: 6, type: 'safety', title: 'محطة أمان 🌴', description: 'استرح وتلقى طاقة إيجابية لتكمل المغامرة!', bgClass: 'from-sky-500/10 to-sky-600/10 border-sky-500/30 text-sky-300', icon: Award },
  { index: 7, type: 'quiz', title: 'لغز ذكي 💡', description: 'سؤال عائلي ذكي يُحفز التفكير!', bgClass: 'from-amber-500/10 to-amber-600/10 border-amber-500/30 text-amber-300', icon: HelpCircle },
  { index: 8, type: 'challenge', title: 'تحدي حركي ⚡', description: 'ابتسامة وتحدي حماسي سريع!', bgClass: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/30 text-emerald-300', icon: Flame },
  { index: 9, type: 'luck', title: 'بوابة الحظ 🌀', description: 'قد يحدث أمر غير متوقع تماماً للجميع!', bgClass: 'from-pink-500/10 to-pink-600/10 border-pink-500/30 text-pink-300', icon: Sparkles },
  { index: 10, type: 'quiz', title: 'لغز ذكي 💡', description: 'هل أنت أسرع من يستمع ويحلل؟', bgClass: 'from-amber-500/10 to-amber-600/10 border-amber-500/30 text-amber-300', icon: HelpCircle },
  { index: 11, type: 'challenge', title: 'تحدي حركي ⚡', description: 'احصل على تصويت العائلة لتفوز بالدعم!', bgClass: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/30 text-emerald-300', icon: Flame },
  { index: 12, type: 'safety', title: 'محطة أمان 🌴', description: 'نصف طاقة وعزيمة جديدة تقترب من خط الفوز!', bgClass: 'from-sky-500/10 to-sky-600/10 border-sky-500/30 text-sky-300', icon: Award },
  { index: 13, type: 'quiz', title: 'لغز ذكي 💡', description: 'من الأسرع في فك الرموز؟', bgClass: 'from-amber-500/10 to-amber-600/10 border-amber-500/30 text-amber-300', icon: HelpCircle },
  { index: 14, type: 'challenge', title: 'تحدي حركي ⚡', description: 'ابدأ بالعد التنازلي ونفذ ببراعة!', bgClass: 'from-emerald-500/10 to-emerald-600/10 border-emerald-500/30 text-emerald-300', icon: Flame },
  { index: 15, type: 'luck', title: 'بوابة الحظ 🌀', description: 'الحظ قد ينصفك خطوتين إضافيتين!', bgClass: 'from-pink-500/10 to-pink-600/10 border-pink-500/30 text-pink-300', icon: Sparkles },
  { index: 16, type: 'end', title: 'كنز العائلة 👑', description: 'نهاية المغامرة، وتاج النصر المنعش بانتظارك!', bgClass: 'from-amber-500 to-yellow-500 text-slate-900 border-amber-300 font-black', icon: Trophy }
];

const TRIVIA_QUESTIONS = [
  { q: "ما هو الشيء الذي يكتب ولكنه لا يقرأ أبداً؟", a: "القلم", o: ["الكتاب", "القلم", "الرسالة"] },
  { q: "ما هو الشيء الذي كلما أخذت منه كبُر وعظُم؟", a: "الحفرة", o: ["العمر", "الحفرة", "المال"] },
  { q: "ما هو الشيء الذي له أسنان كثيرة ولكنه لا يعض؟", a: "المشط", o: ["المنشار", "المشط", "المفتاح"] },
  { q: "من هو خال أولاد عمتك الوحيد؟", a: "والدك", o: ["أخوك", "خالك", "والدك"] },
  { q: "ما هو الكوكب الأكثر سخونة في مجموعتنا الشمسية؟", a: "كوكب الزهرة", o: ["كوكب المريخ", "كوكب الزهرة", "كوكب عطارد"] },
  { q: "كم عدد سور القرآن الكريم؟", a: "114", o: ["110", "114", "118"] },
  { q: "ما هو أسرع حيوان برّي في العالم؟", a: "الفهد", o: ["النمر", "الفهد", "الأسد"] },
  { q: "ما هو الشيء الذي تراه في الليل 3 مرات وفي النهار مرة واحدة؟", a: "حرف الياء", o: ["حرف الياء", "القمر", "النجم"] },
  { q: "ما هو العضو في جسم الإنسان الذي لا يتوقف عن النمو طوال حياته؟", a: "الأنف والأذن", o: ["القلب", "الأنف والأذن", "الشعر"] },
  { q: "ما هو الشيء الذي يمشي ويقف وليس له أرجل؟", a: "الساعة", o: ["الساعة", "الماء", "السحاب"] }
];

const PHYSICAL_CHALLENGES = [
  "قف على قدم واحدة وأغمض عينيك لـ 15 ثانية دون أن تفقد توازنك! 🤸",
  "قل لأقرب شخص بجانبك كلمة دافئة ولطيفة من قلبك وعانقه بحب! 🤗",
  "ردد 'سبحان الله وبحمده، سبحان الله العظيم' 10 مرات بسرعة ووضوح! 🕌",
  "اذكر 3 من النعم الجميلة في حياتك اليوم التي تشعر بالامتنان لوجودها! 🙏",
  "قم بتمثيل شخصية كرتونية شهيرة بصمت واجعل البقية يخمنون من هي! 🎭",
  "تحدي الانتباه السريع: اذكر 5 أشياء زرقاء في الغرفة حولك خلال 8 ثوانٍ! 🔵",
  "قم بعمل 5 تمرينات ضغط أو قفز في مكانك بنشاط مفعم بالانتعاش! ⚡",
  "ارسم وجهاً مبتسماً كبيراً على ورقة وأرِه للجميع ليضحكوا معك! 😄"
];

const LUCK_CARDS = [
  { text: "هبّت رياح الانتعاش! تقدّم خطوة واحدة للأمام مجاناً 🍃", steps: 1 },
  { text: "أنت بطل مخلص! حصلت على 10 نقاط إضافية في رصيد اللعبة 🪙", points: 10 },
  { text: "عاصفة ترابية خفيفة! تراجع خطوة واحدة لتهيئة دفاعاتك 🌀", steps: -1 },
  { text: "أعطيت طاقة إيجابية لجميع زملائك! تقدم خطوتين للأمام 🚀", steps: 2 },
  { text: "بوابة سحرية دافئة! تبادل المكان مع آخر لاعب في الترتيب (أو تقدم خطوة لو كنت الأخير) 🔄", swap: true }
];

export const FamilyGame: React.FC<FamilyGameProps> = ({ profile, family }) => {
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'event' | 'gameover'>('lobby');
  const [playerCount, setPlayerCount] = useState<number>(3);
  const [selectedPlayers, setSelectedPlayers] = useState<UserProfile[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  
  // Audio state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Game states and turns
  const [diceRolling, setDiceRolling] = useState<boolean>(false);
  const [rolledNumber, setRolledNumber] = useState<number | null>(null);
  
  // Event overlays
  const [currentEvent, setCurrentEvent] = useState<{
    cellIndex: number;
    type: 'quiz' | 'challenge' | 'luck' | 'safety';
    title: string;
    description: string;
    quizQuestion?: typeof TRIVIA_QUESTIONS[0];
    challengeText?: string;
    luckText?: string;
    luckSteps?: number;
    luckPoints?: number;
    luckSwap?: boolean;
  } | null>(null);

  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState<string | null>(null);
  const [quizIsCorrect, setQuizIsCorrect] = useState<boolean | null>(null);
  
  const [challengeTimer, setChallengeTimer] = useState<number>(20);
  const [timerActive, setTimerActive] = useState<boolean>(false);

  // Winner metadata
  const [winner, setWinner] = useState<Player | null>(null);
  const [pushedToFirestore, setPushedToFirestore] = useState<boolean>(false);

  // Sound generator
  const playTone = (freq: number, type: OscillatorType, duration: number) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Web Audio API is not fully responsive yet.");
    }
  };

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (timerActive && challengeTimer > 0) {
      interval = setInterval(() => {
        setChallengeTimer(prev => prev - 1);
        if (challengeTimer === 4) {
          playTone(400, 'triangle', 0.2);
        }
      }, 1000);
    } else if (challengeTimer === 0 && timerActive) {
      setTimerActive(false);
      playTone(250, 'sawtooth', 0.5);
    }
    return () => clearInterval(interval);
  }, [timerActive, challengeTimer]);

  // Handle player selection setup
  useEffect(() => {
    // Auto-select logged-in user + next available family members
    const initialList = [...family.filter(f => f.role === 'child')];
    if (initialList.length === 0) {
      initialList.push(...family); // fallback to all members
    }
    
    // De-duplicate just in case
    const uniqueFamily = Array.from(new Set(initialList.map(u => u.uid)))
      .map(uid => initialList.find(u => u.uid === uid)!);

    setSelectedPlayers(uniqueFamily.slice(0, playerCount));
  }, [family, playerCount]);

  const startGame = () => {
    playTone(523.25, 'sine', 0.3); // C5
    setTimeout(() => playTone(659.25, 'sine', 0.3), 150); // E5
    setTimeout(() => playTone(783.99, 'sine', 0.5), 300); // G5

    const colors = [
      '#EF4444', // Red
      '#10B981', // Emerald
      '#3B82F6', // Blue
      '#F59E0B', // Amber
      '#EC4899'  // Pink
    ];

    const mappedPlayers: Player[] = Array.from({ length: playerCount }).map((_, i) => {
      const selected = selectedPlayers[i];
      if (selected) {
        return {
          id: selected.uid,
          name: selected.displayName || `عضو ${i+1}`,
          avatar: selected.photoURL || '',
          color: colors[i % colors.length],
          position: 0,
          score: 0
        };
      } else {
        // Guest player fallback
        return {
          id: `guest-${i}`,
          name: `البطل الضيف ${i + 1} 🌟`,
          avatar: '',
          color: colors[i % colors.length],
          position: 0,
          score: 0
        };
      }
    });

    setPlayers(mappedPlayers);
    setActivePlayerIndex(0);
    setGameState('playing');
    setWinner(null);
    setPushedToFirestore(false);
  };

  const rollDice = async () => {
    if (diceRolling || gameState !== 'playing') return;
    setDiceRolling(true);
    setRolledNumber(null);

    // Roll animation intervals
    let rolls = 0;
    const interval = setInterval(() => {
      const mockResult = Math.floor(Math.random() * 4) + 1; // rolls 1-4 for good board pace
      setRolledNumber(mockResult);
      playTone(800 + mockResult * 100, 'square', 0.05);
      rolls++;
      if (rolls > 10) {
        clearInterval(interval);
        
        // Final result
        const finalRoll = Math.floor(Math.random() * 4) + 1;
        setRolledNumber(finalRoll);
        setDiceRolling(false);
        movePlayer(finalRoll);
      }
    }, 100);
  };

  const movePlayer = (steps: number) => {
    setPlayers(prevPlayers => {
      const updated = [...prevPlayers];
      const player = { ...updated[activePlayerIndex] };
      const oldPos = player.position;
      let newPos = oldPos + steps;

      if (newPos >= BOARD_CELLS.length - 1) {
        newPos = BOARD_CELLS.length - 1; // exactly reach end or cap it
      }

      player.position = newPos;
      updated[activePlayerIndex] = player;

      // Plan triggers
      setTimeout(() => {
        triggerCellEvent(player, newPos);
      }, 800);

      return updated;
    });
  };

  const triggerCellEvent = (player: Player, cellIndex: number) => {
    const cell = BOARD_CELLS[cellIndex];
    
    if (cell.type === 'start') {
      nextTurn();
      return;
    }

    if (cell.type === 'end') {
      // WINNER ANNOUNCED!
      playTone(523.25, 'sine', 0.15);
      playTone(659.25, 'sine', 0.15);
      playTone(783.99, 'sine', 0.15);
      playTone(1046.50, 'sine', 0.6); // Tremendous chord!
      setWinner(player);
      setGameState('gameover');
      return;
    }

    // Build event
    let eventDetails: any = {
      cellIndex,
      type: cell.type,
      title: cell.title,
      description: cell.description
    };

    if (cell.type === 'quiz') {
      const randomQ = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
      // Shuffle options
      const shuffledOptions = [...randomQ.o].sort(() => Math.random() - 0.5);
      eventDetails.quizQuestion = { ...randomQ, o: shuffledOptions };
      setQuizSelectedAnswer(null);
      setQuizIsCorrect(null);
      playTone(600, 'triangle', 0.25);
    } else if (cell.type === 'challenge') {
      const randomChallenge = PHYSICAL_CHALLENGES[Math.floor(Math.random() * PHYSICAL_CHALLENGES.length)];
      eventDetails.challengeText = randomChallenge;
      setChallengeTimer(20);
      setTimerActive(true);
      playTone(700, 'sine', 0.2);
    } else if (cell.type === 'luck') {
      const randomLuck = LUCK_CARDS[Math.floor(Math.random() * LUCK_CARDS.length)];
      eventDetails.luckText = randomLuck.text;
      eventDetails.luckSteps = randomLuck.steps || 0;
      eventDetails.luckPoints = randomLuck.points || 0;
      eventDetails.luckSwap = randomLuck.swap || false;
      playTone(900, 'sine', 0.35);
    } else if (cell.type === 'safety') {
      eventDetails.luckPoints = 15; // Auto-award family points
      playTone(500, 'triangle', 0.4);
    }

    setCurrentEvent(eventDetails);
    setGameState('event');
  };

  const handleAnswerQuiz = (selectedOpt: string) => {
    if (quizSelectedAnswer || !currentEvent?.quizQuestion) return;
    setQuizSelectedAnswer(selectedOpt);
    const correct = selectedOpt === currentEvent.quizQuestion.a;
    setQuizIsCorrect(correct);

    setPlayers(prev => prev.map((p, i) => {
      if (i === activePlayerIndex) {
        return { 
          ...p, 
          score: correct ? p.score + 15 : Math.max(0, p.score - 5),
          position: correct ? Math.min(BOARD_CELLS.length - 1, p.position + 1) : p.position // Advance 1 extra step for correct answer
        };
      }
      return p;
    }));

    if (correct) {
      playTone(987.77, 'sine', 0.15); // B5
      setTimeout(() => playTone(1318.51, 'sine', 0.3), 100); // E6
    } else {
      playTone(300, 'sawtooth', 0.4);
    }
  };

  const handleVoteChallenge = (success: boolean) => {
    setTimerActive(false);
    setPlayers(prev => prev.map((p, i) => {
      if (i === activePlayerIndex) {
        return { 
          ...p, 
          score: success ? p.score + 20 : p.score,
          position: success ? Math.min(BOARD_CELLS.length - 1, p.position + 1) : p.position // Advance 1 extra step for awesome physical work!
        };
      }
      return p;
    }));

    if (success) {
      playTone(1000, 'sine', 0.3);
    } else {
      playTone(300, 'sine', 0.3);
    }
    
    closeEvent();
  };

  const applyLuckEffect = () => {
    if (!currentEvent) return;

    setPlayers(prev => {
      let updated = [...prev];
      const player = { ...updated[activePlayerIndex] };

      if (currentEvent.luckSteps) {
        player.position = Math.max(0, Math.min(BOARD_CELLS.length - 1, player.position + currentEvent.luckSteps));
      }
      if (currentEvent.luckPoints) {
        player.score = Math.max(0, player.score + currentEvent.luckPoints);
      }
      if (currentEvent.luckSwap) {
        // Swap positions with the player behind, or advance 1 if they are last
        const sortedByPos = [...updated].map((p, idx) => ({ p, idx })).sort((a,b) => a.p.position - b.p.position);
        const myIndexInSorted = sortedByPos.findIndex(item => item.idx === activePlayerIndex);
        if (myIndexInSorted > 0) {
          // Swap with player directly behind me
          const swapTarget = sortedByPos[myIndexInSorted - 1];
          const targetOldPos = swapTarget.p.position;
          const myOldPos = player.position;
          
          updated[swapTarget.idx].position = myOldPos;
          player.position = targetOldPos;
        } else {
          // If already last, just advance 1
          player.position = Math.min(BOARD_CELLS.length - 1, player.position + 1);
        }
      }

      updated[activePlayerIndex] = player;
      return updated;
    });

    closeEvent();
  };

  const closeEvent = () => {
    setCurrentEvent(null);
    setGameState('playing');
    nextTurn();
  };

  const nextTurn = () => {
    setActivePlayerIndex(prev => (prev + 1) % playerCount);
    playTone(550, 'triangle', 0.1);
  };

  // Safe reward sync into actual Firestore wallet points if Winner is an actual family member
  const awardWinnerRealPoints = async () => {
    if (!winner || winner.id.startsWith('guest') || pushedToFirestore) return;
    try {
      setPushedToFirestore(true);
      const userRef = doc(db, 'users', winner.id);
      await updateDoc(userRef, {
        points: increment(50), // Grand jackpot points
        totalPointsEarned: increment(50)
      });

      // Send family wide announcement chat & notification
      await addDoc(collection(db, 'notifications'), {
        userId: winner.id,
        title: 'بطل الانتعاش العالي! 🏆',
        body: `الفائز الأكبر في التحدي العائلي! تم إضافة 50 نقطة حقيقية إلى محفظتك!`,
        type: 'achievement',
        read: false,
        createdAt: serverTimestamp()
      });

      alert('تم إرسال المكافأة الحقيقية (50 نقطة) بنجاح إلى البطل المبدع! 🎁🎉');
    } catch (e) {
      alert('تم تحديث النقاط محلياً! لم نتمكن من الوصول لقاعدة البيانات');
    }
  };

  return (
    <div className="bg-summer-card p-6 md:p-8 rounded-[2.5rem] border border-white/40 shadow-xl space-y-6 relative overflow-hidden" dir="rtl">
      {/* Dynamic Aurora decoration */}
      <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-300 rounded-xl flex items-center justify-center">
              <Gamepad2 size={24} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-summer-text tracking-tighter">أرض المغامرات والانتعاش العائلي 🏝️🎮</h3>
              <p className="text-[10px] text-summer-text/50 font-bold uppercase tracking-widest leading-none">Refreshing Family Multi-Hero Quest</p>
            </div>
          </div>
          <p className="text-xs text-summer-text/80 mt-1 font-bold">لعبة تواصل عائلية تفاعلية تلعب على هاتف واحد بين 2 إلى 5 أفراد!</p>
        </div>

        {/* Sound controller */}
        <button 
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-3 bg-white/15 hover:bg-white/20 border border-white/10 rounded-2xl text-summer-text transition-all self-end sm:self-auto"
        >
          {soundEnabled ? <Volume2 size={18} className="text-emerald-400" /> : <VolumeX size={18} className="text-rose-400" />}
        </button>
      </div>

      {/* Lobby State */}
      {gameState === 'lobby' && (
        <div className="space-y-6 max-w-xl mx-auto py-4 relative z-10 text-right animate-in fade-in-50 duration-300">
          <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
            <h4 className="font-black text-sm text-summer-text flex items-center gap-2">
              <Users size={16} className="text-amber-400" />
              1. اختر عدد الأبطال المشاركين باللعبة:
            </h4>
            
            <div className="grid grid-cols-4 gap-2.5">
              {[2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => setPlayerCount(num)}
                  className={`py-3 rounded-2xl font-black text-base border transition-all ${
                    playerCount === num 
                      ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold shadow-lg scale-105' 
                      : 'bg-white/10 border-white/10 hover:bg-white/20 text-summer-text'
                  }`}
                >
                  {num} أبطال
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
            <h4 className="font-black text-sm text-summer-text flex items-center gap-2">
              <User size={16} className="text-emerald-400" />
              2. تعيين قائمة الأبطال (اضغط للتغيير):
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: playerCount }).map((_, i) => {
                const currentSelection = selectedPlayers[i];
                const cleanFamilyList = family.filter(f => f.role === 'child');
                const listToChoose = cleanFamilyList.length > 0 ? cleanFamilyList : family;
                
                return (
                  <div key={i} className="flex flex-col gap-1.5 p-3.5 bg-white/5 border border-white/10 rounded-2xl">
                    <span className="text-[10px] text-summer-text/40 font-black">اللاعب {i + 1} 🛡️</span>
                    
                    <select
                      className="bg-brand-card text-summer-text text-xs font-bold rounded-xl p-2 border border-white/10 outline-none"
                      value={currentSelection?.uid || ''}
                      onChange={(e) => {
                        const found = listToChoose.find(f => f.uid === e.target.value);
                        if (found) {
                          setSelectedPlayers(prev => {
                            const copy = [...prev];
                            copy[i] = found;
                            return copy;
                          });
                        }
                      }}
                    >
                      <option value="">-- اضغط لاختيار فرد العائلة --</option>
                      {listToChoose.map(f => (
                        <option key={f.uid} value={f.uid}>{f.displayName} ({f.role === 'parent' ? 'الأهل' : 'ابن'})</option>
                      ))}
                      <option value={`guest-${i}`}>بطل ضيف 🌟</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Start trigger */}
          <button
            onClick={startGame}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-900 py-4.5 rounded-[2rem] font-black text-lg transition-all shadow-xl hover:shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-3"
          >
            <Gamepad2 size={22} />
            ابدأ رحلة المغامرة الفائقة الآن 🚀
          </button>
        </div>
      )}

      {/* Playing state map and interface */}
      {gameState === 'playing' && (
        <div className="space-y-6 relative z-10 animate-in fade-in-50 duration-300">
          
          {/* Active Player Dash */}
          <div 
            className="p-5 rounded-3xl border text-right flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden transition-all"
            style={{ 
              borderColor: `${players[activePlayerIndex]?.color}50`,
              backgroundColor: `${players[activePlayerIndex]?.color}15`
            }}
          >
            <div className="absolute top-0 right-0 w-2 h-full" style={{ backgroundColor: players[activePlayerIndex]?.color }} />
            
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md rotate-3"
                style={{ backgroundColor: players[activePlayerIndex]?.color }}
              >
                {players[activePlayerIndex]?.name.charAt(0)}
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-summer-text/40 block">دور البطل الحالي 🎲</span>
                <h4 className="text-lg font-black text-summer-text">{players[activePlayerIndex]?.name}</h4>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0">
              <div className="text-right">
                <span className="text-[9px] text-summer-text/40 font-bold block">موقعك على السفينة</span>
                <span className="text-sm font-black text-summer-text">الجزيرة {players[activePlayerIndex]?.position}/16</span>
              </div>
              
              <button
                onClick={rollDice}
                disabled={diceRolling}
                className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <Dice5 size={18} className={diceRolling ? 'animate-spin' : ''} />
                {diceRolling ? 'جاري رمي النرد...' : 'ارمي النرد 🎲'}
              </button>
            </div>
          </div>

          {/* Dice rolling result pop */}
          <AnimatePresence>
            {rolledNumber !== null && (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="flex items-center justify-center py-2"
              >
                <div className="bg-white/10 border border-white/20 p-4 px-6 rounded-2xl flex items-center gap-3">
                  <span className="text-xs font-bold text-summer-text/80">مجموع رميتك:</span>
                  <span className="text-2xl font-black text-amber-400 font-mono scale-110">{rolledNumber}</span>
                  <span className="text-xs font-bold text-summer-text/80">خطوات! ⛵</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid of the Game Board islands */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-black text-summer-text/40 tracking-wider block text-right">خريطة السفينة وقنوات الجزر الـ 16 🗺️</h5>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {BOARD_CELLS.map((cell) => {
                // Find players on this island
                const playersHere = players.filter(p => p.position === cell.index);
                
                return (
                  <div 
                    key={cell.index}
                    className={`p-3 rounded-2xl border transition-all h-[110px] flex flex-col justify-between relative overflow-hidden backdrop-blur-sm ${cell.bgClass}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] bg-white/10 p-0.5 px-2 rounded-lg font-black font-semibold text-summer-text/50">{cell.index}</span>
                      <cell.icon size={16} />
                    </div>

                    <div className="text-right">
                      <h4 className="text-xs font-black text-summer-text block">{cell.title}</h4>
                      <p className="text-[8px] text-summer-text/50 leading-tight font-medium mt-0.5">{cell.description}</p>
                    </div>

                    {/* Render Player Avatars Standing Here */}
                    <div className="absolute bottom-2 left-2 flex gap-1 flex-wrap max-w-[80%]">
                      {playersHere.map(p => (
                        <div 
                          key={p.id}
                          className="w-5.5 h-5.5 rounded-lg border border-white/40 flex items-center justify-center text-[10px] text-white font-black shadow-md relative group shrink-0"
                          style={{ backgroundColor: p.color }}
                          title={p.name}
                        >
                          {p.name.charAt(0)}
                          
                          {/* Pulsing indicator for active player */}
                          {p.id === players[activePlayerIndex]?.id && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping border border-slate-900" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Real-Time mini leaderboard scores */}
          <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-3">
            <h5 className="text-[10px] font-black text-summer-text/40 tracking-wider block text-right">قائمة ترتيب فرسان الانتعاش 🏆</h5>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {players.map((p, idx) => (
                <div 
                  key={p.id} 
                  className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between text-right"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-xs font-black text-summer-text leading-none">{p.name}</span>
                  </div>
                  <span className="text-xs font-black text-amber-300 font-mono">{p.score} ن</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Events dialog overlays */}
      {gameState === 'event' && currentEvent && (
        <div className="max-w-xl mx-auto bg-white/10 border border-white/20 p-6 md:p-8 rounded-[2.5rem] relative z-10 text-right space-y-6 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-300">
          
          {/* Header dynamic icon/badge based on type */}
          <div className="flex items-center gap-4 border-b border-white/10 pb-4">
            <div className="w-12 h-12 bg-amber-500/20 text-amber-300 rounded-2xl flex items-center justify-center">
              {currentEvent.type === 'quiz' && <HelpCircle size={26} />}
              {currentEvent.type === 'challenge' && <Flame size={26} />}
              {currentEvent.type === 'luck' && <Sparkles size={26} />}
              {currentEvent.type === 'safety' && <Award size={26} />}
            </div>
            <div>
              <span className="text-[10px] text-amber-300 font-black tracking-widest block uppercase">تحدي الجزر العائلية</span>
              <h4 className="text-xl font-black text-summer-text">{currentEvent.title}</h4>
            </div>
          </div>

          <p className="text-xs text-summer-text/80 font-bold bg-white/5 p-3.5 rounded-xl">{currentEvent.description}</p>

          {/* QUIZ FORM CHANNELS */}
          {currentEvent.type === 'quiz' && currentEvent.quizQuestion && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                <span className="text-[9px] font-black text-indigo-300 block mb-1">اللغز الصعب 🧩</span>
                <p className="text-sm font-black text-summer-text leading-relaxed">{currentEvent.quizQuestion.q}</p>
              </div>

              {!quizSelectedAnswer ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {currentEvent.quizQuestion.o.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      onClick={() => handleAnswerQuiz(opt)}
                      className="p-4 bg-white/5 border border-white/15 hover:bg-white/15 rounded-2xl transition-all text-right font-bold text-xs"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 text-center py-2">
                  <div className={`p-4 rounded-3xl ${quizIsCorrect ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'}`}>
                    <span className="text-base font-black flex items-center justify-center gap-2">
                      {quizIsCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                      {quizIsCorrect ? 'إجابة صحيحة عبقرية! 🎉 (+15 نقطة ومرحلة إضافية)' : 'إجابة خاطئة للأسف! 😢'}
                    </span>
                    <p className="text-xs mt-2 font-medium">خطوتك التالية قادمة بالدور.</p>
                  </div>

                  <button
                    onClick={closeEvent}
                    className="px-6 py-3 bg-white/15 hover:bg-white/20 text-summer-text rounded-2xl font-black text-xs transition-all mx-auto"
                  >
                    متابعة رحلة الجزر 🐾
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PHYSICAL/COOPERATIVE CHALLENGES */}
          {currentEvent.type === 'challenge' && currentEvent.challengeText && (
            <div className="space-y-4 text-center">
              <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl space-y-4 text-right">
                <span className="text-[9px] font-black text-emerald-300 block">التحدي العملي العائلي 🏃</span>
                <p className="text-base font-black text-summer-text leading-relaxed">{currentEvent.challengeText}</p>
              </div>

              {/* Timer UI */}
              <div className="flex items-center justify-center gap-3">
                <Clock size={18} className="text-amber-400 animate-pulse" />
                <span className="text-sm font-black text-summer-text">مؤقت التحدي:</span>
                <span className="text-xl font-mono font-black text-amber-300 bg-white/10 p-1 px-3.5 rounded-xl">{challengeTimer} ثانية</span>
              </div>

              {/* Voting screen for the family members */}
              <div className="border-t border-white/10 pt-4 space-y-3 text-right">
                <p className="text-[10px] text-summer-text/40 font-bold">باقي الأبطال، هل نفذ التحدي بنجاح ممتع وضحكة مبهجة؟ 👇</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleVoteChallenge(true)}
                    className="py-3 bg-emerald-500 text-slate-950 font-black rounded-2xl hover:bg-emerald-600 transition-all text-xs flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} />
                    نعم، تم بنجاح! 🎉
                  </button>
                  <button
                    onClick={() => handleVoteChallenge(false)}
                    className="py-3 bg-white/10 border border-white/10 hover:bg-white/15 text-summer-text font-bold rounded-2xl transition-all text-xs flex items-center justify-center gap-2"
                  >
                    <XCircle size={16} />
                    لم ينجح/انتهى الوقت
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LUCK GATE CARDS */}
          {currentEvent.type === 'luck' && currentEvent.luckText && (
            <div className="space-y-6 text-center">
              <div className="p-6 bg-pink-500/10 border border-pink-500/20 rounded-3xl text-right">
                <span className="text-[9px] font-black text-pink-300 block mb-1">صندوق الحظ 🌀</span>
                <p className="text-sm font-black text-summer-text leading-relaxed">{currentEvent.luckText}</p>
              </div>

              <button
                onClick={applyLuckEffect}
                className="w-full py-3.5 bg-pink-500 hover:bg-pink-600 text-slate-950 font-black rounded-2xl transition-all text-xs shadow-md"
              >
                تطبيق تأثيرات الحظ 🔮
              </button>
            </div>
          )}

          {/* SAFELY LAND COMPANION */}
          {currentEvent.type === 'safety' && (
            <div className="text-center space-y-4">
              <p className="text-sm font-bold text-summer-text leading-normal">لقد ارتحت في جزيرة خضراء من الطمأنينة! نلت 15 نقطة تفوق في رصيد اللعبة لتطوير أدائك ومستواك. 🍃</p>
              <button
                onClick={applyLuckEffect}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition-all mx-auto"
              >
                شكراً، متابعة 🐾
              </button>
            </div>
          )}

        </div>
      )}

      {/* WINNER celebration and Firestore Sync triggers */}
      {gameState === 'gameover' && winner && (
        <div className="max-w-xl mx-auto bg-gradient-to-br from-amber-500/25 to-yellow-500/25 border border-amber-400/40 p-8 rounded-[2.5rem] relative z-10 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-400">
          
          <div className="w-20 h-20 bg-amber-500/30 rounded-full flex items-center justify-center text-amber-300 mx-auto animate-bounce shadow-lg">
            <Trophy size={45} className="fill-amber-500 text-amber-500 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest block font-bold">بطل سفينة الانتعاش والكنز</span>
            <h4 className="text-2xl font-black text-white">الفائز الساحر هو: {winner.name}! 👑🎉</h4>
            <p className="text-xs text-summer-text font-bold">لقد تغلب ببراعة على جزر الألغاز وفخاخ الجري ووصل للكنز بمجموع نقاط: {winner.score} نقطة!</p>
          </div>

          {/* If the winner is a real child from users list, show database sync points trigger */}
          {!winner.id.startsWith('guest') ? (
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <span className="text-[10px] text-amber-300 font-black block">مكافأة الكنز الحقيقي 🎁</span>
              <p className="text-xs font-bold text-summer-text/80">الفائز عضو مسجل! يمكنك إضافة 50 نقطة حقيقية إلى محفظته وتعميم الإنجاز في تطبيق العائلة كله!</p>
              
              <button
                onClick={awardWinnerRealPoints}
                disabled={pushedToFirestore}
                className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  pushedToFirestore 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95'
                }`}
              >
                {pushedToFirestore ? 'تم صرف الجائزة للبطل بنجاح! 👑' : 'نعم، اصرف 50 نقطة كنز في المحفظة! 🪙'}
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-summer-text/40 italic">اللاعب الفائز يلعب كضيف، ولا يحتاج لمزامنة النقاط مع قاعدة البيانات.</p>
          )}

          {/* Restart option */}
          <button
            onClick={() => {
              setGameState('lobby');
              setWinner(null);
            }}
            className="w-full bg-white/15 hover:bg-white/20 text-summer-text py-3.5 rounded-2xl font-black text-xs transition-all border border-white/10 active:scale-95 flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            العب مباراة جديدة من البداية 🎮
          </button>
        </div>
      )}

    </div>
  );
};
