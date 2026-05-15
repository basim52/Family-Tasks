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

  // Filter out AI routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV, time: new Date().toISOString() });
  });

  app.use("/api/ai", (req, res) => {
    res.status(410).json({ error: "AI services have been disabled." });
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
