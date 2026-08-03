import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API routes FIRST
  app.post("/api/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "GEMINI_API_KEY environment variable is not configured." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const { model, history, currentInput, currentImages, systemInstruction, tools } = req.body;

      const selectedModel = model || "gemini-3.6-flash";

      const parts: any[] = [{ text: currentInput || "Please process these slips or request." }];
      if (currentImages && Array.isArray(currentImages)) {
        currentImages.forEach((img: string) => {
          const match = img.match(/^data:([^;]+);base64,/);
          const mimeType = match ? match[1] : "image/jpeg";
          const base64Data = img.includes(',') ? img.split(',')[1] : img;
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          });
        });
      }

      const contents = [...(history || []), { role: 'user', parts }];

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          systemInstruction: systemInstruction,
          tools: tools ? tools : undefined
        }
      });

      res.json({
        text: response.text || '',
        functionCalls: response.functionCalls || null
      });
    } catch (err: any) {
      console.error("Error in /api/chat:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
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
