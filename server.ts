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

      const selectedModel = model || "gemini-3.7-flash";

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

  app.post("/api/scan-receipt", async (req, res) => {
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

      const { imageBase64, mimeType = "image/jpeg", customCategories = [], payeeToCategoryMap = {} } = req.body;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: [
          {
            parts: [
              {
                text: `Extract receipt details: amount (number), payee (string), category, date (string, in 'YYYY-MM-DDTHH:mm' local timezone format, extracting both the date and the time from the slip if available), and transactionId (string, the transaction ID / 'เลขที่รายการ' / 'เลขที่อ้างอิง' / 'Ref No.' / 'Transaction No.' of the slip, extract this if it exists, otherwise return null). You MUST choose a category from this list: [${customCategories.join(', ')}]. If no category matches, you MUST use 'อื่นๆ'. Here is a history map of payees and their matching categories: ${JSON.stringify(payeeToCategoryMap)}. If the payee/recipient name detected matches or is highly similar to any in this history map, you MUST use its historical category. Return JSON only with fields: amount, payee, category, date, transactionId.`
              },
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || '{}');
      res.json(result);
    } catch (err: any) {
      console.error("Error in /api/scan-receipt:", err);
      res.status(500).json({ error: err.message || "Failed to scan receipt" });
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
