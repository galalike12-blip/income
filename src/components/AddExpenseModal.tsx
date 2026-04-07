import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, DollarSign, Calendar, Camera, Loader2, Tag, User, FileText, ChevronDown, UtensilsCrossed, Fuel, Zap, Car, ShoppingBag, Wrench, HelpCircle, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ExpenseEntry } from '../types';
import { translations } from '../i18n/translations';
import { useSettings } from '../contexts/SettingsContext';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (expense: Omit<ExpenseEntry, 'id'>) => void;
  onEdit?: (id: string, updates: Partial<ExpenseEntry>) => void;
  customCategories: string[];
  setCustomCategories: (categories: string[]) => void;
  editingExpense?: ExpenseEntry | null;
  sharedFile?: File | null;
}

export function AddExpenseModal({ isOpen, onClose, onAdd, onEdit, customCategories, setCustomCategories, editingExpense, sharedFile }: AddExpenseModalProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const [expenseDate, setExpenseDate] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expensePayee, setExpensePayee] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [necessity, setNecessity] = useState<'necessary' | 'luxury'>('necessary');
  const [isFixed, setIsFixed] = useState(false);
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [isIndefinite, setIsIndefinite] = useState(true);
  const [durationMonths, setDurationMonths] = useState('12');
  const [isScanning, setIsScanning] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
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
        setExpenseDate(editingExpense.date);
        setExpenseCategory(editingExpense.category);
        setExpensePayee(editingExpense.payee || '');
        setExpenseAmount(editingExpense.amount.toString());
        setExpenseNote(editingExpense.note || '');
        setImageUrl(editingExpense.imageUrl || '');
        setNecessity(editingExpense.necessity || 'necessary');
        setIsFixed(editingExpense.isFixed || false);
        setFrequency(editingExpense.frequency || 'monthly');
        setIsIndefinite(editingExpense.isIndefinite ?? true);
        setDurationMonths(editingExpense.durationMonths?.toString() || '12');
      } else {
        const now = new Date();
        setExpenseDate(new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
        setExpenseCategory('');
        setExpensePayee('');
        setExpenseAmount('');
        setExpenseNote('');
        setImageUrl('');
        setNecessity('necessary');
        setIsFixed(false);
        setFrequency('monthly');
        setIsIndefinite(true);
        setDurationMonths('12');
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, editingExpense]);

  const scanFile = async (file: File) => {
    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: [
            {
              parts: [
                { text: "Extract receipt details: amount (number), payee (string), and category. You MUST choose a category from this list: [" + customCategories.join(', ') + "]. If no category matches, you MUST use 'อื่นๆ'. Return JSON only." },
                { inlineData: { data: base64Data, mimeType: file.type } }
              ]
            }
          ],
          config: { 
            responseMimeType: "application/json",
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
          }
        });

        const result = JSON.parse(response.text || '{}');
        if (result.amount) setExpenseAmount(result.amount.toString());
        if (result.payee) setExpensePayee(result.payee);
        if (result.category) {
          setExpenseCategory(result.category);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Scan failed:", error);
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
    const expenseData = {
      date: expenseDate,
      category: expenseCategory,
      payee: expensePayee,
      amount: parseFloat(expenseAmount) || 0,
      note: expenseNote,
      imageUrl,
      necessity,
      isFixed,
      frequency: isFixed ? frequency : undefined,
      durationMonths: isFixed && !isIndefinite ? parseInt(durationMonths) : undefined,
      isIndefinite: isFixed ? isIndefinite : undefined
    };

    if (editingExpense && onEdit) {
      onEdit(editingExpense.id, expenseData);
    } else {
      onAdd(expenseData);
    }
    onClose();
  };

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
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <Plus className="w-6 h-6" />
                  </div>
                  {t.addExpense || 'เพิ่มรายจ่าย'}
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
                    <input type="datetime-local" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" required />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.note || 'หมายเหตุ'}</label>
                    <input type="text" value={expenseNote} onChange={e => setExpenseNote(e.target.value)} placeholder={t.notePlaceholder || "หมายเหตุ (ถ้ามี)"} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">URL รูปภาพ</label>
                    <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
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

                  <div className="col-span-2 flex items-center gap-3 py-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={isFixed} onChange={e => setIsFixed(e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
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
