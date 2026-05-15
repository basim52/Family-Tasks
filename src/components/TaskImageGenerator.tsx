import React, { useRef } from 'react';
import { toPng } from 'html-to-image';
import { Task } from '../types';
import { Share2, Download } from 'lucide-react';

interface Props {
  task: Task;
  pointsValue: string; // e.g. "10 نقاط"
}

export const TaskImageGenerator: React.FC<Props> = ({ task, pointsValue }) => {
  const elementRef = useRef<HTMLDivElement>(null);

  const generateImage = async (share = false) => {
    if (!elementRef.current) return;
    
    try {
      const dataUrl = await toPng(elementRef.current, {
        cacheBust: true,
        width: 1200,
        height: 630,
      });

      if (share && navigator.share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `task-${task.id}.png`, { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: task.title,
          text: `مهمة جديدة: ${task.title}`,
        });
      } else {
        const link = document.createElement('a');
        link.download = `task-${task.id}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Error generating image:', err);
    }
  };

  return (
    <div className="flex gap-2">
      {/* Hidden high-quality card for capture */}
      <div className="fixed -left-[2000px] top-0 pointer-events-none">
        <div 
          ref={elementRef}
          className="w-[1200px] h-[630px] flex flex-col p-12 relative overflow-hidden"
          style={{ 
            background: 'linear-gradient(135deg, #1a365d 0%, #0c1a2c 100%)',
            fontFamily: '"Noto Sans Arabic", sans-serif'
          }}
          dir="rtl"
        >
          {/* Gold Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 border-t-8 border-r-8 border-gold/30 rounded-tr-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 border-b-8 border-l-8 border-gold/30 rounded-bl-3xl" />
          
          <div className="flex-1 flex flex-col justify-between z-10">
            <div className="flex justify-between items-start">
              <div className="bg-gold p-6 rounded-3xl shadow-xl border-4 border-gold-light/50">
                <span className="text-navy text-5xl font-bold">{pointsValue}</span>
              </div>
              <div className="text-right">
                <h2 className="text-gold-light text-3xl font-medium mb-2 tracking-widest uppercase">مهام عائلية</h2>
                <div className="h-1 w-32 bg-gold ml-auto" />
              </div>
            </div>

            <div className="text-center px-12">
              <h1 className="text-white text-7xl font-bold mb-8 leading-tight drop-shadow-lg">
                {task.title}
              </h1>
              <p className="text-slate-300 text-3xl leading-relaxed max-w-3xl mx-auto">
                {task.description}
              </p>
            </div>

            <div className="flex justify-between items-center bg-white/5 p-8 rounded-2xl border border-white/10">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-gold rounded-full flex items-center justify-center text-navy text-4xl font-bold">
                  {task.assignedToName?.charAt(0) || '؟'}
                </div>
                <div>
                  <p className="text-gold-light text-xl mb-1">مسندة إلى</p>
                  <p className="text-white text-3xl font-bold">{task.assignedToName || 'الجميع'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-lg">تحويـل المهـام إلى جـوائز</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => generateImage(true)}
        className="p-2 bg-navy text-white rounded-lg hover:bg-navy/80 transition-colors flex items-center gap-2 text-sm"
        title="مشاركة عبر واتساب"
      >
        <Share2 size={16} />
        <span>واتساب</span>
      </button>
      <button
        onClick={() => generateImage(false)}
        className="p-2 bg-gold text-navy rounded-lg hover:bg-gold/80 transition-colors flex items-center gap-2 text-sm"
        title="تحميل كصورة"
      >
        <Download size={16} />
        <span>حفظ</span>
      </button>
    </div>
  );
};
