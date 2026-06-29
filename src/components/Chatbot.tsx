import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel, Type, FunctionDeclaration } from '@google/genai';
import { MessageCircle, X, Send, Bot, Loader2, Camera, Image as ImageIcon, FileJson, Mic, MicOff, Settings2, Key, Cpu, Check } from 'lucide-react';
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
  images?: string[];
}

interface ChatbotProps {
  jobs: JobEntry[];
  expenses: ExpenseEntry[];
  incentives: Record<string, number>;
  untransferredIncentivesAmount?: number;
  addExpense: (expense: Omit<ExpenseEntry, 'id'>) => void;
  setIncentive: (date: string, amount: number) => void;
  addJob?: (job: Omit<JobEntry, 'id'>) => void;
  updateJob?: (job: JobEntry) => void;
  preferences: UserPreferences;
  updatePreferences?: (updates: Partial<UserPreferences>) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  sharedFile?: File | null;
  onClearSharedFile?: () => void;
}

export const Chatbot = React.forwardRef<any, ChatbotProps>(({ jobs, expenses, incentives, addExpense, setIncentive, addJob, updateJob, preferences, updatePreferences, isOpen, setIsOpen, sharedFile, onClearSharedFile, untransferredIncentivesAmount }, ref) => {
  const { currentLang } = useSettings();
  const t = translations[currentLang];
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (sharedFile && isOpen) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const imgUrl = event.target.result as string;
          // setSelectedImages(prev => [...prev, imgUrl]);
          handleSend('', [imgUrl]);
          if (onClearSharedFile) onClearSharedFile();
        }
      };
      reader.readAsDataURL(sharedFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedFile, isOpen, onClearSharedFile]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const loadedImages: string[] = [];
    let processed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          loadedImages.push(event.target.result as string);
        }
        processed++;
        if (processed === files.length) {
          handleSend(input, loadedImages);
        }
      };
      reader.readAsDataURL(file);
    }
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

  const handleSend = async (overrideInput?: string, overrideImages?: string[]) => {
    const finalInput = overrideInput !== undefined ? overrideInput : input;
    const finalImages = overrideImages !== undefined ? overrideImages : selectedImages;

    if ((!finalInput.trim() && finalImages.length === 0) || isLoading) return;

    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: finalInput,
      images: finalImages.length > 0 ? finalImages : undefined
    };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = finalInput;
    const currentImages = [...finalImages];
    setInput('');
    setSelectedImages([]);
    setIsLoading(true);

    try {
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
            date: { type: Type.STRING, description: "Date and time in 'YYYY-MM-DDTHH:mm' local timezone format. Extract both the date and time from the receipt if uploaded, use today's date if not specified." }
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

      const safeStringify = (obj: any): string => {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      return value;
    });
  };

  const updateJobTool: FunctionDeclaration = {
        name: "updateJob",
        description: "Edit/update an existing job entry. You MUST provide the id of the job. If the user mentions adding a tip, you should add it to actualReceived.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "The ID of the job to update from the 'Jobs Summary' list." },
            customerMustPay: { type: Type.NUMBER, description: "The updated fare amount before app discount." },
            appNetIncome: { type: Type.NUMBER, description: "The updated net income reported by the app (ยอดสุทธิ)." },
            actualReceived: { type: Type.NUMBER, description: "The updated actual cash/transfer amount the customer paid (this includes tips). Example: if former actualReceived was 50 and they got 20 tip, this should be 70." },
            upfrontCost: { type: Type.NUMBER, description: "Extra expenses paid upfront." },
            date: { type: Type.STRING, description: "Updated date/time" }
          },
          required: ["id"]
        }
      };

      const updatePreferencesTool: FunctionDeclaration = {
        name: "updatePreferences",
        description: "Update the user's dashboard or expenses widget layouts.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            dashboardWidgetOrder: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "The layout order of dashboard widgets. Allowed values: 'goals', 'summary', 'list'." 
            },
            expensesWidgetOrder: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "The layout order of expenses widgets. Allowed values: 'summary', 'fixed', 'variable'." 
            }
          }
        }
      };

      const addLeaveDaysTool: FunctionDeclaration = {
        name: "addLeaveDays",
        description: "Add one or more dates to the user's leave/holiday list with an optional reason.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            dates: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of dates in YYYY-MM-DD format to add."
            },
            reason: {
              type: Type.STRING,
              description: "Optional holiday/leave-of-absence reason (e.g. 'ลาป่วย', 'พักผ่อน', 'ไปเที่ยวต่างจังหวัด', 'ทำธุระ')."
            }
          },
          required: ["dates"]
        }
      };

      const removeLeaveDaysTool: FunctionDeclaration = {
        name: "removeLeaveDays",
        description: "Remove one or more dates from the user's leave/holiday list.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            dates: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of dates in YYYY-MM-DD format to remove."
            }
          },
          required: ["dates"]
        }
      };

      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const cutoffStr = sixtyDaysAgo.toISOString().split('T')[0];

      // Generate a distinct mapping of payee to their most frequent/recent category
      const payeeToCategoryMap: Record<string, string> = {};
      [...expenses]
        .sort((a, b) => a.date.localeCompare(b.date)) // older to newer, so newer overrides older
        .forEach(e => {
          if (e.payee && e.payee.trim() && e.category) {
            payeeToCategoryMap[e.payee.trim().toLowerCase()] = e.category;
          }
        });

      // Group jobs by day to assign daily sequence numbers
      const dailyJobCounts: Record<string, number> = {};
      const jobsWithIndex = [...jobs].sort((a,b) => a.date.localeCompare(b.date)).map(j => {
        const day = j.date.split('T')[0];
        dailyJobCounts[day] = (dailyJobCounts[day] || 0) + 1;
        return { ...j, dailyIndex: dailyJobCounts[day] };
      });

      const filteredJobs = jobsWithIndex
        .filter(j => j.date >= cutoffStr)
        .map(j => ({ id: j.id, date: j.date, dailyIndex: j.dailyIndex, appNetIncome: j.appNetIncome, actualReceived: j.actualReceived, customerMustPay: j.customerMustPay, upfrontCost: j.upfrontCost }))
        .slice(-100); // Limit to last 100 jobs in the period
        
      const filteredExpenses = expenses
        .filter(e => e.date >= cutoffStr)
        .map(e => ({ d: e.date, amt: e.amount, cat: e.category, payee: e.payee }))
        .slice(-100);

      const filteredIncentives = Object.fromEntries(
        Object.entries(incentives)
          .filter(([date]) => date >= cutoffStr)
          .slice(-60)
      );

      // Calculate financial statistics requested by the user
      const uniqueWorkedDates = new Set(jobs.map(j => j.date.split('T')[0]));
      const totalWorkDaysActual = uniqueWorkedDates.size;
      const totalLeaveDaysConfigured = preferences.leaveDays?.length || 0;

      const workType = preferences?.workType || 'rider';
      const riderMinDaily = preferences?.riderMinDailyTarget ?? 800;

      const activeFreelanceDates = new Set<string>();
      jobs.forEach(j => {
        if (j.workType === 'freelance' && j.isMultiDay && j.endDate) {
          const startStr = j.date.split('T')[0];
          const endStr = j.endDate;
          if (startStr <= endStr) {
            let currentDt = new Date(startStr);
            const endDt = new Date(endStr);
            let limit = 0;
            while (currentDt <= endDt && limit < 1000) {
              const yr = currentDt.getFullYear();
              const mo = String(currentDt.getMonth() + 1).padStart(2, '0');
              const dy = String(currentDt.getDate()).padStart(2, '0');
              activeFreelanceDates.add(`${yr}-${mo}-${dy}`);
              currentDt.setDate(currentDt.getDate() + 1);
              limit++;
            }
          }
        }
      });

      // 60 days time range calculations for workdays/offdays
      const last60DaysList: string[] = [];
      for (let i = 0; i < 60; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last60DaysList.push(d.toISOString().split('T')[0]);
      }
      
      let workDaysSummaryCount = 0;
      let offDaysSummaryCount = 0;
      
      last60DaysList.forEach(dayStr => {
        const dayJobs = jobs.filter(j => j.date.startsWith(dayStr));
        const dayIncentive = incentives[dayStr] || 0;
        
        let appNet = dayJobs.reduce((sum, j) => sum + j.appNetIncome, 0);
        let totalTipVal = 0;
        let totalLossVal = 0;
        
        dayJobs.forEach(j => {
          const diff = j.actualReceived - (j.customerMustPay + j.upfrontCost);
          if (diff > 0) totalTipVal += diff;
          if (diff < 0) totalLossVal += Math.abs(diff);
        });
        
        const dailyIncomeSum = Math.max(0, (appNet - totalLossVal) + totalTipVal + dayIncentive);
        const isLeave = preferences.leaveDays?.includes(dayStr);

        if (workType === 'salary') {
          const dateObj = new Date(dayStr);
          const dayOfWeek = dateObj.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          if (isLeave) {
            // is leave
          } else if (isWeekend) {
            if (dailyIncomeSum > 0) {
              workDaysSummaryCount++;
            } else {
              offDaysSummaryCount++;
            }
          } else {
            workDaysSummaryCount++;
          }
        } else if (workType === 'freelance') {
          if (dailyIncomeSum > 0 || activeFreelanceDates.has(dayStr)) {
            workDaysSummaryCount++;
          } else {
            if (isLeave) {
              // is leave
            } else {
              offDaysSummaryCount++;
            }
          }
        } else {
          // rider
          if (isLeave) {
            if (dailyIncomeSum > riderMinDaily) {
              workDaysSummaryCount++;
            }
          } else {
            if (dailyIncomeSum > riderMinDaily) {
              workDaysSummaryCount++;
            } else {
              offDaysSummaryCount++;
            }
          }
        }
      });

      const untransferredJobsIncome = jobs
        .filter(j => !j.transferred)
        .reduce((sum, j) => {
          const amountToCollect = j.customerMustPay + j.upfrontCost;
          const diff = (j.actualReceived ?? amountToCollect) - amountToCollect;
          return sum + j.appNetIncome + diff;
        }, 0);

      const untransferredIncentives = untransferredIncentivesAmount !== undefined ? untransferredIncentivesAmount : 0;
      const totalUntransferred = untransferredJobsIncome + untransferredIncentives;

      const totalJobsIncomeAllTime = jobs.reduce((sum, j) => sum + (j.appNetIncome || 0), 0);
      let totalTipsAllTime = 0;
      jobs.forEach(j => {
        const amountToCollect = j.customerMustPay + j.upfrontCost;
        const diff = (j.actualReceived ?? amountToCollect) - amountToCollect;
        if (diff > 0) totalTipsAllTime += diff;
      });
      const totalIncentivesAllTime = Object.values(incentives).reduce((sum, amt) => sum + amt, 0);

      const jobsSummary = {
        total: jobs.length,
        totalInc: totalJobsIncomeAllTime,
        list: filteredJobs
      };
      
      const expensesSummary = {
        total: expenses.length,
        totalAmt: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
        list: filteredExpenses
      };

      const context = `You are an AI assistant for an income and tip tracking app. 
      Respond concisely and briefly.

      Today's date is: ${new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]} (In YYYY-MM-DD local format)
      
      CRITICAL: When performing calculations or stating balances/workdays/off-days/incentives, you MUST use the provided numbers below exactly. Do not hallucinate or estimate numbers.
      Always double-check your math before responding.
      
      The user's direct live financial stats & metrics (Sourced directly from live database):
      - เงินคงเหลือในบัญชีรายจ่าย (Expense Balance / wallet): ฿${(preferences.expenseBalance || 0).toLocaleString()}
      - เงินสะสมรวมที่ยังไม่ได้โอนทั้งหมด (ยอดสะสม / Total Untransferred): ฿${totalUntransferred.toLocaleString()} (ประกอบด้วยรายได้จากงานค้างโอน ฿${untransferredJobsIncome.toLocaleString()} และอินเซนทีฟค้างโอน ฿${untransferredIncentives.toLocaleString()})
      - รายได้สะสมจากงานทั้งหมดที่วิ่ง: ฿${totalJobsIncomeAllTime.toLocaleString()}
      - ยอดทิปรวมสะสมทั้งหมด: ฿${totalTipsAllTime.toLocaleString()}
      - เงินอินเซนทีฟสะสมทั้งหมด: ฿${totalIncentivesAllTime.toLocaleString()}
      - จำนวนวันทำงานที่มีวิ่งงานจริง (Work Days with real jobs): ${totalWorkDaysActual} วัน
      - วันหยุด/วันลาที่กำหนดไว้โดยผู้ใช้: ${totalLeaveDaysConfigured} วัน (รายชื่อวันลา: ${JSON.stringify(preferences.leaveDays || [])})
      - เกณฑ์รอบ 60 วันล่าสุด (ประเภทงาน: ${workType}, เกณฑ์เป้าหมายไรเดอร์: ฿${riderMinDaily}): ${
        workType === 'salary' 
          ? `วันทำงานจริง (วันธรรมดาและวันหยุดที่วิ่งงานนอกเสริม) = ${workDaysSummaryCount} วัน, วันหยุดสัปดาห์ที่ไม่มีรายรับ = ${offDaysSummaryCount} วัน` 
          : workType === 'freelance' 
          ? `วันที่รับรายได้จริง = ${workDaysSummaryCount} วัน, วันว่างงาน/ไม่มีรายจับ = ${offDaysSummaryCount} วัน` 
          : `วันสู้ชีวิตทำงานจริง (รายได้รวม > ฿${riderMinDaily}) = ${workDaysSummaryCount} วัน, วันหยุดงาน/วันสโลว์ไลฟ์ (รายได้ <= ฿${riderMinDaily}) = ${offDaysSummaryCount} วัน`
      }

      The user's current data summary (Last 60 days):
      Jobs Summary (Note: 'dailyIndex' represents the sequence number of the job for that specific day. If the user says "งานที่ 4" (job 4), find the job with dailyIndex 4 for today. If they say "งานที่แล้ว" or "the last job", find the job with the highest dailyIndex for today. Use the job 'id' to call updateJobTool): ${safeStringify(jobsSummary)}
      Expenses Summary: ${safeStringify(expensesSummary)}
      Daily Incentives: ${safeStringify(filteredIncentives)}
      
      Payee Category History Map (payee -> historically preferred category):
      ${safeStringify(payeeToCategoryMap)}
      
      CRITICAL FOR CATEGORIZATION:
      When scanning slips or adding an expense, extract the name of the payee (store/seller/merchant/recipient/person paid).
      Compare the extracted payee name (case-insensitive, ignoring spacing, punctuation, and slight spelling variants in Thai/English) against the Payee Category History Map.
      If there is a match or high similarity to a historical payee (e.g., "7-Eleven" matches "7-eleven", "นาย ก" matches "นาย ก."), you MUST USE that exact historical category as the category argument.
      If it is a new payee not in the map, categorize it logically choosing ONLY from this list: [${customCategories.join(', ')}]. If no category matches and it's not in the map, you MUST use 'อื่นๆ'.
      
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
      
      If the user uploads an image of a receipt or slip, extract the details such as payee name and call the 'addExpense' tool.
      When extracting the category, always check the Payee Category History Map first. If a match is found, use it. If not, use the custom lists or default 'อื่นๆ'.
      If the user provides JSON data, process it by calling the appropriate tools (addExpense, addJob, setIncentive) for each entry in the JSON.
      If the user mentions adding a job or income, use the 'addJob' tool.
      If the user mentions a daily incentive, use the 'setIncentive' tool.
      If the user wants to add or set leave/holiday days (e.g., "ลาพักร้อนพรุ่งนี้กระทันหัน", "วันที่ 12 มีนาคม จะลาเพราะติดธุระ", "เพิ่มวันลาวันที่ 2026-06-25"), use the 'addLeaveDays' tool with the list of dates and the optional reason string.
      If the user wants to remove or cancel leave/holiday days (e.g., "ลบวันลาเมื่อวานด้วย", "ขอยกเลิกวันลาวันที่ 12"), use the 'removeLeaveDays' tool with the list of dates.
      Always confirm with the user before adding if the details are not 100% clear.`;

      const history = messages.slice(-10).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      let aiResultText = '';
      let functionCalls: any[] | undefined = undefined;

      if (!process.env.GEMINI_API_KEY) {
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: 'model', 
          text: "❌ **ไม่พบ API Key สำหรับใช้ระบบ AI Chatbot (Gemini)**\n\nกรุณาตั้งค่าเซ็ตตัวแปร Environment Variable ชื่อ `GEMINI_API_KEY` ในหน้าตั้งค่าของ Vercel (Vercel Settings -> Environment Variables) หรือในไฟล์ `.env` สำหรับเครื่อง Local จากนั้นทำการ Redeploy หรือรันใหม่อีกครั้งครับ!" 
        }]);
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const parts: any[] = [{ text: currentInput || "Please process these slips." }];
      if (currentImages && currentImages.length > 0) {
        currentImages.forEach(img => {
          const match = img.match(/^data:([^;]+);base64,/);
          const mimeType = match ? match[1] : "image/jpeg";
          parts.push({
            inlineData: {
              data: img.split(',')[1],
              mimeType: mimeType
            }
          });
        });
      }

      const response = await ai.models.generateContent({
        model: preferences.geminiModel || 'gemini-3.5-flash',
        contents: [...history, { role: 'user', parts }],
        config: {
          systemInstruction: context,
          tools: [{ functionDeclarations: [addExpenseTool, setIncentiveTool, addJobTool, updateJobTool, updatePreferencesTool, addLeaveDaysTool, removeLeaveDaysTool] }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });

      aiResultText = response.text || '';
      functionCalls = response.functionCalls;

      const aiMsgId = (Date.now() + 1).toString();
      
      // Handle function calls
      let duplicateAlertMessage = '';
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'addExpense') {
            const args = call.args as any;
            
            let finalCategory = args.category;
            const argPayee = (args.payee || '').trim().toLowerCase();
            if (argPayee) {
              // Strict match
              if (payeeToCategoryMap[argPayee]) {
                finalCategory = payeeToCategoryMap[argPayee];
              } else {
                // Fuzzy/substring match: find if any key in map is a substring or vice versa
                const matchedKey = Object.keys(payeeToCategoryMap).find(key => 
                  argPayee.includes(key) || key.includes(argPayee)
                );
                if (matchedKey) {
                  finalCategory = payeeToCategoryMap[matchedKey];
                }
              }
            }

            const targetDate = args.date || (() => {
              const d = new Date();
              return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            })();

            // Programmatic check for duplicate expense entries
            const isDuplicate = expenses.some(e => {
              const sameAmount = Math.abs(e.amount - args.amount) < 0.01;
              const p1 = (e.payee || '').trim().toLowerCase();
              const p2 = (args.payee || '').trim().toLowerCase();
              const samePayee = p1 === p2 || (p1 && p2 && (p1.includes(p2) || p2.includes(p1)));
              const sameDay = e.date.substring(0, 10) === targetDate.substring(0, 10);
              return sameAmount && samePayee && sameDay;
            });

            if (isDuplicate) {
              const payeeLabel = args.payee || 'ร้านค้า/ผู้รับเงิน';
              toast.warning(`ตรวจพบสลิปซ้ำ: ${payeeLabel} ฿${args.amount}`);
              duplicateAlertMessage = `⚠️ **ตรวจพบรายการนี้ในระบบแล้ว!**\nรายการค่าใช้จ่ายจำนวน **฿${args.amount}** จ่ายให้กับ **${payeeLabel}** ในวันที่ **${targetDate.substring(0, 10)}** ได้ตอบรับการเพิ่มในระบบมาก่อนหน้าแล้ว ระบบจึงแจ้งเตือนและระงับการบันทึกรายการซ้ำเพื่อความถูกต้องของสมุดบัญชีครับ`;
              continue;
            }

            const res = await addExpense({
              amount: args.amount,
              category: finalCategory,
              payee: args.payee || '',
              note: args.note || '',
              date: targetDate,
              isPaid: true
            });
            const bal = (res as any)?.balanceAfter;
            if (bal !== undefined) {
              toast.success(`${t.synced || 'เพิ่มรายจ่ายสำเร็จ'} (ยอดคงเหลือ ฿${bal.toLocaleString()})`);
            } else {
              toast.success(t.synced || 'เพิ่มรายจ่ายสำเร็จ');
            }
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
          } else if (call.name === 'updateJob' && updateJob) {
            const args = call.args as any;
            const jobToUpdate = jobs.find(j => j.id === args.id);
            if (jobToUpdate) {
              updateJob({
                ...jobToUpdate,
                customerMustPay: args.customerMustPay !== undefined ? args.customerMustPay : jobToUpdate.customerMustPay,
                appNetIncome: args.appNetIncome !== undefined ? args.appNetIncome : jobToUpdate.appNetIncome,
                actualReceived: args.actualReceived !== undefined ? args.actualReceived : jobToUpdate.actualReceived,
                upfrontCost: args.upfrontCost !== undefined ? args.upfrontCost : jobToUpdate.upfrontCost,
                date: args.date || jobToUpdate.date
              });
              toast.success('อัปเดตงานสำเร็จ');
            }
          } else if (call.name === 'updatePreferences' && updatePreferences) {
            const args = call.args as any;
            const updates: Partial<UserPreferences> = {};
            if (args.dashboardWidgetOrder) updates.dashboardWidgetOrder = args.dashboardWidgetOrder;
            if (args.expensesWidgetOrder) updates.expensesWidgetOrder = args.expensesWidgetOrder;
            if (Object.keys(updates).length > 0) {
              updatePreferences(updates);
              toast.success('อัปเดตวิดเจ็ตสำเร็จ');
            }
          } else if (call.name === 'addLeaveDays' && updatePreferences) {
            const args = call.args as any;
            const datesToAdd = args.dates as string[];
            const reason = args.reason || '';

            const currentLeaveDays = preferences.leaveDays || [];
            const currentLeaveReasons = preferences.leaveReasons || {};

            const newLeaveDays = [...new Set([...currentLeaveDays, ...datesToAdd])];
            const newLeaveReasons = { ...currentLeaveReasons };

            if (reason) {
              datesToAdd.forEach(d => {
                newLeaveReasons[d] = reason;
              });
            }

            updatePreferences({
              leaveDays: newLeaveDays,
              leaveReasons: newLeaveReasons
            });
            toast.success('บันทึกวันลาสำเร็จ');
          } else if (call.name === 'removeLeaveDays' && updatePreferences) {
            const args = call.args as any;
            const datesToRemove = args.dates as string[];

            const currentLeaveDays = preferences.leaveDays || [];
            const currentLeaveReasons = preferences.leaveReasons || {};

            const newLeaveDays = currentLeaveDays.filter(d => !datesToRemove.includes(d));
            const newLeaveReasons = { ...currentLeaveReasons };
            datesToRemove.forEach(d => {
              delete newLeaveReasons[d];
            });

            updatePreferences({
              leaveDays: newLeaveDays,
              leaveReasons: newLeaveReasons
            });
            toast.success('ลบวันลาสำเร็จ');
          }
        }
      }

      let finalAiText = aiResultText || (functionCalls ? "รายละเอียดได้รับการบันทึกเรียบร้อยแล้วครับ" : "ฉันยังไม่เข้าใจสิ่งที่คุณพยายามถามอย่างแน่ชัด ลองถามข้อมูลวันทำงาน เงินสะสม หรืออัปโหลดสลิปได้เลยครับ");
      if (duplicateAlertMessage) {
        finalAiText = aiResultText ? `${aiResultText}\n\n${duplicateAlertMessage}` : duplicateAlertMessage;
      }

      setMessages(prev => [...prev, { 
        id: aiMsgId, 
        role: 'model', 
        text: finalAiText 
      }]);

    } catch (error: any) {
      console.error(error);
      const isQuotaError = error?.message?.includes('429') || error?.status === 429;
      const isBalanceError = error?.message?.includes('402');
      const errorDetail = error?.message || String(error);
      
      let errorText = `${t.errorAi || "AI เกิดข้อผิดพลาด"}\n\n⚠️ **รายละเอียด:** ${errorDetail}`;
      if (isQuotaError) {
        errorText = "โควต้าการใช้งาน AI เต็มแล้ว กรุณาลองใหม่ในภายหลัง หรือตรวจสอบการตั้งค่า API Key";
      } else if (isBalanceError) {
        errorText = "ยอดเงินในบัญชี API ไม่เพียงพอ (Insufficient Balance) กรุณาเติมเงินเข้าระบบที่ผู้ให้บริการ (เช่น DeepSeek) หรือเปลี่ยนกลับไปใช้ Gemini แบบฟรีในตั้งค่าครับ";
      }

      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: errorText,
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
              <div className="flex items-center gap-2">
                <select
                  value={preferences?.geminiModel || 'gemini-3.5-flash'}
                  onChange={(e) => updatePreferences?.({ geminiModel: e.target.value })}
                  className="bg-indigo-500/50 hover:bg-indigo-500/70 text-white text-xs font-medium px-2 py-1.5 rounded-lg outline-none cursor-pointer transition-colors max-w-[120px] sm:max-w-[140px] truncate border border-white/10"
                >
                  <option value="gemini-3.5-flash" className="text-slate-900">3.5 Flash</option>
                  <option value="gemini-2.5-flash" className="text-slate-900">2.5 Flash</option>
                  <option value="gemini-2.5-pro" className="text-slate-900">2.5 Pro</option>
                  <option value="gemini-3.1-pro-preview" className="text-slate-900">3.1 Pro</option>
                </select>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
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
                        {msg.images && msg.images.length > 0 && (
                          <div className={`grid gap-2 mb-2 ${msg.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {msg.images.map((img, idx) => (
                              <img key={idx} src={img} alt={`Uploaded ${idx + 1}`} className="w-full h-auto object-cover max-h-48 rounded-lg border border-white/20" referrerPolicy="no-referrer" />
                            ))}
                          </div>
                        )}
                        {msg.image && !msg.images && (
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
                  {selectedImages.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2 max-h-24 overflow-y-auto py-1">
                      {selectedImages.map((img, idx) => (
                        <div key={idx} className="relative inline-block shrink-0">
                          <img src={img} alt={`Preview ${idx}`} className="w-12 h-12 object-cover rounded-xl border border-indigo-500" referrerPolicy="no-referrer" />
                          <button 
                            onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-650 text-white p-0.5 rounded-full shadow-lg cursor-pointer animate-fade-in"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 glass-button rounded-full text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                    <button
                      onClick={toggleListening}
                      className={`p-3 glass-button rounded-full transition-colors cursor-pointer ${isListening ? 'text-rose-500 animate-pulse' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                      title="Voice Input"
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <textarea
                      ref={inputRef}
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
                      disabled={(!input.trim() && selectedImages.length === 0) || isLoading}
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
