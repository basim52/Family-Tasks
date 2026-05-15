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

  app.post("/api/ai/chat", async (req, res, next) => {
    try {
      const { prompt, context } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `${context ? `Context: ${context}\n\n` : ''}${prompt}`,
        config: {
          systemInstruction: "أنت مساعد عائلي ذكي وخبير في التربية وإدارة شؤون المنزل. تساعد العائلات السعودية في تنظيم وقتهم، تحفيز أطفالهم، وتوفير نصائح عملية. تحدث دائماً باللغة العربية بأسلوب ودود ومهني.",
        },
      });
      res.json({ text: response.text });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/ai/generate-tasks", async (req, res, next) => {
    try {
      const { goal } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `حول هذا الهدف إلى 3-5 مهام عائلية محددة وقابلة للقياس: "${goal}"`,
        config: {
          systemInstruction: "أنت مساعد لإدارة المهام. حول الأهداف العامة إلى مهام صغيرة وواضحة. ارجع الإجابة بتنسيق JSON: { \"tasks\": [ { \"title\": \"...\", \"description\": \"...\", \"points\": 10 } ] }",
          responseMimeType: "application/json",
        },
      });
      res.json(JSON.parse(cleanJson(response.text) || '{}'));
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/ai/daily-challenge", async (req, res, next) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: "ولد تحدي عائلي صغير (Micro-challenge) لليوم. يجب أن يكون بسيطاً، ممتعاً، ويشجع على القيم العائلية. ارجع الإجابة بتنسيق JSON: { \"title\": \"...\", \"description\": \"...\", \"points\": 5 }",
        config: {
          systemInstruction: "أنت محفز عائلي. التحدي يجب أن يكون قابلاً للتنفيذ في أقل من 10 دقائق.",
          responseMimeType: "application/json",
        },
      });
      res.json(JSON.parse(cleanJson(response.text) || '{}'));
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/ai/vision-board", async (req, res, next) => {
    try {
      const { familySnapshot } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `بناءً على نشاط العائلة الأخير: "${familySnapshot}"، اقترح 3 أهداف رؤية ملهمة للصيف. ارجع الإجابة بتنسيق JSON: { \"goals\": [ { \"title\": \"...\", \"icon\": \"Emoji\" } ] }`,
        config: {
          systemInstruction: "أنت مستشار رؤية عائلي. الأهداف يجب أن تركز على الترابط والنمو والمرح الصيفي.",
          responseMimeType: "application/json",
        },
      });
      res.json(JSON.parse(cleanJson(response.text) || '{}'));
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/ai/reward-advisor", async (req, res, next) => {
    try {
      const { points, currentPrizes } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `الطفل لديه ${points} نقطة. المكافآت المتاحة: ${currentPrizes}. اقترح مكافأة ذكية "خارج الصندوق" أو نصيحة للادخار. ارجع الإجابة بتنسيق JSON: { \"advice\": \"...\", \"suggestion\": \"...\" }`,
        config: {
          systemInstruction: "أنت خبير في التحفيز الإيجابي. قدم نصيحة مشجعة وذكية.",
          responseMimeType: "application/json",
        },
      });
      res.json(JSON.parse(cleanJson(response.text) || '{}'));
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
