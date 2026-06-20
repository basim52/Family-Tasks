import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, DailyTask } from '../types';
import { 
  Plus, 
  Check, 
  Calendar, 
  Clock, 
  Award, 
  AlertCircle,
  TrendingUp, 
  CheckCircle, 
  XCircle,
  HelpCircle,
  User,
  Trash2,
  CalendarCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Help functions to fetch current week details
const getDatesForCurrentWeek = () => {
  const current = new Date();
  const dayOfCurrent = current.getDay(); // 0 is Sunday, 1 is Monday...
  // Let Sunday be the first day of our Arabic week
  const sunday = new Date(current);
  sunday.setDate(current.getDate() - dayOfCurrent);
  
  const days = [];
  const arabicDayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(sunday);
    nextDay.setDate(sunday.getDate() + i);
    const dateString = nextDay.toISOString().split('T')[0]; // "YYYY-MM-DD"
    days.push({
      dateString,
      dayNumber: nextDay.getDate(),
      dayName: arabicDayNames[i],
      rawDate: nextDay,
    });
  }
  return days;
};

interface DailyTasksPageProps {
  profile: UserProfile;
}

export default function DailyTasksPage({ profile }: DailyTasksPageProps) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [familyMembers, setFamilyMembers] = useState<UserProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>(profile.role === 'parent' ? '' : profile.uid);
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('12:00');
  const [newTaskEndTime, setNewTaskEndTime] = useState('13:00');
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskPoints, setNewTaskPoints] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const isParent = profile.role === 'parent';
  const weekDays = getDatesForCurrentWeek();

  // Load family members if user is parent
  useEffect(() => {
    if (!isParent) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      const children = members.filter(m => m.role === 'child');
      setFamilyMembers(children);
      if (children.length > 0 && !selectedChildId) {
        setSelectedChildId(children[0].uid);
      }
    });
    return () => unsubscribe();
  }, [isParent]);

  // Load Tasks for the active user/child
  const targetUserId = isParent ? selectedChildId : profile.uid;

  useEffect(() => {
    if (!targetUserId) return;
    
    // Fetch all tasks for current week to calculate statistics, filter by date later dynamically
    const q = query(
      collection(db, 'dailyTasks'),
      where('userId', '==', targetUserId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyTask));
      
      // Sort in memory by createdAt desc safely
      fetchedTasks.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return bTime - aTime;
      });
      
      // Auto-update expired tasks locally & check if we need to write back status for outdated tasks
      const now = new Date();
      const updatedTasks = await Promise.all(fetchedTasks.map(async (task) => {
        // Construct task deadline using task.endTime (or fall back to task.time if not present)
        const expirationTime = task.endTime || task.time;
        const [hour, sec] = expirationTime.split(':');
        const taskDeadline = new Date(task.date);
        taskDeadline.setHours(Number(hour || 12), Number(sec || 0), 0, 0);

        if (task.status === 'pending' && now > taskDeadline) {
          // If in past, mark as expired in DB asynchronously
          try {
            await updateDoc(doc(db, 'dailyTasks', task.id), { status: 'expired' });
          } catch (e) {
            console.error('Failed to auto-expire task:', e);
          }
          return { ...task, status: 'expired' as const };
        }
        return task;
      }));

      setTasks(updatedTasks);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'dailyTasks');
    });

    return () => unsubscribe();
  }, [targetUserId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      setFormError('يرجى كتابة عنوان المهمة اليومية!');
      return;
    }
    setFormError('');
    setIsSubmitting(true);

    try {
      const taskUserId = isParent ? selectedChildId : profile.uid;
      const taskUserName = isParent 
        ? (familyMembers.find(m => m.uid === selectedChildId)?.displayName || 'بطل عائلي')
        : (profile.displayName || 'بطل عائلي');

      if (!taskUserId) {
        setFormError('برجاء اختيار الطفل المستهدف أولاً!');
        setIsSubmitting(false);
        return;
      }

      // Validate time order
      const [startH, startM] = newTaskTime.split(':').map(Number);
      const [endH, endM] = newTaskEndTime.split(':').map(Number);
      if (startH * 60 + startM >= endH * 60 + endM) {
        setFormError('يرجى التأكد من أن وقت الانتهاء يأتي بعد وقت البدء!');
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, 'dailyTasks'), {
        title: newTaskTitle.trim(),
        userId: taskUserId,
        userName: taskUserName,
        date: newTaskDate,
        time: newTaskTime,
        endTime: newTaskEndTime,
        points: Number(newTaskPoints) || 0,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Notify user / child about new daily task
      if (isParent && taskUserId !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: taskUserId,
          title: 'مهمة يومية جديدة! 🗓️✨',
          body: `لقد أضاف الأهل مهمة يومية جديدة لك بـ [${newTaskTitle}] برصيد ${newTaskPoints} نقاط!`,
          type: 'info',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setNewTaskTitle('');
      // Keep selected day/time for seamless continuous entries
      alert('تم إضافة المهمة اليومية بنجاح بنظام الأوقات والتأكيد الفوري! 🎉');
    } catch (err: any) {
      console.error(err);
      setFormError('حدث خطأ أثناء حفظ المهمة: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTask = async (task: DailyTask) => {
    if (task.status === 'expired') {
      alert('هذه المهمة منتهية الصلاحية ومغلقة لانتهاء الوقت المحدد لها! ⏳');
      return;
    }

    const isCurrentlyCompleted = task.status === 'completed';
    const newStatus = isCurrentlyCompleted ? 'pending' : 'completed';

    try {
      // Find user to grant points
      const taskUserRef = doc(db, 'users', task.userId);
      const pointsDiff = task.points || 0;

      if (newStatus === 'completed') {
        // Add real user points if task completed successfully
        await updateDoc(taskUserRef, {
          points: (isParent ? (familyMembers.find(m => m.uid === task.userId)?.points || 0) : profile.points) + pointsDiff
        });

        // Add real earn transaction
        await addDoc(collection(db, 'transactions'), {
          userId: task.userId,
          userName: task.userName,
          type: 'earn',
          points: pointsDiff,
          currencyAmount: 0,
          status: 'approved',
          requestedAt: serverTimestamp()
        });

        // Send confirmation notification
        await addDoc(collection(db, 'notifications'), {
          userId: task.userId,
          title: 'كفو! أنجزت مهمتك اليومية 🎉💪',
          body: `مبارك الحصول على ${pointsDiff} نقاط لإنجازك: ${task.title}`,
          type: 'success',
          read: false,
          createdAt: serverTimestamp()
        });
      } else {
        // Unchecked task - subtract points safely keeping user above 0
        const currentPoints = isParent 
          ? (familyMembers.find(m => m.uid === task.userId)?.points || 0)
          : profile.points;
        const newPointsValue = Math.max(0, currentPoints - pointsDiff);

        await updateDoc(taskUserRef, {
          points: newPointsValue
        });

        // Record a transaction for rollback or decrease
        await addDoc(collection(db, 'transactions'), {
          userId: task.userId,
          userName: task.userName,
          type: 'redeem',
          points: pointsDiff,
          currencyAmount: 0,
          status: 'approved',
          requestedAt: serverTimestamp()
        });
      }

      await updateDoc(doc(db, 'dailyTasks', task.id), {
        status: newStatus,
        completedAt: newStatus === 'completed' ? serverTimestamp() : null
      });

    } catch (error: any) {
      console.error("Failed to toggle daily task status:", error);
      alert("تعذر تحديث المهمة: " + (error.message || error));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmDelete = window.confirm('هل أنت متأكد من حذف هذه المهمة اليومية نهائياً؟');
    if (!confirmDelete) return;

    try {
      const taskRef = doc(db, 'dailyTasks', taskId);
      await updateDoc(taskRef, { status: 'expired' }); // Lock or delete. Let's physically delete for custom list comfort!
      // To keep it 100% clean, let's delete
      // Actually we can do write:
      // Wait, firestore rules allows write if signedIn. So delete is perfectly permitted!
      // But instead of standard physical delete, we can also modify collections or delete directly
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(taskRef);
    } catch (e: any) {
      console.error(e);
      alert('فشل حذف المهمة: ' + e.message);
    }
  };

  // Filter tasks to show for the selected day
  const filteredTasks = tasks.filter(t => t.date === selectedDay);

  // Compute Weekly Statistics
  // Filter all tasks belonging to the current week strip
  const weekDateStrings = weekDays.map(d => d.dateString);
  const currentWeekTasks = tasks.filter(t => weekDateStrings.includes(t.date));
  
  const completedCount = currentWeekTasks.filter(t => t.status === 'completed').length;
  const expiredCount = currentWeekTasks.filter(t => t.status === 'expired').length;
  const pendingCount = currentWeekTasks.filter(t => t.status === 'pending').length;
  const totalWeekTasks = currentWeekTasks.length;
  
  const completionPercentage = totalWeekTasks > 0 
    ? Math.round((completedCount / totalWeekTasks) * 100) 
    : 0;

  // Evaluation Message
  const getWeeklyFeedback = (percentage: number) => {
    if (totalWeekTasks === 0) return 'لا يوجد مهام مجدولة لهذا الأسبوع حتى الآن. ابدأ بإضافة المهام اليومية المرتبة! 🗓️';
    if (percentage >= 90) return 'تقييم أسطوري! 🌟👑 أنت بطل خارق وملتزم بجدولك بالكامل!';
    if (percentage >= 70) return 'تقييم بطل مميز! 🚀🔥 إنجاز رائع وسعي استثنائي نحو القمة!';
    if (percentage >= 50) return 'عمل جيد ورائع! 👍✨ واصل تنظيم وقتك وإكمال أهدافك اليومية!';
    return 'حفّز نفسك وحاول التعويض في الأيام القادمة! 🎯⚡ تنظيم الوقت طريقك للنجاح!';
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-32">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/5 border border-white/10 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <CalendarCheck className="text-amber-400 w-8 h-8 animate-bounce" />
            <h1 className="text-2xl font-black text-white">اصنع مهامك اليومية 🗓️🔑</h1>
          </div>
          <p className="text-xs text-brand-text/60">
            خطط ورتب يومك بساعات المعيشة المحددة، كافئ نفسك بالتأكيد الفوري وعش متعة النجاح!
          </p>
        </div>

        {/* Parent Selector / Indicator */}
        {isParent ? (
          <div className="z-10 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl flex items-center gap-3">
            <span className="text-xs font-bold text-amber-300">عرض أبطال العائلة:</span>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="bg-slate-900 border border-white/20 text-white rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-amber-400"
            >
              <option value="" disabled>اختر البطل...</option>
              {familyMembers.map(child => (
                <option key={child.uid} value={child.uid}>{child.displayName}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="z-10 bg-amber-500/15 border border-amber-500/20 px-4 py-3 rounded-2xl flex items-center gap-2.5">
            <TrendingUp size={16} className="text-amber-400" />
            <span className="text-xs font-black text-white">الملف الشخصي: {profile.displayName} 🌟</span>
          </div>
        )}
      </div>

      {/* Weekly Evaluation Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Right Card: Main Progress Metric */}
        <div className="md:col-span-2 bg-gradient-to-br from-purple-900/40 to-slate-900 border border-white/10 p-6 rounded-[2.5rem] shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-brand-accent/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white/50 tracking-wider">الحصاد الأسبوعي المنظم</span>
              <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 animate-pulse">
                الأسبوع الحالي ✓
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">معدل تحقيق المهام</h3>
              <p className="text-xs text-brand-text/80 leading-relaxed font-medium">
                {getWeeklyFeedback(completionPercentage)}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center text-xs font-black text-white/75">
              <span>نسبة تحقيق الأهداف اليومية</span>
              <span className="text-amber-400 text-lg font-black">{completionPercentage}%</span>
            </div>
            
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-2xl space-y-0.5">
                <span className="block text-[8px] text-emerald-400 font-bold">المهام المكتملة</span>
                <span className="block text-sm font-black text-white">{completedCount}</span>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-2xl space-y-0.5">
                <span className="block text-[8px] text-red-400 font-bold">المهام الفائتة</span>
                <span className="block text-sm font-black text-white">{expiredCount}</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-2xl space-y-0.5">
                <span className="block text-[8px] text-amber-400 font-bold">انتظار الإكمال</span>
                <span className="block text-sm font-black text-white">{pendingCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Left Card: Fast Task Authoring Form */}
        <div className="bg-slate-900 border border-white/10 p-6 rounded-[2.5rem] shadow-xl">
          <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
            <Plus size={16} className="text-amber-400" />
            أنشئ مهمتك فوراً
          </h3>

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-white/50 font-bold">اسم المهمة اليومية</label>
              <input 
                type="text" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="مثال: مراجعة سورة الملك، ترتيب غرفتي..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-bold text-right"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-white/50 font-bold">التاريخ</label>
              <input 
                type="date" 
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-bold text-center"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/50 font-bold">وقت البدء</label>
                <input 
                  type="time" 
                  value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-bold text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-white/50 font-bold">وقت الانتهاء</label>
                <input 
                  type="time" 
                  value={newTaskEndTime}
                  onChange={(e) => setNewTaskEndTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-bold text-center"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-white/50 font-bold flex justify-between">
                <span>النقاط التحفيزية</span>
                <span className="text-amber-400">{newTaskPoints} نقاط</span>
              </label>
              <input 
                type="range"
                min="0"
                max="20"
                step="1"
                value={newTaskPoints}
                onChange={(e) => setNewTaskPoints(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {formError && (
              <p className="text-[10px] text-red-400 bg-red-400/5 px-2.5 py-1.5 rounded-lg border border-red-400/10 font-bold text-right flex items-center gap-1">
                <AlertCircle size={12} />
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-black rounded-xl text-xs hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'إضافة إلى المخطط اليومي ✨'}
            </button>
          </form>
        </div>
      </div>

      {/* Week Navigation Timeline Strip */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-brand-text/50 uppercase tracking-widest flex items-center gap-2">
          <Calendar size={14} className="text-amber-400 animate-pulse" />
          مخطط الأيام والمهمات
        </h4>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const isToday = day.dateString === new Date().toISOString().split('T')[0];
            const isSelected = day.dateString === selectedDay;
            
            // Check count of tasks for this day
            const dayTaskCount = tasks.filter(t => t.date === day.dateString).length;
            const dayDoneCount = tasks.filter(t => t.date === day.dateString && t.status === 'completed').length;

            return (
              <button
                key={day.dateString}
                onClick={() => setSelectedDay(day.dateString)}
                className={`p-3 rounded-2xl border transition-all relative flex flex-col items-center gap-1 outline-none ${
                  isSelected 
                    ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-xl shadow-amber-500/10 scale-105'
                    : isToday
                    ? 'bg-white/15 border-amber-500/50 text-white'
                    : 'bg-white/5 border-white/5 text-brand-text/70 hover:bg-white/10'
                }`}
              >
                <span className="text-[9px] font-black opacity-80">{day.dayName}</span>
                <span className="text-sm font-black font-sans">{day.dayNumber}</span>
                
                {dayTaskCount > 0 && (
                  <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md ${
                    isSelected ? 'bg-slate-950 text-amber-400' : 'bg-white/10 text-white'
                  }`}>
                    {dayDoneCount}/{dayTaskCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-black text-white/50">
            قائمة مهمات يوم {weekDays.find(d => d.dateString === selectedDay)?.dayName || 'المحدد'} ({selectedDay})
          </span>
          <span className="text-xs text-amber-300 font-bold">
            {filteredTasks.length} مهمات مجدولة
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="bg-white/5 border border-white/5 p-12 text-center rounded-[2.5rem] space-y-2">
            <HelpCircle size={36} className="mx-auto text-white/20" />
            <h5 className="font-bold text-white text-xs">لا توجد مهام في هذا اليوم</h5>
            <p className="text-[10px] text-white/40">استعمل الصندوق في الجهة اليسرى لإنشاء المهمات وترتيب جدولك فورياً!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const isExpired = task.status === 'expired';

                return (
                  <motion.div
                    key={task.id}
                    layoutId={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`p-5 rounded-3xl border transition-all relative overflow-hidden flex items-center justify-between group ${
                      isCompleted 
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : isExpired
                        ? 'bg-red-500/5 border-red-500/10 opacity-70'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Checkmark mark container */}
                      <button
                        onClick={() => handleToggleTask(task)}
                        disabled={isExpired}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all outline-none ${
                          isCompleted
                            ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                            : isExpired
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20 cursor-not-allowed'
                            : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'
                        }`}
                      >
                        {isCompleted ? (
                          <Check size={20} className="stroke-[3]" />
                        ) : isExpired ? (
                          <XCircle size={18} />
                        ) : (
                          <div className="w-2.5 h-2.5 bg-white/40 rounded-full group-hover:scale-125 transition-transform" />
                        )}
                      </button>

                      {/* Info layout */}
                      <div className="space-y-1">
                        <h4 className={`font-black text-xs text-white ${isCompleted ? 'line-through text-white/50' : ''}`}>
                          {task.title}
                        </h4>
                        
                        <div className="flex items-center gap-3 text-[10px] text-white/40 font-bold">
                          <span className="flex items-center gap-1 text-amber-400/80" title="الفترة الزمنية للمهمة">
                            <Clock size={12} />
                            <span>{task.time}</span>
                            {task.endTime && (
                              <>
                                <span className="text-white/30 font-normal">إلى</span>
                                <span>{task.endTime}</span>
                              </>
                            )}
                          </span>
                          
                          {task.points > 0 && (
                            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-md">
                              <Award size={10} />
                              +{task.points} نقاط
                            </span>
                          )}

                          {isExpired && (
                            <span className="text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md text-[9px]">
                              غير مكتملة ومغلقة ⏳
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete option for parents, or children deleting their pending tasks */}
                    {(isParent || (!isCompleted && !isExpired)) && (
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all outline-none md:opacity-0 group-hover:opacity-100"
                        title="حذف المهمة"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}
