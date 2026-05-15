import React from 'react';
import { motion } from 'motion/react';
import { signInWithGoogle } from '../lib/firebase';
import { LogIn, Sparkles } from 'lucide-react';

export const Login: React.FC = () => {
  return (
    <div className="min-h-screen bg-navy-dark flex items-center justify-center p-4 overflow-hidden relative">
      {/* Decorative background atoms */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-navy rounded-[40px] p-12 shadow-2xl relative z-10 text-center border border-white/5 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-50" />
        
        <div className="w-24 h-24 gold-gradient rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-[0_10px_40px_rgba(212,175,55,0.2)]">
          <Sparkles className="text-navy-dark" size={48} />
        </div>
        
        <h1 className="text-4xl font-black text-gold mb-3 tracking-tighter">مهام عائلية</h1>
        <p className="text-blue-200/50 mb-10 text-sm leading-relaxed max-w-[240px] mx-auto font-medium">حول المهام المنزلية إلى جوائز قيمة بنظام ذكي وعملي</p>
        
        <button
          onClick={signInWithGoogle}
          className="w-full bg-white text-navy-dark rounded-2xl py-5 flex items-center justify-center gap-4 transition-all active:scale-95 group font-black text-lg shadow-xl hover:bg-gold-light hover:shadow-gold/20"
        >
          <LogIn size={24} className="group-hover:translate-x-[-4px] transition-transform" />
          <span>الدخول باستخدام جوجل</span>
        </button>
        
        <div className="mt-14 pt-8 border-t border-white/5 flex justify-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/20">
          <span>أمان تام</span>
          <span>بسيط</span>
          <span>ذكي</span>
        </div>
      </motion.div>
    </div>
  );
};
