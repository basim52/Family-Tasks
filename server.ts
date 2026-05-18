import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();

async function startServer() {
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.use("/api", (req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV, time: new Date().toISOString() });
  });

  // Gemini AI Routes
  app.post("/api/ai", async (req, res) => {
    const maxRetries = 5;
    let attempt = 0;

    const executeAI = async () => {
      try {
        const { prompt, context, systemInstruction } = req.body;
        const key = process.env.GEMINI_API_KEY;

        if (!key || key === 'MY_GEMINI_API_KEY' || key.length < 10) {
          return res.status(400).json({ 
            error: "Gemini API key is not valid or not set. Please provide a valid key in the application settings (Settings > Secrets).",
            code: "API_KEY_MISSING"
          });
        }

        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            systemInstruction: systemInstruction || "أنت مساعد عائلي ذكي وخبير في التربية الإيجابية وتحفيز الأطفال. تحدث بلهجة عربية ودودة ومشجعة.",
          },
        });

        const text = response.text;
        res.json({ response: text });
      } catch (error: any) {
        const isTransient = error.message?.includes('503') || 
                            error.message?.toLowerCase().includes('high demand') || 
                            error.status === 503 || 
                            error.code === 'UNAVAILABLE' ||
                            error.code === 'DEADLINE_EXCEEDED' ||
                            error.code === 'INTERNAL' ||
                            error.message?.includes('fetch failed') ||
                            error.status === 429;
        
        if (isTransient && attempt < maxRetries) {
          attempt++;
          const isRateLimit = error.status === 429;
          console.log(`AI Transient Error (${error.status || error.code || '503'}), retrying attempt ${attempt}/${maxRetries}...`);
          
          // Longer backoff for rate limits
          const baseDelay = isRateLimit ? 3000 : 1000;
          const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 2000, 30000);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeAI();
        }

        console.error("AI Error:", error);
        const translatedError = isTransient 
          ? "عذراً، محرك الذكاء الاصطناعي مشغول حالياً بسبب ضغط الطلبات. يرجى المحاولة مرة أخرى بعد قليل."
          : (error.message || "حدث خطأ في محرك الذكاء الاصطناعي");
        
        const statusCode = (typeof error.status === 'number' && error.status >= 100 && error.status < 600) ? error.status : 500;
        res.status(statusCode).json({ error: translatedError, details: error.message });
      }
    };

    await executeAI();
  });

  app.post("/api/ai/chat", async (req, res) => {
    const maxRetries = 5;
    let attempt = 0;

    const executeChat = async () => {
      try {
        const { message, history } = req.body;
        const key = process.env.GEMINI_API_KEY;

        if (!key || key === 'MY_GEMINI_API_KEY' || key.length < 10) {
          return res.status(400).json({ 
            error: "Gemini API key is missing. AI Chat disabled.",
            code: "API_KEY_MISSING"
          });
        }

        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
        
        const chat = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: {
            systemInstruction: "أنت مساعد عائلي ذكي. تحدث بلهجة عربية ودودة.",
          },
          history: (history || []).slice(-10).map((h: any) => ({
            role: h.role,
            parts: [{ text: typeof h.parts[0] === 'string' ? h.parts[0] : h.parts[0].text }]
          })),
        });

        const result = await chat.sendMessage({ message });
        res.json({ response: result.text });
      } catch (error: any) {
        const isTransient = error.message?.includes('503') || 
                            error.message?.toLowerCase().includes('high demand') || 
                            error.status === 503 || 
                            error.code === 'UNAVAILABLE' ||
                            error.code === 'DEADLINE_EXCEEDED' ||
                            error.code === 'INTERNAL' ||
                            error.message?.includes('fetch failed') ||
                            error.status === 429;
        
        if (isTransient && attempt < maxRetries) {
          attempt++;
          const isRateLimit = error.status === 429;
          console.log(`AI Chat Transient Error (${error.status || error.code || '503'}), retrying attempt ${attempt}/${maxRetries}...`);
          
          const baseDelay = isRateLimit ? 3000 : 1000;
          const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 2000, 30000);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeChat();
        }

        console.error("AI Chat Error:", error);
        const translatedError = isTransient 
          ? "المساعد الذكي مشغول جداً حالياً، يرجى المحاولة لاحقاً."
          : (error.message || "حدث خطأ في الدردشة الذكية");
          
        const statusCode = (typeof error.status === 'number' && error.status >= 100 && error.status < 600) ? error.status : 500;
        res.status(statusCode).json({ error: translatedError, details: error.message });
      }
    };

    await executeChat();
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

  // Only listen if not in serverless environment
  if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
