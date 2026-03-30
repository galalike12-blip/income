import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel, Type, FunctionDeclaration } from '@google/genai';
import { MessageCircle, X, Send, Bot, Loader2, Camera, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JobEntry, ExpenseEntry } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
}

interface ChatbotProps {
  jobs: JobEntry[];
  addExpense: (expense: Omit<ExpenseEntry, 'id'>) => void;
}

export function Chatbot({ jobs, addExpense }: ChatbotProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: input,
      image: selectedImage || undefined
    };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    const currentImage = selectedImage;
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      if (!process.env.GEMINI_API_KEY) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: "API Key is missing. Please check your environment variables." }]);
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const addExpenseTool: FunctionDeclaration = {
        name: "addExpense",
        description: "Add a new expense entry with amount, category, payee, and note.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "The expense amount" },
            category: { type: Type.STRING, description: "Category (e.g., food, fuel, rent, utilities, shopping, maintenance, other)" },
            payee: { type: Type.STRING, description: "The store or person paid" },
            note: { type: Type.STRING, description: "A brief description or note" },
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD format. Use today's date if not specified." }
          },
          required: ["amount", "category"]
        }
      };

      const context = `You are an AI assistant for an income and tip tracking app. 
      The user's current data:
      ${JSON.stringify(jobs, null, 2)}
      
      Note on fields:
      - customerMustPay: The fare amount before app discount.
      - customerActuallyPays: The fare amount after app discount.
      - upfrontCost: Extra expenses paid upfront by the driver (e.g., toll fees).
      - appNetIncome: The net income reported by the app.
      - actualReceived: The actual cash/transfer amount the customer paid.
      - Full Fare = customerMustPay + upfrontCost
      - Amount to Collect = customerActuallyPays + upfrontCost
      - Tip = actualReceived - Amount to Collect
      - Net Income = appNetIncome + Tip
      
      The user's preferred language code is '${currentLang}'. Please respond in this language.
      
      If the user uploads an image of a receipt or slip, extract the details and call the 'addExpense' tool.
      Always confirm with the user before adding if the details are not 100% clear.`;

      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const parts: any[] = [{ text: currentInput || "Please process this slip." }];
      if (currentImage) {
        parts.push({
          inlineData: {
            data: currentImage.split(',')[1],
            mimeType: "image/jpeg"
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...history, { role: 'user', parts }],
        config: {
          systemInstruction: context,
          tools: [{ functionDeclarations: [addExpenseTool] }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const aiMsgId = (Date.now() + 1).toString();
      
      // Handle function calls
      const functionCalls = response.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'addExpense') {
            const args = call.args as any;
            addExpense({
              amount: args.amount,
              category: args.category,
              payee: args.payee || '',
              note: args.note || '',
              date: args.date || new Date().toISOString().split('T')[0],
              isPaid: true
            });
            toast.success(t.synced || 'เพิ่มรายจ่ายสำเร็จ');
          }
        }
      }

      setMessages(prev => [...prev, { 
        id: aiMsgId, 
        role: 'model', 
        text: response.text || (functionCalls ? "I've added that expense for you." : "I'm not sure how to help with that.") 
      }]);

    } catch (error: any) {
      console.error(error);
      const isQuotaError = error?.message?.includes('429') || error?.status === 429;
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: isQuotaError ? "โควต้าการใช้งาน AI เต็มแล้ว กรุณาลองใหม่ในภายหลัง หรือตรวจสอบการตั้งค่า API Key" : t.errorAi,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 p-3 sm:p-4 glass-button rounded-full z-40 ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed inset-x-2 bottom-2 sm:inset-auto sm:bottom-6 sm:right-6 w-auto sm:w-full sm:max-w-sm h-[60vh] sm:h-[600px] glass-panel rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden z-50 transition-colors"
          >
            {/* Header */}
            <div className="bg-indigo-600/95 backdrop-blur-xl p-3 sm:p-5 flex justify-between items-center text-white border-b border-white/20">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <h3 className="font-semibold">{t.aiAssistant}</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-indigo-100 hover:text-white transition-colors bg-white/20 p-1.5 rounded-full hover:bg-white/30">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-transparent transition-colors">
              {messages.length === 0 && (
                <div className="text-center text-slate-500 dark:text-slate-400 mt-10">
                  <Bot className="w-12 h-12 mx-auto mb-3 text-slate-400 dark:text-slate-500 opacity-50" />
                  <p>{t.aiWelcome}</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3.5 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600/90 backdrop-blur-sm text-white rounded-tr-sm shadow-md shadow-indigo-500/20' : 'glass-panel-subtle text-slate-800 dark:text-slate-200 rounded-tl-sm'}`}>
                    {msg.image && (
                      <img src={msg.image} alt="Uploaded" className="w-full h-auto rounded-lg mb-2 border border-white/20" referrerPolicy="no-referrer" />
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="glass-panel-subtle p-3.5 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">{t.thinking}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 sm:p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-t border-white/40 dark:border-white/10 transition-colors">
              {selectedImage && (
                <div className="mb-3 relative inline-block">
                  <img src={selectedImage} alt="Preview" className="w-20 h-20 object-cover rounded-xl border-2 border-indigo-500" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 glass-button rounded-full text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={t.askAbout}
                  className="flex-1 px-4 py-3 glass-input rounded-full text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className="p-3 glass-button rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
