import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.use("/api", (req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV, time: new Date().toISOString() });
  });

  const cleanJson = (text: string) => {
    return (text || '').replace(/```json\n?|```/g, '').trim();
  };

  // Local fallbacks for AI
  const localFallbacks = {
    challenges: [
      { title: "تحدي القراءة العائلية", description: "اجتمعوا لقراءة قصة قصيرة معاً لمدة 15 دقيقة.", points: 15 },
      { title: "تحدي الطبخ المشترك", description: "ساعدوا في تحضير وجبة الغداء اليوم كفريق واحد.", points: 20 },
      { title: "يوم بدون شاشات", description: "ساعة واحدة كاملة بدون هواتف أو تلفاز، العبوا لعبة لوحية.", points: 25 },
      { title: "تحدي اللطف", description: "على كل فرد قول شيء إيجابي عن الآخر عند طاولة الطعام.", points: 10 },
      { title: "ترتيب الزوايا", description: "ترتيب ركن واحد في المنزل بشكل جماعي.", points: 15 }
    ],
    visionGoals: [
      { title: "تحفيظ جزء من القرآن", icon: "🕌" },
      { title: "تعلم مهارة يدوية جديدة", icon: "🎨" },
      { title: "رحلة استكشافية أسبوعية", icon: "🏕️" },
      { title: "تحسين اللياقة البدنية", icon: "🏃" },
      { title: "جلسة حوار عائلية", icon: "💬" }
    ],
    prizes: [
      "نزهة في الحديقة العامة",
      "اختيار فيلم السهرة",
      "طبق الحلوى المفضل",
      "وقت إضافي للعب",
      "هدية بسيطة مفاجئة"
    ]
  };

  app.post("/api/ai/chat", async (req, res, next) => {
    try {
      const { prompt, context } = req.body;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: `${context ? `Context: ${context}\n\n` : ''}${prompt}`,
          config: {
            systemInstruction: "أنت مساعد عائلي ذكي وخبير في التربية وإدارة شؤون المنزل. تساعد العائلات السعودية في تنظيم وقتهم، تحفيز أطفالهم، وتوفير نصائح عملية. تحدث دائماً باللغة العربية بأسلوب ودود ومهني.",
          },
        });
        res.json({ text: response.text });
      } catch (aiErr: any) {
        console.error("AI Chat major error:", aiErr);
        res.json({ 
          text: "أهلاً بك! النظام يعمل حالياً في وضع 'المشاركة العائلية'. تعاونكم اليوم هو سر السعادة والنجاح في بناء ذكريات صيفية رائعة!", 
          isFallback: true 
        });
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/ai/generate-tasks", async (req, res, next) => {
    try {
      const { goal } = req.body;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: `حول هذا الهدف إلى 3-5 مهام عائلية محددة وقابلة للقياس: "${goal}"`,
          config: {
            systemInstruction: "أنت مساعد لإدارة المهام. حول الأهداف العامة إلى مهام صغيرة وواضحة. ارجع الإجابة بتنسيق JSON: { \"tasks\": [ { \"title\": \"...\", \"description\": \"...\", \"points\": 10 } ] }",
            responseMimeType: "application/json",
          },
        });
        res.json(JSON.parse(cleanJson(response.text) || '{}'));
      } catch (aiErr: any) {
        console.error("AI Task Gen failure:", aiErr);
        res.json({
          tasks: [
            { title: "الخطوة الأولى", description: `بدء العمل على هدف: ${goal}`, points: 10 },
            { title: "تجهيز الأدوات", description: "توفير كل ما يلزم للانطلاق", points: 15 },
            { title: "التنفيذ الجماعي", description: "عمل مشترك بين أفراد العائلة", points: 20 },
            { title: "الاحتفال بالإنجاز", description: "مراجعة ما تم بتقدير واهتمام", points: 10 }
          ],
          isFallback: true
        });
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/ai/daily-challenge", async (req, res, next) => {
    try {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: "ولد تحدي عائلي صغير (Micro-challenge) لليوم. يجب أن يكون بسيطاً، ممتعاً، ويشجع على القيم العائلية. ارجع الإجابة بتنسيق JSON: { \"title\": \"...\", \"description\": \"...\", \"points\": 5 }",
          config: {
            systemInstruction: "أنت محفز عائلي. التحدي يجب أن يكون قابلاً للتنفيذ في أقل من 10 دقائق.",
            responseMimeType: "application/json",
          },
        });
        res.json(JSON.parse(cleanJson(response.text) || '{}'));
      } catch (aiErr: any) {
        console.error("AI Daily Challenge failure:", aiErr);
        const randomChallenge = localFallbacks.challenges[Math.floor(Math.random() * localFallbacks.challenges.length)];
        res.json({ ...randomChallenge, isFallback: true });
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/ai/vision-board", async (req, res, next) => {
    try {
      const { familySnapshot } = req.body;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: `بناءً على نشاط العائلة الأخير: "${familySnapshot}"، اقترح 3 أهداف رؤية ملهمة للصيف. ارجع الإجابة بتنسيق JSON: { \"goals\": [ { \"title\": \"...\", \"icon\": \"Emoji\" } ] }`,
          config: {
            systemInstruction: "أنت مستشار رؤية عائلي. الأهداف يجب أن تركز على الترابط والنمو والمرح الصيفي.",
            responseMimeType: "application/json",
          },
        });
        res.json(JSON.parse(cleanJson(response.text) || '{}'));
      } catch (aiErr: any) {
        console.error("AI Vision Board failure:", aiErr);
        const shuffled = [...localFallbacks.visionGoals].sort(() => 0.5 - Math.random());
        res.json({ goals: shuffled.slice(0, 3), isFallback: true });
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/ai/reward-advisor", async (req, res, next) => {
    try {
      const { points, currentPrizes } = req.body;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: `الطفل لديه ${points} نقطة. المكافآت المتاحة: ${currentPrizes}. اقترح مكافأة ذكية "خارج الصندوق" أو نصيحة للادخار. ارجع الإجابة بتنسيق JSON: { \"advice\": \"...\", \"suggestion\": \"...\" }`,
          config: {
            systemInstruction: "أنت خبير في التحفيز الإيجابي. قدم نصيحة مشجعة وذكية.",
            responseMimeType: "application/json",
          },
        });
        res.json(JSON.parse(cleanJson(response.text) || '{}'));
      } catch (aiErr: any) {
        console.error("AI Reward failure:", aiErr);
        const randomPrize = localFallbacks.prizes[Math.floor(Math.random() * localFallbacks.prizes.length)];
        res.json({ 
          advice: `رائع! لديك ${points} نقطة. استمر في جهودك المميزة!`, 
          suggestion: `جرب الحصول على: ${randomPrize} كمكافأة مستحقة.`,
          isFallback: true 
        });
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.use("/api", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', err);
    if (req.path.startsWith('/api')) {
      const isQuotaError = err.message?.toLowerCase().includes('quota') || 
                           err.message?.includes('429') || 
                           err.status === 429;
      
      res.status(isQuotaError ? 429 : 500).json({ 
        error: isQuotaError ? 'عذراً، وصلنا للحد الأقصى للطلبات اليوم. النظام يعمل الآن في "وضع الأمان" بمهام مقترحة.' : (err.message || 'Internal Server Error'), 
        isQuota: isQuotaError 
      });
    } else {
      next(err);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
