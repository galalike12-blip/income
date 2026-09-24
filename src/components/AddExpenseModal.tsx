import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Plus, DollarSign, Calendar, Camera, Loader2, Tag, User, FileText, ChevronDown, UtensilsCrossed, Fuel, Zap, Car, ShoppingBag, Wrench, HelpCircle, Home, Sparkles, Globe, Edit2, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ExpenseEntry } from '../types';
import { translations } from '../i18n/translations';
import { useSettings } from '../contexts/SettingsContext';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { safeStringify } from '../utils/safeStringify';
import { toast } from 'sonner';
import { getSmartFaviconUrl, resolveBrandDomain, BRAND_PRESETS } from '../utils/brandIcons';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (expense: Omit<ExpenseEntry, 'id'>) => void;
  onEdit?: (id: string, updates: Partial<ExpenseEntry>, scope?: 'single' | 'onwards' | 'all') => void;
  customCategories: string[];
  setCustomCategories: (categories: string[]) => void;
  editingExpense?: ExpenseEntry | null;
  sharedFile?: File | null;
  expenses?: ExpenseEntry[];
}

export function AddExpenseModal({ isOpen, onClose, onAdd, onEdit, customCategories, setCustomCategories, editingExpense, sharedFile, expenses = [] }: AddExpenseModalProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const uniqueUrls = Array.from(new Set(expenses.map(e => e.websiteUrl).filter(Boolean))) as string[];

  const [expenseDate, setExpenseDate] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expensePayee, setExpensePayee] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [necessity, setNecessity] = useState<'necessary' | 'luxury'>('necessary');
  const [isFixed, setIsFixed] = useState(false);
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [isIndefinite, setIsIndefinite] = useState(true);
  const [durationMonths, setDurationMonths] = useState('12');
  const [isPaid, setIsPaid] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [updateScope, setUpdateScope] = useState<'single' | 'onwards' | 'all'>('onwards');
  const [transactionId, setTransactionId] = useState('');

  const relatedExpenses = useMemo(() => {
    if (!editingExpense) return [];
    return expenses.filter(e => {
      if (e.id === editingExpense.id) return false;
      if (editingExpense.groupId && e.groupId && e.groupId === editingExpense.groupId) {
        return true;
      }
      if (editingExpense.isFixed && e.isFixed) {
        const targetPayee = editingExpense.payee?.trim().toLowerCase();
        if (targetPayee && e.payee?.trim()) {
          return e.payee.trim().toLowerCase() === targetPayee;
        }
        if (!targetPayee && !e.payee?.trim()) {
          return e.category === editingExpense.category && (e.note || '') === (editingExpense.note || '');
        }
      }
      return false;
    });
  }, [editingExpense, expenses]);

  const futureRelatedExpenses = useMemo(() => {
    if (!editingExpense) return [];
    return relatedExpenses.filter(e => e.date >= editingExpense.date);
  }, [relatedExpenses, editingExpense]);
  
  const getCategoryName = (category: string) => {
    switch (category) {
      case 'food': return t.food || 'ค่าอาหาร/เครื่องดื่ม';
      case 'fuel': return t.fuel || 'ค่าน้ำมัน/เดินทาง';
      case 'rent': return t.rent || 'ค่าเช่า/ที่พัก';
      case 'utilities': return t.utilities || 'ค่าน้ำ/ค่าไฟ/เน็ต';
      case 'shopping': return t.shopping || 'ช็อปปิ้ง/ของใช้ส่วนตัว';
      case 'maintenance': return t.maintenance || 'ค่าซ่อมบำรุง';
      case 'other': return t.other || 'อื่นๆ';
      default: return category;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    
    // Predefined categories
    if (cat === 'food') return <UtensilsCrossed className="w-4 h-4" />;
    if (cat === 'fuel') return <Fuel className="w-4 h-4" />;
    if (cat === 'rent') return <Home className="w-4 h-4" />;
    if (cat === 'utilities') return <Zap className="w-4 h-4" />;
    if (cat === 'shopping') return <ShoppingBag className="w-4 h-4" />;
    if (cat === 'maintenance') return <Wrench className="w-4 h-4" />;
    if (cat === 'other') return <HelpCircle className="w-4 h-4" />;

    // Keyword matching for custom categories
    if (cat.includes('อาหาร') || cat.includes('กิน') || cat.includes('food') || cat.includes('eat') || cat.includes('ข้าว')) 
      return <UtensilsCrossed className="w-4 h-4" />;
    if (cat.includes('น้ำมัน') || cat.includes('fuel') || cat.includes('gas') || cat.includes('เชื้อเพลิง')) 
      return <Fuel className="w-4 h-4" />;
    if (cat.includes('ไฟ') || cat.includes('น้ำ') || cat.includes('utilities') || cat.includes('electric') || cat.includes('water')) 
      return <Zap className="w-4 h-4" />;
    if (cat.includes('รถ') || cat.includes('เดินทาง') || cat.includes('car') || cat.includes('travel') || cat.includes('ขนส่ง')) 
      return <Car className="w-4 h-4" />;
    if (cat.includes('ซื้อ') || cat.includes('ของ') || cat.includes('shopping') || cat.includes('buy') || cat.includes('ห้าง')) 
      return <ShoppingBag className="w-4 h-4" />;
    if (cat.includes('บ้าน') || cat.includes('เช่า') || cat.includes('rent') || cat.includes('home') || cat.includes('ที่พัก')) 
      return <Home className="w-4 h-4" />;
    if (cat.includes('ซ่อม') || cat.includes('maintenance') || cat.includes('repair') || cat.includes('บำรุง')) 
      return <Wrench className="w-4 h-4" />;
    
    return <HelpCircle className="w-4 h-4" />;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (editingExpense) {
        setExpenseDate(editingExpense.date || '');
        setExpenseCategory(editingExpense.category || '');
        setExpensePayee(editingExpense.payee || '');
        setExpenseAmount((editingExpense.amount ?? 0).toString());
        setExpenseNote(editingExpense.note || '');
        setWebsiteUrl(editingExpense.websiteUrl || '');
        setNecessity(editingExpense.necessity || 'necessary');
        setIsFixed(editingExpense.isFixed || false);
        setFrequency(editingExpense.frequency || 'monthly');
        setIsIndefinite(editingExpense.isIndefinite ?? true);
        setDurationMonths(editingExpense.durationMonths?.toString() || '12');
        setIsPaid(editingExpense.isPaid ?? true);
        setTransactionId(editingExpense.transactionId || '');

        const hasFuture = expenses.some(e => 
          e.id !== editingExpense.id &&
          ((editingExpense.groupId && e.groupId === editingExpense.groupId) || 
           (editingExpense.isFixed && e.isFixed && (
             (editingExpense.payee?.trim() && e.payee?.trim().toLowerCase() === editingExpense.payee.trim().toLowerCase()) ||
             (!editingExpense.payee?.trim() && e.category === editingExpense.category && (e.note || '') === (editingExpense.note || ''))
           ))) &&
          e.date >= editingExpense.date
        );
        setUpdateScope(hasFuture ? 'onwards' : 'all');
      } else {
        const now = new Date();
        setExpenseDate(new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
        setExpenseCategory('');
        setExpensePayee('');
        setExpenseAmount('');
        setExpenseNote('');
        setWebsiteUrl('');
        setNecessity('necessary');
        setIsFixed(false);
        setFrequency('monthly');
        setIsIndefinite(true);
        setDurationMonths('12');
        setIsPaid(true);
        setUpdateScope('onwards');
        setTransactionId('');
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, editingExpense, expenses]);

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      img.onerror = () => reject(new Error('Failed to load image'));
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');
        
        ctx.drawImage(img, 0, 0, width, height);
        // Using jpeg and quality 0.8 to reduce size while retaining text readability
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      
      reader.readAsDataURL(file);
    });
  };

  const scanFile = async (file: File) => {
    setIsScanning(true);
    try {
      const compressedDataUrl = await compressImage(file);
      const base64Data = compressedDataUrl.split(',')[1];
      
      // Generate a distinct mapping of payee to their most frequent/recent category
      const payeeToCategoryMap: Record<string, string> = {};
      [...expenses]
        .sort((a, b) => a.date.localeCompare(b.date)) // older to newer, so newer overrides older
        .forEach(e => {
          if (e.payee && e.payee.trim() && e.category) {
            payeeToCategoryMap[e.payee.trim().toLowerCase()] = e.category;
          }
        });

      let result: any = null;

      try {
        const res = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: safeStringify({
            imageBase64: base64Data,
            mimeType: 'image/jpeg',
            customCategories,
            payeeToCategoryMap
          })
        });
        if (res.ok) {
          result = await res.json();
        }
      } catch (err) {
        console.warn('Failed to call /api/scan-receipt, checking client fallback:', err);
      }

      if (!result && process.env.GEMINI_API_KEY) {
        const apiKey = process.env.GEMINI_API_KEY;
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: [
            {
              parts: [
                { text: "Extract receipt details: amount (number), payee (string), category, and date (string, in 'YYYY-MM-DDTHH:mm' local timezone format, extracting both the date and the time from the slip if available). You MUST choose a category from this list: [" + customCategories.join(', ') + "]. If no category matches, you MUST use 'อื่นๆ'. Here is a history map of payees and their matching categories: " + safeStringify(payeeToCategoryMap) + ". If the payee/recipient name detected matches or is highly similar to any in this history map, you MUST use its historical category. Return JSON only with fields: amount, payee, category, date." },
                { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
              ]
            }
          ],
          config: { 
            responseMimeType: "application/json"
          }
        });
        result = JSON.parse(response.text || '{}');
      }

      if (!result) {
        throw new Error("ไม่สามารถตรวจจับสลิปได้ กรุณาตรวจสอบการตั้งค่า GEMINI_API_KEY หรือลองใหม่อีกครั้ง");
      }
      if (result.amount) setExpenseAmount(result.amount.toString());
      
      let finalPayee = result.payee || '';
      let finalCategory = result.category || '';

      if (finalPayee.trim()) {
        const normPayee = finalPayee.trim().toLowerCase();
        // Check strict match first
        if (payeeToCategoryMap[normPayee]) {
          finalCategory = payeeToCategoryMap[normPayee];
        } else {
          // Check fuzzy/substring match
          const matchedKey = Object.keys(payeeToCategoryMap).find(key => 
            normPayee.includes(key) || key.includes(normPayee)
          );
          if (matchedKey) {
            finalCategory = payeeToCategoryMap[matchedKey];
          }
        }
      }

      if (finalPayee) {
        setExpensePayee(finalPayee);
        const autoDomain = resolveBrandDomain(finalPayee);
        if (autoDomain && !websiteUrl) {
          setWebsiteUrl(autoDomain);
        }
      }
      if (finalCategory) setExpenseCategory(finalCategory);
      if (result.date) {
        setExpenseDate(result.date);
      }
      if (result.transactionId) {
        setTransactionId(result.transactionId);
      }
    } catch (error: any) {
      console.error("Scan failed:", error);
      toast.error(error?.message || "สแกนสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await scanFile(file);
  };

  useEffect(() => {
    if (isOpen && sharedFile) {
      scanFile(sharedFile);
    }
  }, [isOpen, sharedFile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalWebsiteUrl = websiteUrl.trim() 
      ? (resolveBrandDomain(websiteUrl) || websiteUrl.trim())
      : (resolveBrandDomain(expensePayee) || '');

    const amountVal = parseFloat(expenseAmount) || 0;

    // Check for duplicates
    const isDuplicate = !editingExpense && expenses.some(e => {
      // 1. If transactionId matches and is not empty
      if (transactionId && e.transactionId && transactionId.trim() && e.transactionId.trim()) {
        return transactionId.trim() === e.transactionId.trim();
      }
      // 2. If transactionId is different, and BOTH have transactionIds, it is definitely NOT a duplicate!
      if (transactionId && e.transactionId && transactionId.trim() && e.transactionId.trim() && transactionId.trim() !== e.transactionId.trim()) {
        return false;
      }
      // 3. Otherwise fall back to amount, payee, and date comparison
      const sameAmount = Math.abs(e.amount - amountVal) < 0.01;
      const p1 = (e.payee || '').trim().toLowerCase();
      const p2 = (expensePayee || '').trim().toLowerCase();
      const samePayee = p1 === p2 || (p1 && p2 && (p1.includes(p2) || p2.includes(p1)));
      const sameDay = e.date.substring(0, 10) === expenseDate.substring(0, 10);
      return sameAmount && samePayee && sameDay;
    });

    if (isDuplicate) {
      toast.warning(`ตรวจพบสลิปซ้ำ: รายการนี้ได้รับการบันทึกไปแล้ว`);
      return;
    }

    const expenseData = {
      date: expenseDate,
      category: expenseCategory,
      payee: expensePayee,
      amount: amountVal,
      note: expenseNote,
      websiteUrl: finalWebsiteUrl,
      necessity,
      isFixed,
      isPaid: isFixed ? isPaid : true,
      frequency: isFixed ? frequency : undefined,
      durationMonths: isFixed && !isIndefinite ? parseInt(durationMonths) : undefined,
      isIndefinite: isFixed ? isIndefinite : undefined,
      transactionId: transactionId.trim() || undefined
    };

    if (editingExpense && onEdit) {
      onEdit(editingExpense.id, expenseData, updateScope);
    } else {
      onAdd(expenseData);
    }
    onClose();
  };

  const activeIconQuery = websiteUrl.trim() || expensePayee.trim();
  const liveDomain = resolveBrandDomain(activeIconQuery);
  const liveFavicon = getSmartFaviconUrl(activeIconQuery);
  const payeeDomain = resolveBrandDomain(expensePayee);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh] border border-white/20 dark:border-slate-800"
          >
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    editingExpense 
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' 
                      : 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400'
                  }`}>
                    {editingExpense ? <Edit2 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </div>
                  {editingExpense ? (t.editExpense || 'แก้ไขรายจ่าย') : (t.addExpense || 'เพิ่มรายจ่าย')}
                </h2>
                <div className="flex items-center gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleScanReceipt} accept="image/*" className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all border border-indigo-100 dark:border-indigo-800/50"
                  >
                    {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  </button>
                  <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Recurring scope update card when editing a recurring expense with multiple periods */}
                  {editingExpense && relatedExpenses.length > 0 && (
                    <div className="col-span-2 p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 shadow-sm space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-indigo-600 text-white rounded-lg mt-0.5 shrink-0">
                          <Repeat className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                              {t.recurringUpdateNotice || 'พบรายจ่ายต่อเนื่องในงวดอื่น'}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                              ทั้งหมด {relatedExpenses.length + 1} งวด
                            </span>
                          </div>
                          <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                            {t.priceUpdateHelp || 'แนะนำสำหรับการปรับราคาใหม่ (เช่น YouTube ปรับเป็น 75 บาท ตั้งแต่เดือนนี้เป็นต้นไป)'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {/* Option 1: Onwards */}
                        <button
                          type="button"
                          onClick={() => setUpdateScope('onwards')}
                          className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                            updateScope === 'onwards'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">
                              {t.updateOnwards || 'งวดนี้และถัดไป'}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              updateScope === 'onwards' ? 'bg-white/20 text-white' : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                            }`}>
                              {futureRelatedExpenses.length + 1} งวด
                            </span>
                          </div>
                          <span className={`text-[10px] ${updateScope === 'onwards' ? 'text-indigo-100' : 'text-slate-500'}`}>
                            แนะนำเมื่อราคาเปลี่ยนใหม่
                          </span>
                        </button>

                        {/* Option 2: Single */}
                        <button
                          type="button"
                          onClick={() => setUpdateScope('single')}
                          className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                            updateScope === 'single'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">
                              {t.updateOnlyThis || 'เฉพาะงวดนี้'}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              updateScope === 'single' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                            }`}>
                              1 งวด
                            </span>
                          </div>
                          <span className={`text-[10px] ${updateScope === 'single' ? 'text-indigo-100' : 'text-slate-500'}`}>
                            แก้ไขเฉพาะงวดนี้เท่านั้น
                          </span>
                        </button>

                        {/* Option 3: All in group */}
                        <button
                          type="button"
                          onClick={() => setUpdateScope('all')}
                          className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                            updateScope === 'all'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold">
                              {t.updateAllInGroup || 'ทุกงวดในชุดนี้'}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              updateScope === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                            }`}>
                              {relatedExpenses.length + 1} งวด
                            </span>
                          </div>
                          <span className={`text-[10px] ${updateScope === 'all' ? 'text-indigo-100' : 'text-slate-500'}`}>
                            อัปเดตทุกงวดรวมอดีต
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1.5 ml-1 uppercase tracking-wider">{t.amount || 'จำนวนเงิน'} *</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.01" 
                        value={expenseAmount} 
                        onChange={e => setExpenseAmount(e.target.value)} 
                        placeholder="0.00" 
                        className="w-full h-14 px-4 bg-rose-50/50 dark:bg-rose-900/20 border-2 border-rose-100 dark:border-rose-900/50 rounded-2xl text-xl font-bold text-rose-700 dark:text-rose-300 focus:border-rose-500 outline-none transition-all" 
                        required 
                        autoFocus
                      />
                      <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300" />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.category || 'หมวดหมู่'}</label>
                    {isAddingCategory ? (
                      <div className="flex gap-2">
                        <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder={t.newCategoryPlaceholder || 'ชื่อหมวดหมู่ใหม่'} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" autoFocus />
                        <button type="button" onClick={() => { if (newCategoryName.trim()) { if (!customCategories.includes(newCategoryName.trim())) setCustomCategories([...customCategories, newCategoryName.trim()]); setExpenseCategory(newCategoryName.trim()); } setIsAddingCategory(false); }} className="px-4 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold">เพิ่ม</button>
                        <button type="button" onClick={() => setIsAddingCategory(false)} className="px-4 py-3 bg-slate-200 text-slate-700 rounded-2xl text-sm font-bold">X</button>
                      </div>
                    ) : (
                      <div className="relative flex items-center">
                        <div className="absolute left-4 z-10 text-slate-400">
                          {getCategoryIcon(expenseCategory)}
                        </div>
                        <select value={expenseCategory} onChange={e => e.target.value === 'ADD_NEW' ? setIsAddingCategory(true) : setExpenseCategory(e.target.value)} className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm appearance-none" required>
                          <option value="" disabled>{t.selectCategory || 'เลือกหมวดหมู่'}</option>
                          {customCategories.map(cat => <option key={cat} value={cat}>{getCategoryName(cat)}</option>)}
                          <option value="ADD_NEW" className="text-indigo-600 font-bold">+ {t.addNewCategory || 'เพิ่มหมวดหมู่'}</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.payee || 'ผู้รับเงิน'}</label>
                    <input type="text" value={expensePayee} onChange={e => setExpensePayee(e.target.value)} placeholder={t.payeePlaceholder || "ชื่อปลายทาง"} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.date || 'วันที่'}</label>
                    <input 
                      type="datetime-local" 
                      value={expenseDate} 
                      max={new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}
                      onChange={e => setExpenseDate(e.target.value)} 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" 
                      required 
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.note || 'หมายเหตุ'}</label>
                    <input type="text" value={expenseNote} onChange={e => setExpenseNote(e.target.value)} placeholder={t.notePlaceholder || "หมายเหตุ (ถ้ามี)"} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">เลขที่รายการสลิป (Transaction ID)</label>
                    <input type="text" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="เลขที่อ้างอิง/เลขที่รายการสลิป (ถ้ามี)" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
                        ไอคอนแบรนด์ / เว็บไซต์ (ค้นหาอัตโนมัติ)
                      </label>
                      {liveDomain && (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          {liveDomain}
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input 
                        type="text" 
                        list="recent-website-urls"
                        value={websiteUrl} 
                        onChange={e => setWebsiteUrl(e.target.value)} 
                        placeholder="พิมพ์ชื่อร้าน เช่น homepro, 7-eleven, shopee, netflix หรือ URL" 
                        className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" 
                      />
                      <div className="absolute right-3.5 flex items-center justify-center pointer-events-none">
                        {liveFavicon ? (
                          <img src={liveFavicon} alt="live icon" className="w-6 h-6 rounded-full bg-white shadow-sm p-0.5 object-contain border border-slate-200/60" referrerPolicy="no-referrer" />
                        ) : (
                          <Globe className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    <datalist id="recent-website-urls">
                      {uniqueUrls.map(url => (
                        <option key={url} value={url} />
                      ))}
                    </datalist>

                    {/* Auto Suggestion Chip from Payee */}
                    {!websiteUrl.trim() && payeeDomain && (
                      <motion.button
                        type="button"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                          setWebsiteUrl(payeeDomain);
                          toast.success(`เลือกไอคอน ${expensePayee} (${payeeDomain}) เรียบร้อย`);
                        }}
                        className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 font-medium bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 cursor-pointer transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                        <span>ดึงไอคอนอัตโนมัติสำหรับ "{expensePayee}" ({payeeDomain})</span>
                      </motion.button>
                    )}

                    {/* Popular Brand Preset Chips */}
                    <div className="pt-1">
                      <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1.5 ml-1">
                        ⚡ แบรนด์ยอดนิยม (คลิกเพื่อดึงไอคอนด่วน):
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin">
                        {BRAND_PRESETS.map((brand) => {
                          const isSelected = websiteUrl.toLowerCase() === brand.domain.toLowerCase() || liveDomain === brand.domain;
                          return (
                            <button
                              key={brand.name}
                              type="button"
                              onClick={() => {
                                setWebsiteUrl(brand.domain);
                                if (!expensePayee.trim()) {
                                  setExpensePayee(brand.name);
                                }
                                toast.success(`เลือกไอคอน ${brand.name} (${brand.domain})`);
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <span>{brand.emoji}</span>
                              <span>{brand.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">ประเภทรายจ่าย</label>
                    <div className="flex gap-4">
                      <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 cursor-pointer transition-all ${necessity === 'necessary' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-500 dark:text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400'}`}>
                        <input type="radio" name="necessity" value="necessary" checked={necessity === 'necessary'} onChange={() => setNecessity('necessary')} className="hidden" />
                        {t.necessary || 'จำเป็น'}
                      </label>
                      <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 cursor-pointer transition-all ${necessity === 'luxury' ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-900/20 dark:border-rose-500 dark:text-rose-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400'}`}>
                        <input type="radio" name="necessity" value="luxury" checked={necessity === 'luxury'} onChange={() => setNecessity('luxury')} className="hidden" />
                        {t.luxury || 'ฟุ่มเฟือย'}
                      </label>
                    </div>
                  </div>

                  <div className="col-span-2 flex flex-col gap-3 py-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isFixed} onChange={e => { setIsFixed(e.target.checked); if (e.target.checked) setIsPaid(false); else setIsPaid(true); }} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.isFixedCost || 'รายจ่ายคงที่'}</span>
                    </label>
                  </div>

                  {isFixed && (
                    <div className="col-span-2 grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">ความถี่</label>
                        <select value={frequency} onChange={e => setFrequency(e.target.value as 'monthly' | 'yearly')} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm">
                          <option value="monthly">รายเดือน</option>
                          <option value="yearly">รายปี</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={isIndefinite} onChange={e => setIsIndefinite(e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">ตลอดไป</span>
                        </label>
                      </div>
                      {!isIndefinite && (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">จำนวนเดือน</label>
                          <input type="number" value={durationMonths} onChange={e => setDurationMonths(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={onClose} className="flex-1 py-4 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">{t.cancel || 'ยกเลิก'}</button>
                  <button type="submit" className="flex-[2] py-4 px-6 rounded-2xl bg-rose-600 text-white font-bold shadow-lg shadow-rose-500/30 hover:bg-rose-500 transition-all">{t.save || 'บันทึก'}</button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
