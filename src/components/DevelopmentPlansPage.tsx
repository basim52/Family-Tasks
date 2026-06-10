import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  getDoc, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, DevelopmentPlan, Milestone } from '../types';
import { 
  Compass, 
  Plus, 
  CheckCircle, 
  Award, 
  TrendingUp, 
  User, 
  Sparkles, 
  Trash2, 
  PlusCircle, 
  Clock, 
  Milestone as MilestoneIcon,
  CheckCircle2, 
  Heart,
  Calendar
} from 'lucide-react';

export const DevelopmentPlansPage = ({ profile }: { profile: UserProfile | null }) => {
  const [plans, setPlans] = useState<DevelopmentPlan[]>([]);
  const [children, setChildren] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'view' | 'create'>('view');
  
  // Directives for creating new plan
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetChildId, setTargetChildId] = useState('');
  const [rewardAmount, setRewardAmount] = useState('200'); // defaults to 200 points
  const [milestonesText, setMilestonesText] = useState<string[]>(['', '']); // default empty milestones
  
  const isParent = profile?.role === 'parent';

  useEffect(() => {
    if (!profile) return;

    // Fetch development plans from firestore ordered by date
    const qPlans = query(
      collection(db, 'developmentPlans'), 
      orderBy('createdAt', 'desc')
    );

    const unsubPlans = onSnapshot(qPlans, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DevelopmentPlan));
      
      // Filter if child
      if (!isParent) {
        setPlans(fetched.filter(p => p.assignedTo === profile.uid));
      } else {
        setPlans(fetched);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error reading development plans", err);
      setLoading(false);
    });

    // Fetch children if parent
    let unsubFamily = () => {};
    if (isParent) {
      unsubFamily = onSnapshot(collection(db, 'users'), (snapshot) => {
        const familyList = snapshot.docs.map(doc => doc.data() as UserProfile);
        setChildren(familyList.filter(u => u.role === 'child'));
        if (familyList.filter(u => u.role === 'child').length > 0 && !targetChildId) {
          setTargetChildId(familyList.filter(u => u.role === 'child')[0].uid);
        }
      });
    }

    return () => {
      unsubPlans();
      unsubFamily();
    };
  }, [profile, isParent]);

  const handleAddMilestoneField = () => {
    setMilestonesText([...milestonesText, '']);
  };

  const handleRemoveMilestoneField = (index: number) => {
    if (milestonesText.length <= 1) return;
    const filtered = milestonesText.filter((_, idx) => idx !== index);
    setMilestonesText(filtered);
  };

  const handleMilestoneTextChange = (index: number, val: string) => {
    const updated = [...milestonesText];
    updated[index] = val;
    setMilestonesText(updated);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isParent) return;

    if (!title.trim()) {
      alert("الرجاء إدخال عنوان الخطة التطويرية!");
      return;
    }

    const filledMilestones = milestonesText.filter(m => m.trim().length > 0);
    if (filledMilestones.length === 0) {
      alert("الرجاء إضافة هدف فرعي واحد على الأقل للخطة التطويرية!");
      return;
    }

    const selectedChild = children.find(c => c.uid === targetChildId);
    if (!selectedChild) {
      alert("الرجاء اختيار البطل المستهدف!");
      return;
    }

    const rewardCoinsNum = parseInt(rewardAmount, 10);
    if (isNaN(rewardCoinsNum) || rewardCoinsNum <= 0) {
      alert("الرجاء تحديد قيمة مكافأة صالحة!");
      return;
    }

    try {
      const newPlan = {
        title: title.trim(),
        description: description.trim(),
        assignedTo: selectedChild.uid,
        assignedToName: selectedChild.displayName || 'بطل',
        creatorId: profile.uid,
        creatorName: profile.displayName || 'الأهل',
        rewardCoins: rewardCoinsNum,
        status: 'active' as const,
        milestones: filledMilestones.map((mText, idx) => ({
          id: `milestone_${Date.now()}_${idx}`,
          title: mText.trim(),
          completed: false
        })),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'developmentPlans'), newPlan);

      // Create notification
      await addDoc(collection(db, 'notifications'), {
        userId: selectedChild.uid,
        title: '🌱 خريطة تطويرية جديدة بانتظارك!',
        body: `لقد صمم الأهل لك خطة جديدة بعنوان (${title.trim()})، أنجز مهامها لتجمع مكافأة ${rewardCoinsNum} نقطة! 💪`,
        type: 'development_plan',
        read: false,
        createdAt: serverTimestamp()
      });

      // Reset states
      setTitle('');
      setDescription('');
      setMilestonesText(['', '']);
      setActiveTab('view');
      alert('تم إنشاء وتفعيل الخطة التطويرية بنجاح وإرسال تم به للبطل! 🎯🌱');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الخطة التطويرية، يرجى المحاولة لاحقاً.');
    }
  };

  const handleMarkMilestone = async (plan: DevelopmentPlan, milestoneId: string) => {
    if (!profile) return;

    const planRef = doc(db, 'developmentPlans', plan.id);
    const updatedMilestones = plan.milestones.map(m => {
      if (m.id === milestoneId) {
        return {
          ...m,
          completed: !m.completed,
          completedAt: !m.completed ? new Date().toISOString() : null
        };
      }
      return m;
    });

    const allFinished = updatedMilestones.every(m => m.completed);
    const becameCompleted = allFinished && plan.status === 'active';

    try {
      if (becameCompleted) {
        const confirmComp = window.confirm(`تهانينا! يبدو أن كافة الأهداف في "${plan.title}" تم إنجازها! هل تريد إكمال الخطة وصرف مكافأة ${plan.rewardCoins} نقطة للبطل ${plan.assignedToName}؟ 🏆`);
        if (!confirmComp) return;

        // Upgrade in firestore
        await updateDoc(planRef, {
          milestones: updatedMilestones,
          status: 'completed',
          completedAt: serverTimestamp()
        });

        // Add reward coins to Child
        const childRef = doc(db, 'users', plan.assignedTo);
        await updateDoc(childRef, {
          points: increment(plan.rewardCoins),
          totalPointsEarned: increment(plan.rewardCoins)
        });

        // Add transaction ledger entry
        await addDoc(collection(db, 'transactions'), {
          userId: plan.assignedTo,
          userName: plan.assignedToName,
          type: 'earn',
          points: plan.rewardCoins,
          currencyAmount: 0,
          status: 'approved',
          requestedAt: serverTimestamp(),
          processedAt: serverTimestamp(),
          description: `إكمال الخطة التطويرية بنجاح: ${plan.title}`
        });

        // Create success notify
        await addDoc(collection(db, 'notifications'), {
          userId: plan.assignedTo,
          title: '🎉 مبارك! كسبت مكافأة خطتك التطويرية!',
          body: `بطل حقيقي! أكملت خطة (${plan.title}) وحصلت على ${plan.rewardCoins} نقطة مبارك! 🏆✨`,
          type: 'development_plan_complete',
          read: false,
          createdAt: serverTimestamp()
        });

        alert(`رائع جداً! تم إكمال الخطة بنجاح وصرف ${plan.rewardCoins} نقطة إلى رصيد البطل ${plan.assignedToName}! 🥳✨`);
      } else {
        // Just update status of milestone
        await updateDoc(planRef, {
          milestones: updatedMilestones
        });
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في تعديل حالة الهدف، يرجى المحاولة ثانية.');
    }
  };

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      {/* Dynamic compass banner */}
      <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/30 to-slate-900/40 p-6 rounded-[2.5rem] border border-white/10 space-y-4 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center text-slate-900 shadow-xl">
            <Compass size={30} className="className" />
          </div>
          <div>
            <h2 className="font-extrabold text-white text-xl">البوصلة والخطط التطويرية للأبطال 🎯🌱</h2>
            <p className="text-xs text-white/60 mt-0.5 font-bold">خرائط تنمية وهداية سلوكية وتربوية مصممة بحب لتعزيز الهمم والإنجاز والوصول لـ 200 نقطة!</p>
          </div>
        </div>
      </div>

      {/* Navigation tabs for Parent */}
      {isParent && (
        <div className="grid grid-cols-2 gap-3 bg-white/5 p-2 rounded-2xl border border-white/5">
          <button
            onClick={() => setActiveTab('view')}
            className={`py-3.5 px-4 rounded-xl font-black text-xs transition-all ${
              activeTab === 'view'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 shadow-md scale-102'
                : 'text-white/60 hover:text-white'
            }`}
          >
            تتبع الخطط ومسارات الأبطال 📈
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`py-3.5 px-4 rounded-xl font-black text-xs transition-all ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 shadow-md scale-102'
                : 'text-white/60 hover:text-white'
            }`}
          >
            تأسيس خطة تميز تفاعلية ➕
          </button>
        </div>
      )}

      {/* CREATE TAB */}
      {isParent && activeTab === 'create' && (
        <form onSubmit={handleCreatePlan} className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 space-y-6 shadow-xl">
          <div className="space-y-1">
            <label className="text-xs font-black text-white/50 block">1. البطل المستهدف بالخطة 👑</label>
            <select
              value={targetChildId}
              onChange={(e) => setTargetChildId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 text-white rounded-2xl p-4 text-xs font-black outline-none focus:border-emerald-500 transition-colors"
            >
              {children.map(c => (
                <option key={c.uid} value={c.uid} className="bg-slate-900 text-white">
                  👑 البطل: {c.displayName} (النقاط الحالية: {c.points || 0})
                </option>
              ))}
              {children.length === 0 && (
                <option value="">لا يوجد أبطال مسجلين بعد</option>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-white/50 block">2. اسم الخطة التطويرية 🏷️</label>
            <input 
              type="text"
              placeholder="مثال: خطة حفظ سورة الملك والالتزام بصلوات الفجر 🕋"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black/40 border border-white/10 text-white rounded-2xl p-4 text-xs font-black outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-white/50 block">3. تفاصيل الخطة وأهدافها التربوية 💡</label>
            <textarea
              placeholder="وصف الخطة.. اكتب للطفل كلمات تشجيعية هنا تحدد تطلعاتك المميزة له!"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-black/40 border border-white/10 text-white rounded-2xl p-4 text-xs font-black outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-white/50 block">4. قيمة الجائزة ومكافأة التقدم (نقاط) 💎</label>
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl px-4 py-1">
              <span className="text-[10px] text-white/40 shrink-0 font-bold">مكافأة الإنجاز الكلي:</span>
              <input
                type="number"
                min="10"
                max="2000"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
                className="w-full bg-transparent font-mono text-center font-black text-white outline-none py-3 text-sm"
              />
              <span className="text-[10px] text-emerald-400 shrink-0 font-bold">نقطة تميز</span>
            </div>
            <p className="text-[9px] text-white/40 mt-1">تمنح هذه النقاط تلقائياً للبطل في رصيده فور قيامكم بتأكيد إنجاز كافة أهداف الخطة.</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-white/50 block">5. المحطات والأهداف الفرعية المطلوبة 🏁</label>
              <button
                type="button"
                onClick={handleAddMilestoneField}
                className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1 hover:text-emerald-300 transition-colors"
              >
                <PlusCircle size={14} /> إضافة هدف فرعي
              </button>
            </div>

            <div className="space-y-3">
              {milestonesText.map((mText, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-400 shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder={`هدف فرعي رقم ${idx + 1} (مثال: تسميع المقطع الأول كاملاً غيباً)`}
                    value={mText}
                    onChange={(e) => handleMilestoneTextChange(idx, e.target.value)}
                    className="flex-1 bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    disabled={milestonesText.length <= 1}
                    onClick={() => handleRemoveMilestoneField(idx)}
                    className="p-3 text-red-400 bg-red-500/5 hover:bg-red-500/15 rounded-xl transition-all disabled:opacity-20"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 text-xs font-black rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-900 transition-all active:scale-[0.98] shadow-xl hover:shadow-emerald-500/10 flex items-center justify-center gap-2"
          >
            <Sparkles size={16} /> تفعيل الخطة وإرسال المسار التربوي للبطل 🚀
          </button>
        </form>
      )}

      {/* VIEW / TRACK TAB */}
      {(activeTab === 'view' || !isParent) && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-white/30 font-black text-xs animate-pulse">
              جاري فحص خطط الأبطال التربوية والمسارات..
            </div>
          ) : plans.length === 0 ? (
            <div className="bg-white/5 border border-white/5 p-12 rounded-[2.5rem] text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-white/20 mx-auto">
                <Compass size={32} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white/60">لا يوجد خطط تطويرية مفعلة حالياً!</h4>
                <p className="text-[10px] text-white/35 mt-1 leading-relaxed">
                  {isParent 
                    ? 'بإمكانك رسم مسار نمو وتطوير خاص لأبطالك لتغيير سلوكياتهم وتعزيز مهاراتهم بالنقاط!'
                    : 'انتظر حتى يقوم الأهل بصنع وتخصيص خطة تفوق مذهلة لك!'
                  }
                </p>
              </div>
              {isParent && (
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-lg text-[10px] hover:shadow-lg transition-all"
                >
                  صياغة أول خطة تطويرية الآن ✨
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => {
                const totalM = plan.milestones.length;
                const completedM = plan.milestones.filter(m => m.completed).length;
                const pct = totalM > 0 ? Math.round((completedM / totalM) * 100) : 0;
                const isCompletedPlan = plan.status === 'completed';

                return (
                  <div 
                    key={plan.id}
                    className={`p-6 rounded-[2.5rem] border transition-all space-y-4 relative overflow-hidden group ${
                      isCompletedPlan 
                        ? 'bg-gradient-to-r from-emerald-950/20 to-teal-900/10 border-emerald-500/20' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Visual Stamp */}
                    <div className="absolute top-4 left-4 flex items-center gap-1.5">
                      {isCompletedPlan ? (
                        <span className="text-[8px] font-black tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded-xl flex items-center gap-0.5">
                          كتمل بنجاح 🏆
                        </span>
                      ) : (
                        <span className="text-[8px] font-black tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-1 rounded-xl flex items-center gap-0.5">
                          مستمر ويتم بالحب 🌱
                        </span>
                      )}
                    </div>

                    {/* Target hero info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white font-serif font-black text-sm">
                        ✨
                      </div>
                      <div>
                        {isParent && (
                          <div className="text-[9px] text-white/50 font-bold flex items-center gap-1 mb-0.5">
                            <User size={10} /> البطل المستهدف: <span className="text-amber-400 font-extrabold">{plan.assignedToName}</span>
                          </div>
                        )}
                        <h4 className="text-white font-extrabold text-sm">{plan.title}</h4>
                      </div>
                    </div>

                    {plan.description && (
                      <p className="text-[10px] text-white/60 leading-relaxed font-bold bg-black/15 p-3 rounded-2xl border border-white/5">
                        {plan.description}
                      </p>
                    )}

                    {/* Progress tracking */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center text-[10px] text-white/40 font-bold">
                        <span>الهمّة وقوة التقدم والالتزام</span>
                        <span className="text-white/80 font-mono font-black">{completedM} / {totalM} هدف ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden p-[1px] border border-white/5">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 bg-gradient-to-lr ${
                            isCompletedPlan ? 'from-emerald-500 to-teal-400' : 'from-amber-500 to-emerald-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Checkboxes for milestones */}
                    <div className="space-y-2.5 pt-2 border-t border-white/5">
                      <p className="text-[9px] font-black text-white/30">خطوات ومحطات الإنجاز اليومية:</p>
                      <div className="space-y-2">
                        {plan.milestones.map((milestone) => (
                          <button
                            key={milestone.id}
                            disabled={isCompletedPlan}
                            onClick={() => handleMarkMilestone(plan, milestone.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all group/item ${
                              milestone.completed 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                                : 'bg-black/20 border-white/5 text-white/70 hover:border-white/10 hover:bg-black/35'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                              milestone.completed 
                                ? 'bg-emerald-500 border-emerald-400 text-slate-900' 
                                : 'border-white/20 group-hover/item:border-white/40'
                            }`}>
                              {milestone.completed && <CheckCircle className="p-0.25" size={14} />}
                            </div>
                            <span className={`text-[10px] font-bold ${milestone.completed ? 'line-through opacity-60' : ''}`}>
                              {milestone.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reward badge banner */}
                    <div className="flex justify-between items-center bg-black/15 p-3 rounded-2xl border border-dashed border-white/10 text-xs">
                      <div className="flex items-center gap-1.5 text-white/60 text-[9px] font-bold">
                        <Award size={16} className="text-amber-400" />
                        المكافأة التربوية الكبرى:
                      </div>
                      <span className="font-black text-emerald-400 font-mono text-xs">
                        +{plan.rewardCoins} نقطة مميزة ✨
                      </span>
                    </div>

                    {/* Completed At Footer */}
                    {isCompletedPlan && plan.completedAt && (
                      <div className="flex justify-between items-center text-[8px] text-white/35 font-bold pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} /> تم إقفال المسار بنجاح ومثالية!
                        </span>
                        <span>
                          {(() => {
                            if (!plan.completedAt) return new Date().toLocaleDateString('ar-EG');
                            if (typeof plan.completedAt.toDate === 'function') return plan.completedAt.toDate().toLocaleDateString('ar-EG');
                            if (plan.completedAt.seconds) return new Date(plan.completedAt.seconds * 1000).toLocaleDateString('ar-EG');
                            return new Date(plan.completedAt).toLocaleDateString('ar-EG');
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sweet Quote Dedicated from Parent Footer */}
      <div className="text-center py-4 bg-white/5 rounded-3xl border border-dashed border-white/10 px-6 space-y-1">
        <p className="text-[10px] font-bold text-white/40">بناء قادة الغد يبدأ بتربية واضحة بالحب!</p>
        <p className="text-[10px] font-extrabold text-amber-300 flex items-center justify-center gap-1">
          <Heart size={10} className="fill-amber-300 text-amber-300" /> شكرا لأنكم مميزون ونفذتم المهام بحب <Heart size={10} className="fill-amber-300 text-amber-300" />
        </p>
      </div>
    </div>
  );
};
