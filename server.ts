import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API routes FIRST
  app.post("/api/chat", async (req, res) => {
    try {
      const { baseUrl, apiKey, model, messages, systemInstruction, currentInput, currentImages, declarations } = req.body;
      
      // Map Gemini-style tools to OpenAI-compatible tools
      const openAiTools = declarations.map((decl: any) => {
        const formattedProperties: Record<string, any> = {};
        const originalProps = decl.parameters?.properties || {};
        
        Object.keys(originalProps).forEach(key => {
          const prop = originalProps[key];
          const pType = typeof prop.type === 'string' ? prop.type.toLowerCase() : 'string';
          formattedProperties[key] = {
            type: pType === 'object' ? 'object' : pType,
            description: prop.description || ''
          };
          if (prop.items) {
            const itemType = typeof prop.items.type === 'string' ? prop.items.type.toLowerCase() : 'string';
            formattedProperties[key].items = {
              type: itemType
            };
          }
        });

        return {
          type: "function",
          function: {
            name: decl.name,
            description: decl.description || '',
            parameters: {
              type: "object",
              properties: formattedProperties,
              required: decl.parameters?.required || []
            }
          }
        };
      });

      // Build messages
      const formattedMessages: any[] = [
        { role: "system", content: systemInstruction }
      ];

      // Add history
      messages.forEach((m: any) => {
        formattedMessages.push({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.text
        });
      });

      // Add current message with images if supported
      let content: any = currentInput || "Please process these slips.";
      if (currentImages && currentImages.length > 0) {
        const contentArray: any[] = [{ type: "text", text: currentInput || "Please process these slips." }];
        currentImages.forEach((img: string) => {
          contentArray.push({
            type: "image_url",
            image_url: {
              url: img
            }
          });
        });
        content = contentArray;
      }

      formattedMessages.push({
        role: "user",
        content: content
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };

      const isReasoner = model.toLowerCase().includes('reasoner') || model.toLowerCase().includes('-r1');

      const body: any = {
        model: model,
        messages: formattedMessages
      };

      if (openAiTools && openAiTools.length > 0 && !isReasoner) {
        body.tools = openAiTools;
        body.tool_choice = "auto";
      }

      const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

      const apiRes = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });

      if (!apiRes.ok) {
        const errorText = await apiRes.text();
        return res.status(apiRes.status).json({ error: `API Error (${apiRes.status}): ${errorText || apiRes.statusText}` });
      }

      const data = await apiRes.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      // Map response back to Gemini-like format
      const text = message?.content || "";
      let functionCalls: any[] | undefined = undefined;

      if (message?.tool_calls && message.tool_calls.length > 0) {
        functionCalls = message.tool_calls.map((tc: any) => ({
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments)
        }));
      }

      res.json({ text, functionCalls });
    } catch (err: any) {
      console.error("Error in /api/chat proxy:", err);
      res.status(500).json({ error: err.message });
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
