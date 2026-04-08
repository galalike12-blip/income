import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel, Type, FunctionDeclaration } from '@google/genai';
import { MessageCircle, X, Send, Bot, Loader2, Camera, Image as ImageIcon, FileJson, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JobEntry, ExpenseEntry, UserPreferences } from '../types';
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
  expenses: ExpenseEntry[];
  incentives: Record<string, number>;
  addExpense: (expense: Omit<ExpenseEntry, 'id'>) => void;
  setIncentive: (date: string, amount: number) => void;
  addJob?: (job: Omit<JobEntry, 'id'>) => void;
  preferences: UserPreferences;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Chatbot = React.forwardRef<any, ChatbotProps>(({ jobs, expenses, incentives, addExpense, setIncentive, addJob, preferences, isOpen, setIsOpen }, ref) => {
  const { currentLang } = useSettings();
  const t = translations[currentLang];
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

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

  const handleJsonSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const json = JSON.parse(content);
        setInput(`Import this JSON data: ${JSON.stringify(json, null, 2)}`);
        toast.info('JSON loaded into message. Press send to import.');
      } catch (err) {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
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
      
      const customCategories = preferences.customCategories || ['food', 'fuel', 'rent', 'utilities', 'shopping', 'maintenance', 'other'];
      
      const addExpenseTool: FunctionDeclaration = {
        name: "addExpense",
        description: "Add a new expense entry with amount, category, payee, and note.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "The expense amount" },
            category: { type: Type.STRING, description: "Category. You MUST choose from this list: [" + customCategories.join(', ') + "]. If no category matches, you MUST use 'อื่นๆ'." },
            payee: { type: Type.STRING, description: "The store or person paid" },
            note: { type: Type.STRING, description: "A brief description or note" },
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD format. Use today's date if not specified." }
          },
          required: ["amount", "category"]
        }
      };

      const setIncentiveTool: FunctionDeclaration = {
        name: "setIncentive",
        description: "Set a daily incentive amount for a specific date.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD format." },
            amount: { type: Type.NUMBER, description: "The incentive amount" }
          },
          required: ["date", "amount"]
        }
      };

      const addJobTool: FunctionDeclaration = {
        name: "addJob",
        description: "Add a new job/income entry with fare details. For quick entry, only appNetIncome is needed.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            customerMustPay: { type: Type.NUMBER, description: "The fare amount before app discount. If not provided, will default to appNetIncome." },
            appNetIncome: { type: Type.NUMBER, description: "The net income reported by the app (ยอดสุทธิ)" },
            actualReceived: { type: Type.NUMBER, description: "The actual cash/transfer amount the customer paid. If not provided, defaults to appNetIncome." },
            upfrontCost: { type: Type.NUMBER, description: "Extra expenses paid upfront by the driver (e.g., toll fees)" },
            date: { type: Type.STRING, description: "Date and time in YYYY-MM-DDTHH:mm format. Use current date/time if not specified." }
          },
          required: ["appNetIncome"]
        }
      };

      const context = `You are an AI assistant for an income and tip tracking app. 
      Respond concisely and briefly.
      The user's current data:
      Jobs: ${JSON.stringify(jobs, null, 2)}
      Expenses: ${JSON.stringify(expenses, null, 2)}
      Daily Incentives: ${JSON.stringify(incentives, null, 2)}
      
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
      When extracting the category, you MUST ONLY use categories from this list: [${customCategories.join(', ')}].
      If the receipt's category is not in the list, you MUST use 'อื่นๆ'.
      If the user provides JSON data, process it by calling the appropriate tools (addExpense, addJob, setIncentive) for each entry in the JSON.
      If the user mentions adding a job or income, use the 'addJob' tool.
      If the user mentions a daily incentive, use the 'setIncentive' tool.
      Always confirm with the user before adding if the details are not 100% clear.`;

      const history = messages.slice(-10).map(m => ({
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
          tools: [{ functionDeclarations: [addExpenseTool, setIncentiveTool, addJobTool] }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
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
              date: args.date || (() => {
                const d = new Date();
                return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
              })(),
              isPaid: true
            });
            toast.success(t.synced || 'เพิ่มรายจ่ายสำเร็จ');
          } else if (call.name === 'setIncentive') {
            const args = call.args as any;
            setIncentive(args.date, args.amount);
            toast.success(t.synced || 'บันทึกอินเซนทีฟสำเร็จ');
          } else if (call.name === 'addJob' && addJob) {
            const args = call.args as any;
            const finalAppNet = args.appNetIncome;
            const finalCustomerPay = args.customerMustPay !== undefined ? args.customerMustPay : finalAppNet;
            
            addJob({
              customerMustPay: finalCustomerPay,
              appNetIncome: finalAppNet,
              actualReceived: args.actualReceived !== undefined ? args.actualReceived : finalAppNet,
              upfrontCost: args.upfrontCost || 0,
              date: args.date || (() => {
                const d = new Date();
                return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
              })()
            });
            toast.success(t.synced || 'เพิ่มรายรับสำเร็จ');
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

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Browser does not support speech recognition');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = currentLang === 'th' ? 'th-TH' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      toast.error('Speech recognition failed: ' + event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  React.useImperativeHandle(ref, () => ({
    toggleListening
  }));

  return (
    <>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for clicking outside */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/5 dark:bg-slate-900/20 backdrop-blur-[1px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed inset-x-2 bottom-28 sm:inset-auto sm:bottom-28 sm:right-6 w-auto sm:w-full sm:max-w-sm h-[60vh] sm:h-[600px] glass-panel rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden z-50 transition-colors pb-[-14px]"
            >
            {/* Header */}
            <div className="bg-indigo-600/95 backdrop-blur-xl p-3 sm:p-5 flex justify-between items-center text-white border-b border-white/20">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <h3 className="font-semibold">{t.aiAssistant}</h3>
              </div>
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
                <button
                  onClick={toggleListening}
                  className={`p-3 glass-button rounded-full transition-colors ${isListening ? 'text-rose-500 animate-pulse' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                  title="Voice Input"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={t.askAbout}
                  rows={1}
                  className="flex-1 px-4 py-3 glass-input rounded-2xl text-sm resize-none min-h-[44px] max-h-32 overflow-y-auto"
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
        </>
      )}
    </AnimatePresence>
    </>
  );
});
