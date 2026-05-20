import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  TrendingUp, 
  Award, 
  CheckCircle2, 
  Calendar, 
  Users, 
  BarChart3, 
  CheckSquare, 
  Zap, 
  Star 
} from 'lucide-react';
import { UserProfile, Task } from '../types';

interface FamilyPerformanceChartProps {
  family: UserProfile[];
  tasks: Task[];
}

export const FamilyPerformanceChart: React.FC<FamilyPerformanceChartProps> = ({ family, tasks }) => {
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly'>('weekly');
  const [chartType, setChartType] = useState<'comparison' | 'trend'>('comparison');
  const [activeMetric, setActiveMetric] = useState<'completion' | 'points'>('completion');

  // Filter out parents, only analyze child accounts
  const children = useMemo(() => {
    return family.filter(f => f.role === 'child');
  }, [family]);

  // Safe timestamp parser to robustly handle Firestore Timestamp, Date or Strings
  const parseTaskDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    if (typeof val === 'string' || typeof val === 'number') {
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  // List of colors mapping to children to display distinctive chart lines/bars
  const colors = [
    '#0ea5e9', // Sky Blue
    '#db2777', // Pink
    '#10b981', // Emerald Green
    '#f59e0b', // Amber Orange
    '#8b5cf6', // Violet
  ];

  const getChildColor = (index: number) => colors[index % colors.length];

  // Defined Date ranges
  const rangeConfig = useMemo(() => {
    const now = new Date();
    const daysCount = timeRange === 'weekly' ? 7 : 30;
    const dates: Date[] = [];
    
    // Create UTC baseline for dates to avoid timezone shifting
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      dates.push(d);
    }
    
    return { dates, daysCount };
  }, [timeRange]);

  // Aggregate stats per child in the selected time range
  const childPerformanceStats = useMemo(() => {
    const { dates } = rangeConfig;
    const cutoffDate = dates[0];

    return children.map((child, idx) => {
      // Filter tasks assigned to this child and created/completed within the selected period
      const relevantTasks = tasks.filter(t => {
        if (t.assignedTo !== child.uid) return false;
        const taskDate = parseTaskDate(t.createdAt);
        return taskDate ? taskDate >= cutoffDate : false;
      });

      const totalAssigned = relevantTasks.length;
      const completedTasks = relevantTasks.filter(t => t.status === 'completed' || t.status === 'approved');
      const approvedTasks = relevantTasks.filter(t => t.status === 'approved');

      // Points earned from approved tasks in this window
      const pointsEarned = approvedTasks.reduce((sum, t) => {
        const rewardAmount = t.rewardAmount || t.points || 0;
        return sum + rewardAmount;
      }, 0);

      const completionRate = totalAssigned > 0 
        ? Math.round((completedTasks.length / totalAssigned) * 100) 
        : 0;

      return {
        uid: child.uid,
        displayName: child.displayName || 'بطل',
        totalAssigned,
        completedCount: completedTasks.length,
        approvedCount: approvedTasks.length,
        pointsEarned,
        completionRate,
        color: getChildColor(idx)
      };
    });
  }, [children, tasks, rangeConfig]);

  // Comparison Chart Data (All children side-by-side)
  const comparisonData = useMemo(() => {
    return childPerformanceStats.map(stat => ({
      name: stat.displayName,
      'نسبة الإنجاز (%)': stat.completionRate,
      'النقاط المكتسبة': stat.pointsEarned,
      'عدد المهام الكلية': stat.totalAssigned,
      'المهام المنجزة': stat.completedCount,
      color: stat.color
    }));
  }, [childPerformanceStats]);

  // Daily Trend Chart Data (Day by day)
  const trendData = useMemo(() => {
    const { dates } = rangeConfig;
    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    return dates.map(date => {
      const dayLabel = timeRange === 'weekly' 
        ? arabicDays[date.getDay()] 
        : `${date.getDate()} / ${date.getMonth() + 1}`;

      const dataRow: any = {
        name: dayLabel,
        fullDate: date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
      };

      children.forEach((child, idx) => {
        // Find tasks for this child completed / approved on this specific day
        const dayTasks = tasks.filter(t => {
          if (t.assignedTo !== child.uid) return false;
          const completionDate = parseTaskDate(t.approvedAt || t.completedAt);
          if (!completionDate) return false;
          
          return (
            completionDate.getDate() === date.getDate() &&
            completionDate.getMonth() === date.getMonth() &&
            completionDate.getFullYear() === date.getFullYear()
          );
        });

        if (activeMetric === 'points') {
          // Points generated on this day
          const dayPoints = dayTasks
            .filter(t => t.status === 'approved')
            .reduce((sum, t) => sum + (t.rewardAmount || t.points || 0), 0);
          dataRow[child.displayName] = dayPoints;
        } else {
          // Count of completed tasks on this day
          dataRow[child.displayName] = dayTasks.length;
        }
      });

      return dataRow;
    });
  }, [rangeConfig, children, tasks, activeMetric, timeRange]);

  if (children.length === 0) {
    return (
      <div className="bg-summer-card p-8 rounded-[2.5rem] border border-white/40 shadow-xl text-center">
        <Users size={48} className="mx-auto text-summer-text/30 mb-3 animate-pulse" />
        <h3 className="font-black text-summer-text text-base mb-1">لوحة الإنجاز البياني</h3>
        <p className="text-xs text-summer-text/60">أضف أطفالاً إلى عائلتك لتفعيل لوحات ومخططات التحفيز البياني!</p>
      </div>
    );
  }

  return (
    <section className="bg-summer-card p-6 rounded-[2.5rem] border border-white/40 shadow-xl space-y-6 relative overflow-hidden" id="family-performance-chart">
      {/* Decorative gradient aura */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-summer-primary/5 rounded-full blur-[80px] -z-10 pointer-events-none" />
      
      {/* Header details */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-summer-primary to-summer-accent rounded-xl flex items-center justify-center text-white shadow-lg brand-glow">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-[0.15em] leading-none mb-1.5">مركز التحليل البياني 📊</h3>
            <h4 className="font-black text-summer-text text-base">مستوى النشاط وتراكم الإنجازات</h4>
          </div>
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="bg-white/10 border border-white/10 p-1 rounded-2xl flex gap-1">
            <button 
              onClick={() => setTimeRange('weekly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeRange === 'weekly' ? 'bg-white text-summer-primary shadow-sm' : 'text-summer-text/60 hover:text-summer-text'}`}
            >
              أسبوعي
            </button>
            <button 
              onClick={() => setTimeRange('monthly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeRange === 'monthly' ? 'bg-white text-summer-primary shadow-sm' : 'text-summer-text/60 hover:text-summer-text'}`}
            >
              شهري
            </button>
          </div>
        </div>
      </div>

      {/* Visual Navigation Tabs */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setChartType('comparison')}
          className={`p-4 rounded-3xl border text-right transition-all flex flex-col justify-between ${
            chartType === 'comparison'
              ? 'bg-summer-primary/10 border-summer-primary/40 text-summer-text shadow-md'
              : 'bg-white/15 border-white/10 hover:bg-white/25 text-summer-text/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <BarChart3 size={18} className={chartType === 'comparison' ? 'text-summer-primary' : ''} />
            <span className="text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full">مقارنة</span>
          </div>
          <div>
            <span className="text-xs font-black block">مقارنة أداء الأبطال</span>
            <span className="text-[9px] text-summer-text/40 font-medium">معدلات الإنجاز التراكمية للمهام الكلية</span>
          </div>
        </button>

        <button
          onClick={() => setChartType('trend')}
          className={`p-4 rounded-3xl border text-right transition-all flex flex-col justify-between ${
            chartType === 'trend'
              ? 'bg-summer-primary/10 border-summer-primary/40 text-summer-text shadow-md'
              : 'bg-white/15 border-white/10 hover:bg-white/25 text-summer-text/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <TrendingUp size={18} className={chartType === 'trend' ? 'text-summer-primary' : ''} />
            <span className="text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full">تاريخي</span>
          </div>
          <div>
            <span className="text-xs font-black block">مسار الإنجاز اليومي</span>
            <span className="text-[9px] text-summer-text/40 font-medium">تطور وإنجاز المهام يوماً بعد يوم</span>
          </div>
        </button>
      </div>

      {/* If trend chart is chosen, show metric selector (completion vs points) */}
      {chartType === 'trend' && (
        <div className="flex items-center justify-start gap-2 bg-white/10 p-1 rounded-2xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveMetric('completion')}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 ${
              activeMetric === 'completion'
                ? 'bg-white text-summer-primary shadow-sm'
                : 'text-summer-text/60 hover:text-summer-text'
            }`}
          >
            <CheckSquare size={13} />
            عدد المهام المنجزة
          </button>
          <button
            onClick={() => setActiveMetric('points')}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 ${
              activeMetric === 'points'
                ? 'bg-white text-summer-primary shadow-sm'
                : 'text-summer-text/60 hover:text-summer-text'
            }`}
          >
            <Star size={13} />
            النقاط المستحقة
          </button>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="bg-white/15 p-4 rounded-[2rem] border border-white/20 relative" dir="ltr">
        <div className="h-[280px] sm:h-[350px] w-full">
          {chartType === 'comparison' ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={comparisonData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11, fontWeight: 'bold' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }} 
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#f59e0b', opacity: 0.8, fontSize: 11 }} 
                  axisLine={false}
                  tickLine={false}
                  unit="ن"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255,255,255,0.95)', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    color: '#0f172a',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.8, paddingTop: '10px' }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="نسبة الإنجاز (%)" 
                  fill="var(--primary, #0ea5e9)" 
                  radius={[12, 12, 0, 0]} 
                  maxBarSize={45}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="النقاط المكتسبة" 
                  stroke="#f59e0b" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  {children.map((child, idx) => (
                    <linearGradient key={child.uid} id={`grad_${child.uid}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={getChildColor(idx)} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={getChildColor(idx)} stopOpacity={0.01}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 10, fontWeight: 'bold' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }} 
                  axisLine={false}
                  tickLine={false}
                  unit={activeMetric === 'points' ? 'ن' : ''}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255,255,255,0.95)', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    color: '#0f172a',
                    fontWeight: 'bold',
                    fontSize: '11px'
                  }}
                  labelStyle={{ color: '#64748b', fontSize: '10px' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.8, paddingTop: '10px' }}
                />
                {children.map((child, idx) => (
                  <Area
                    key={child.uid}
                    type="monotone"
                    dataKey={child.displayName}
                    stroke={getChildColor(idx)}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    fillOpacity={1}
                    fill={`url(#grad_${child.uid})`}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Children Performance Cards (Table/Cards Summary in Arabic) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {childPerformanceStats.map((stat) => (
          <div 
            key={stat.uid} 
            className="p-4 rounded-3xl border border-white/20 bg-white/10 hover:bg-white/15 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 mb-3">
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: stat.color }}
              />
              <span className="text-xs font-black text-summer-text">{stat.displayName}</span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-summer-text/50 font-bold">معدل الإنجاز لمهام الفترة</span>
                <span className="font-black text-summer-text" style={{ color: stat.color }}>
                  {stat.completionRate}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${stat.completionRate}%`, backgroundColor: stat.color }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <div className="text-right">
                <span className="text-[8px] text-summer-text/40 block font-bold">نقاط الفترة المعتمدة</span>
                <span className="text-xs font-black text-amber-500 flex items-center gap-0.5">
                  <Star size={11} className="inline fill-amber-500 text-amber-500" />
                  {stat.pointsEarned} ن
                </span>
              </div>
              <div className="text-right border-r border-white/10 pr-2">
                <span className="text-[8px] text-summer-text/40 block font-bold">نسبة المهام</span>
                <span className="text-xs font-black text-summer-text">
                  {stat.completedCount} من {stat.totalAssigned}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
