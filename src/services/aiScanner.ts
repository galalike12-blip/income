import { GoogleGenAI, Type } from "@google/genai";

export async function scanReceipt(file: File): Promise<{ amount: number | null, payee: string | null }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Cannot use AI scanner.");
      return { amount: null, payee: null };
    }

    const ai = new GoogleGenAI({ apiKey });

    // Convert file to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/...;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: file.type,
            },
          },
          {
            text: "Extract the total amount paid or transferred from this receipt/slip, and the name of the recipient/payee (ปลายทาง/ผู้รับโอน). Return a JSON object with 'amount' (number) and 'payee' (string). If you cannot find an amount, return 0. If you cannot find a payee, return an empty string.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            payee: { type: Type.STRING }
          },
          required: ["amount", "payee"]
        }
      }
    });

    const text = response.text?.trim() || "{}";
    try {
      const data = JSON.parse(text);
      return {
        amount: typeof data.amount === 'number' && !isNaN(data.amount) ? data.amount : null,
        payee: data.payee || null
      };
    } catch (e) {
      console.error("Failed to parse JSON from AI response", e);
      return { amount: null, payee: null };
    }
  } catch (error: any) {
    console.error("Error scanning receipt:", error);
    if (error?.message?.includes('429') || error?.status === 429) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}
