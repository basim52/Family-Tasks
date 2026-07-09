import React from 'react';
import { motion } from 'motion/react';
import { signInWithGoogle } from '../lib/firebase';
import { 
  LogIn, 
  Sparkles, 
  CheckCircle2, 
  Wallet, 
  BrainCircuit, 
  Users, 
  ArrowRight,
  TrendingUp,
  Star,
  Play
} from 'lucide-react';
import { cn } from '../lib/utils';

const FeatureCard = ({ icon: Icon, title, desc, delay }: { icon: any, title: string, desc: string, delay: number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.8 }}
    className="bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-xl group hover:scale-[1.02] transition-all"
  >
    <div className="w-16 h-16 bg-gradient-to-br from-summer-primary to-summer-accent rounded-3xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:rotate-6 transition-transform">
      <Icon size={32} />
    </div>
    <h3 className="text-xl font-black text-summer-text mb-3">{title}</h3>
    <p className="text-sm text-summer-text/60 leading-relaxed font-medium">{desc}</p>
  </motion.div>
);

export const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-summer-bg overflow-x-hidden relative selection:bg-summer-accent selection:text-white">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-summer-secondary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-summer-primary/20 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] left-[10%] w-32 h-32 bg-summer-accent/10 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-8 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 summer-gradient rounded-xl flex items-center justify-center text-white shadow-lg">
            <Sparkles size={24} />
          </div>
          <span className="text-xl font-black text-summer-text tracking-tighter">Summer Smart</span>
        </div>
        <button 
          onClick={signInWithGoogle}
          className="bg-white/60 backdrop-blur-md border border-white/80 text-summer-text px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-summer-accent hover:text-white transition-all shadow-sm"
        >
          <LogIn size={18} />
          دخول العائلة
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-16 pb-32 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div className="text-right space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-block px-4 py-1.5 bg-summer-accent/10 text-summer-accent rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-summer-accent/20"
          >
            نظام ذكي للتربية الحديثة ✨
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-black text-summer-text leading-[1.1] tracking-tighter"
          >
            اجعل صيف أطفالك <br />
            <span className="text-transparent bg-clip-text summer-gradient">أكثر ذكاءً ومتعة</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-summer-text/60 max-w-xl font-medium leading-relaxed"
          >
            حوّل المهام اليومية إلى تحديات شيقة. نظام متكامل لمتابعة الإنجازات، منح المكافآت، وبناء رؤية عائلية ملهمة باستخدام الذكاء الاصطناعي.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <button 
              onClick={signInWithGoogle}
              className="px-10 py-5 summer-gradient text-white rounded-3xl font-black text-lg flex items-center justify-center gap-4 shadow-2xl shadow-summer-accent/30 hover:scale-105 active:scale-95 transition-all group"
            >
              ابدأ الآن مجاناً
              <ArrowRight size={24} className="group-hover:translate-x-[-4px] transition-transform" />
            </button>
            <div className="flex items-center gap-4 px-6 py-4 bg-white/20 backdrop-blur rounded-3xl border border-white/40">
               <div className="flex -space-x-3 rtl:space-x-reverse">
                 {[1,2,3].map(i => (
                   <img key={i} src={`https://api.dicebear.com/7.x/adventurer/svg?seed=family${i}`} alt="avatar" className="w-10 h-10 rounded-full border-2 border-white bg-summer-card" />
                 ))}
               </div>
               <p className="text-xs font-bold text-summer-text/60 leading-tight">انضم إلى +500 <br /> عائلة ذكية</p>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative lg:h-[600px] flex items-center justify-center"
        >
          {/* Mockup Desktop/Mobile */}
          <div className="relative w-full max-w-[400px] bg-white/40 backdrop-blur-2xl rounded-[3rem] p-4 border border-white/60 shadow-3xl overflow-hidden aspect-[9/16]">
             <div className="w-full h-full bg-summer-bg/50 rounded-[2.5rem] overflow-hidden relative">
                {/* Simulated Content */}
                <div className="p-6 space-y-4">
                   <div className="flex justify-between items-center bg-white/60 p-4 rounded-2xl">
                      <div className="w-8 h-8 rounded-full bg-summer-accent" />
                      <div className="flex-1 mr-3 h-2 bg-summer-text/10 rounded-full" />
                      <div className="w-6 h-6 rounded-lg bg-summer-primary" />
                   </div>
                   <div className="h-40 bg-summer-primary/20 rounded-2xl animate-pulse" />
                   <div className="grid grid-cols-2 gap-3">
                      <div className="h-24 bg-white/40 rounded-2xl" />
                      <div className="h-24 bg-white/40 rounded-2xl" />
                   </div>
                   <div className="space-y-3">
                      {[1,2,3].map(i => (
                        <div key={i} className="h-12 bg-white/60 rounded-xl" />
                      ))}
                   </div>
                </div>
             </div>
          </div>
          
          {/* Floating Elements */}
          <motion.div 
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-10 -left-10 bg-white p-4 rounded-3xl shadow-2xl flex items-center gap-4 z-20 border border-white/60"
          >
             <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                <CheckCircle2 size={24} />
             </div>
             <div>
                <p className="text-[10px] font-black text-summer-text/40 uppercase">تم الإنجاز!</p>
                <p className="text-xs font-black text-summer-text">تم تنظيف الحديقة</p>
             </div>
          </motion.div>

          <motion.div 
            animate={{ y: [0, 20, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-20 -right-10 bg-white p-6 rounded-[2rem] shadow-2xl z-20 border border-white/60"
          >
             <div className="flex items-center gap-3 mb-3">
                <TrendingUp size={24} className="text-summer-accent" />
                <span className="text-lg font-black text-summer-text">245.50 ريال</span>
             </div>
             <p className="text-[10px] font-bold text-summer-text/40">محفظتك تنمو يا بطل!</p>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 px-6 py-32 bg-white/10">
        <div className="max-w-7xl mx-auto text-center mb-20">
          <h2 className="text-sm font-black text-summer-accent uppercase tracking-[0.4em] mb-4">ليه تسمّر معنا؟</h2>
          <h3 className="text-4xl md:text-5xl font-black text-summer-text">نظام متكامل لنمو طفلك</h3>
        </div>

        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={Sparkles}
            title="مهام ذكية"
            desc="توليد آلي للمهام بناءً على أهداف عائلتك باستخدام أقوى نماذج الذكاء الاصطناعي."
            delay={0.1}
          />
          <FeatureCard 
            icon={Wallet}
            title="تحفيز مالي"
            desc="نظام نقاط يتحرك مع الريال لتحويل الإنجازات إلى مكافآت حقيقية يلمسها الطفل."
            delay={0.2}
          />
          <FeatureCard 
            icon={BrainCircuit}
            title="مستشار شخصي"
            desc="مستشار عائلي ذكي يقدم نصائح تربوية وأفكار خارج الصندوق لحل الخلافات العائلية."
            delay={0.3}
          />
        </div>
      </section>

      {/* Social Proof / Vision */}
      <section className="relative z-10 px-6 py-32 max-w-5xl mx-auto text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          className="bg-summer-card p-12 md:p-20 rounded-[3.5rem] border border-white/40 shadow-3xl space-y-8"
        >
          <div className="w-20 h-20 bg-white/40 rounded-full flex items-center justify-center mx-auto shadow-inner">
             <Star className="text-summer-secondary fill-summer-secondary" size={40} />
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-summer-text leading-tight">
            "نظام الصيف الذكي لم يكن مجرد تطبيق، بل كان بداية لثقافة جديدة في منزلنا."
          </h2>
          <div className="flex items-center justify-center gap-4">
             <div className="w-12 h-12 rounded-full border-2 border-white bg-summer-accent" />
             <div className="text-right">
                <p className="font-black text-summer-text">أم سارة</p>
                <p className="text-xs text-summer-text/40">مسؤولة عائلة ذكية</p>
             </div>
          </div>
        </motion.div>
      </section>

      {/* CTA Bottom */}
      <section className="relative z-10 px-6 py-32 text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full summer-gradient opacity-10 rounded-full blur-[160px]" />
        
        <h2 className="text-5xl md:text-7xl font-black text-summer-text mb-10">صيفك أذكى بضغطة زر</h2>
        <button 
          onClick={signInWithGoogle}
          className="px-16 py-8 bg-summer-text text-white rounded-[2.5rem] font-black text-2xl shadow-3xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4 mx-auto"
        >
          ابدأ مجاناً الآن
          <Sparkles size={32} />
        </button>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-white/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
           <div className="flex items-center gap-3 opacity-50">
             <div className="w-6 h-6 summer-gradient rounded-lg" />
             <span className="text-sm font-black text-summer-text">Summer Smart System</span>
           </div>
           <div className="flex gap-8 text-xs font-bold text-summer-text/40">
             <a href="#" className="hover:text-summer-accent transition-colors">عن النظام</a>
             <a href="#" className="hover:text-summer-accent transition-colors">الشروط والأحكام</a>
             <a href="#" className="hover:text-summer-accent transition-colors">تواصل معنا</a>
           </div>
           <p className="text-[10px] font-bold text-summer-text/20 uppercase tracking-[0.3em]">Built with AI for Families</p>
        </div>
      </footer>
    </div>
  );
};
