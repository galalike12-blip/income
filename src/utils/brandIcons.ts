// Utility for smart brand icon & domain lookup from brand names, Thai keywords, or URLs.

export interface BrandInfo {
  name: string;
  domain: string;
  iconTag?: string;
}

// Common Thai & International brands dictionary
export const POPULAR_BRANDS: Record<string, string> = {
  // Retail & Hardware & Home
  'homepro': 'homepro.co.th',
  'โฮมโปร': 'homepro.co.th',
  'โฮม โปร': 'homepro.co.th',
  'thaiwatsadu': 'thaiwatsadu.com',
  'ไทวัสดุ': 'thaiwatsadu.com',
  'dohome': 'dohome.co.th',
  'ดูโฮม': 'dohome.co.th',
  'globalhouse': 'globalhouse.co.th',
  'โกลบอลเฮ้าส์': 'globalhouse.co.th',
  'index': 'indexlivingmall.com',
  'index living mall': 'indexlivingmall.com',
  'อินเด็กซ์': 'indexlivingmall.com',
  'ikea': 'ikea.com',
  'อิเกีย': 'ikea.com',
  'central': 'central.co.th',
  'เซ็นทรัล': 'central.co.th',
  'robinson': 'central.co.th',
  'โรบินสัน': 'central.co.th',
  'themall': 'themall.co.th',
  'เดอะมอลล์': 'themall.co.th',
  'paragon': 'siamparagon.co.th',
  'พารากอน': 'siamparagon.co.th',
  'iconsiam': 'iconsiam.com',
  'ไอคอนสยาม': 'iconsiam.com',
  'uniqlo': 'uniqlo.com',
  'ยูนิโคล่': 'uniqlo.com',
  'decathlon': 'decathlon.co.th',
  'ดีแคทลอน': 'decathlon.co.th',
  'muji': 'muji.com',
  'มูจิ': 'muji.com',
  'mrdiy': 'mrdiy.com',
  'mr diy': 'mrdiy.com',
  'มิสเตอร์ดีไอวาย': 'mrdiy.com',
  'ดีไอวาย': 'mrdiy.com',

  // Convenience & Supermarket
  '711': '7eleven.co.th',
  '7-11': '7eleven.co.th',
  '7eleven': '7eleven.co.th',
  'เซเว่น': '7eleven.co.th',
  'เซเว่นอีเลฟเว่น': '7eleven.co.th',
  'lotus': 'lotuss.com',
  'lotuss': 'lotuss.com',
  'โลตัส': 'lotuss.com',
  'เทสโก้': 'lotuss.com',
  'bigc': 'bigc.co.th',
  'big c': 'bigc.co.th',
  'บิ๊กซี': 'bigc.co.th',
  'tops': 'tops.co.th',
  'ท็อปส์': 'tops.co.th',
  'makro': 'cpmakro.co.th',
  'แม็คโคร': 'cpmakro.co.th',
  'แมคโคร': 'cpmakro.co.th',
  'cj': 'cjexpress.co.th',
  'cj express': 'cjexpress.co.th',
  'ซีเจ': 'cjexpress.co.th',
  'lawson': 'lawson108.inc',
  'ลอว์สัน': 'lawson108.inc',
  'familymart': 'family.co.th',
  'แฟมิลี่มาร์ท': 'family.co.th',
  'foodland': 'foodland.co.th',
  'ฟู้ดแลนด์': 'foodland.co.th',
  'villa market': 'villamarket.com',
  'วิลล่า': 'villamarket.com',

  // E-commerce
  'shopee': 'shopee.co.th',
  'ช้อปปี้': 'shopee.co.th',
  'lazada': 'lazada.co.th',
  'ลาซาด้า': 'lazada.co.th',
  'tiktok': 'tiktok.com',
  'ติ๊กต็อก': 'tiktok.com',
  'amazon': 'amazon.com',
  'อเมซอนช้อปปิ้ง': 'amazon.com',
  'aliexpress': 'aliexpress.com',
  'อาลีเอ็กซ์เพรส': 'aliexpress.com',
  'taobao': 'taobao.com',
  'เถาเป่า': 'taobao.com',

  // Food Delivery & Transport
  'grab': 'grab.com',
  'แกร็บ': 'grab.com',
  'grabfood': 'grab.com',
  'แกร็บฟู้ด': 'grab.com',
  'lineman': 'lineman.line.me',
  'line man': 'lineman.line.me',
  'ไลน์แมน': 'lineman.line.me',
  'foodpanda': 'foodpanda.co.th',
  'ฟู้ดแพนด้า': 'foodpanda.co.th',
  'shopeefood': 'shopee.co.th',
  'ช้อปปี้ฟู้ด': 'shopee.co.th',
  'robinhood': 'robinhood.in.th',
  'โรบินฮู้ด': 'robinhood.in.th',
  'bolt': 'bolt.eu',
  'โบ้ลท์': 'bolt.eu',
  'indrive': 'indrive.com',
  'อินไดรฟ์': 'indrive.com',
  'maxim': 'taximaxim.com',
  'แม็กซิม': 'taximaxim.com',

  // Restaurants & Coffee
  'starbucks': 'starbucks.co.th',
  'สตาร์บัคส์': 'starbucks.co.th',
  'สตาร์บัค': 'starbucks.co.th',
  'cafe amazon': 'cafe-amazon.com',
  'อเมซอน': 'cafe-amazon.com',
  'คาเฟ่อเมซอน': 'cafe-amazon.com',
  'kfc': 'kfc.co.th',
  'เคเอฟซี': 'kfc.co.th',
  'mcdonalds': 'mcdonalds.co.th',
  'แมคโดนัลด์': 'mcdonalds.co.th',
  'แมค': 'mcdonalds.co.th',
  'mk': 'mkrestaurant.com',
  'เอ็มเค': 'mkrestaurant.com',
  'swensens': 'swensens1112.com',
  'สเวนเซ่นส์': 'swensens1112.com',
  'pizzahut': 'pizzahut.co.th',
  'พิซซ่าฮัท': 'pizzahut.co.th',
  'the pizza company': '1112.com',
  '1112': '1112.com',
  'พิซซ่าคอมปะนี': '1112.com',
  'bonchon': 'bonchonthailand.com',
  'บอนชอน': 'bonchonthailand.com',
  'afteryou': 'afteryoudessertcafe.com',
  'อาฟเตอร์ยู': 'afteryoudessertcafe.com',
  'ชาตรามือ': 'chatramue.com',
  'chatramue': 'chatramue.com',
  'เต่าบิน': 'tao-bin.com',
  'taobin': 'tao-bin.com',
  'สุกี้ตี๋น้อย': 'sukiteenoi.com',
  'ตี๋น้อย': 'sukiteenoi.com',
  'barbqplaza': 'barbqplaza.com',
  'บาร์บีคิวพลาซ่า': 'barbqplaza.com',
  'บาร์บีกอน': 'barbqplaza.com',
  'yayoi': 'yayoirestaurant.com',
  'ยาโยอิ': 'yayoirestaurant.com',
  'fuji': 'fujigroup.co.th',
  'ฟูจิ': 'fujigroup.co.th',

  // Gas & Energy & Travel
  'ptt': 'pttor.com',
  'ปตท': 'pttor.com',
  'ปั๊มปตท': 'pttor.com',
  'bangchak': 'bangchak.co.th',
  'บางจาก': 'bangchak.co.th',
  'ปั๊มบางจาก': 'bangchak.co.th',
  'shell': 'shell.co.th',
  'เชลล์': 'shell.co.th',
  'caltex': 'caltex.com',
  'คาลเท็กซ์': 'caltex.com',
  'pt': 'ptgenergy.co.th',
  'ปั๊มพีที': 'ptgenergy.co.th',
  'susco': 'susco.co.th',
  'ซัสโก้': 'susco.co.th',
  'bts': 'bts.co.th',
  'บีทีเอส': 'bts.co.th',
  'mrt': 'metro.bemplc.co.th',
  'เอ็มอาร์ที': 'metro.bemplc.co.th',
  'airasia': 'airasia.com',
  'แอร์เอเชีย': 'airasia.com',
  'nokair': 'nokair.com',
  'นกแอร์': 'nokair.com',

  // Telecom & Utilities
  'pea': 'pea.co.th',
  'การไฟฟ้าส่วนภูมิภาค': 'pea.co.th',
  'ค่าไฟ': 'pea.co.th',
  'mea': 'mea.or.th',
  'การไฟฟ้านครหลวง': 'mea.or.th',
  'mwa': 'mwa.co.th',
  'การประปา': 'mwa.co.th',
  'ค่าน้ำ': 'mwa.co.th',
  'pwa': 'pwa.co.th',
  'ais': 'ais.th',
  'เอไอเอส': 'ais.th',
  'true': 'true.th',
  'ทรู': 'true.th',
  'ทรูมูฟ': 'true.th',
  'dtac': 'dtac.co.th',
  'ดีแทค': 'dtac.co.th',
  '3bb': '3bb.co.th',
  'สามบีบี': '3bb.co.th',
  'nt': 'ntplc.co.th',

  // Banks & Payments
  'kbank': 'kasikornbank.com',
  'กสิกร': 'kasikornbank.com',
  'กสิกรไทย': 'kasikornbank.com',
  'scb': 'scb.co.th',
  'ไทยพาณิชย์': 'scb.co.th',
  'bbl': 'bangkokbank.com',
  'ธนาคารกรุงเทพ': 'bangkokbank.com',
  'ktb': 'krungthai.com',
  'กรุงไทย': 'krungthai.com',
  'ttb': 'ttbbank.com',
  'ทีทีบี': 'ttbbank.com',
  'ทหารไทยธนชาต': 'ttbbank.com',
  'bay': 'krungsri.com',
  'กรุงศรี': 'krungsri.com',
  'gsb': 'gsb.or.th',
  'ออมสิน': 'gsb.or.th',
  'ghb': 'ghbank.co.th',
  'ธอส': 'ghbank.co.th',
  'baac': 'baac.or.th',
  'ธกส': 'baac.or.th',
  'truemoney': 'truemoney.com',
  'ทรูมันนี่': 'truemoney.com',
  'ทรูวอลเล็ท': 'truemoney.com',

  // Logistics
  'flash': 'flashexpress.co.th',
  'แฟลช': 'flashexpress.co.th',
  'kerry': 'th.kerryexpress.com',
  'เคอรี่': 'th.kerryexpress.com',
  'j&t': 'jtexpress.co.th',
  'เจแอนด์ที': 'jtexpress.co.th',
  'ไปรษณีย์ไทย': 'thailandpost.co.th',
  'ไปรษณีย์': 'thailandpost.co.th',

  // Entertainment
  'netflix': 'netflix.com',
  'เน็ตฟลิกซ์': 'netflix.com',
  'youtube': 'youtube.com',
  'ยูทูบ': 'youtube.com',
  'spotify': 'spotify.com',
  'สปอติฟาย': 'spotify.com',
  'apple': 'apple.com',
  'แอปเปิ้ล': 'apple.com',
  'google': 'google.com',
  'กูเกิล': 'google.com',
  'disney': 'disneyplus.com',
  'ดิสนีย์': 'disneyplus.com',
  'canva': 'canva.com',
  'แคนวา': 'canva.com',
  'chatgpt': 'chatgpt.com',
  'openai': 'chatgpt.com',
};

// Preset brand chips for fast selection in AddExpenseModal
export const BRAND_PRESETS: { name: string; domain: string; emoji: string }[] = [
  { name: 'HomePro', domain: 'homepro.co.th', emoji: '🏠' },
  { name: '7-Eleven', domain: '7eleven.co.th', emoji: '🏪' },
  { name: 'Shopee', domain: 'shopee.co.th', emoji: '🛍️' },
  { name: 'Lazada', domain: 'lazada.co.th', emoji: '🛒' },
  { name: 'Grab', domain: 'grab.com', emoji: '🛵' },
  { name: 'LINE MAN', domain: 'lineman.line.me', emoji: '💚' },
  { name: 'Lotus\'s', domain: 'lotuss.com', emoji: '🛒' },
  { name: 'Big C', domain: 'bigc.co.th', emoji: '🏬' },
  { name: 'PTT', domain: 'pttor.com', emoji: '⛽' },
  { name: 'Bangchak', domain: 'bangchak.co.th', emoji: '⛽' },
  { name: 'Starbucks', domain: 'starbucks.co.th', emoji: '☕' },
  { name: 'KFC', domain: 'kfc.co.th', emoji: '🍗' },
  { name: 'Netflix', domain: 'netflix.com', emoji: '🎬' },
  { name: 'Spotify', domain: 'spotify.com', emoji: '🎵' },
  { name: 'PEA ค่าไฟ', domain: 'pea.co.th', emoji: '⚡' },
  { name: 'MWA ค่าน้ำ', domain: 'mwa.co.th', emoji: '💧' },
  { name: 'KBank', domain: 'kasikornbank.com', emoji: '🏦' },
  { name: 'SCB', domain: 'scb.co.th', emoji: '🟣' },
];

/**
 * Resolves a given text input (URL, brand name, Thai name) into a domain name.
 */
export function resolveBrandDomain(input?: string): string | null {
  if (!input) return null;
  const cleanInput = input.trim().toLowerCase();
  if (!cleanInput) return null;

  // 1. If it's already a full URL or domain with dot
  if (cleanInput.includes('.')) {
    try {
      let urlStr = cleanInput;
      if (!cleanInput.startsWith('http://') && !cleanInput.startsWith('https://')) {
        urlStr = 'https://' + cleanInput;
      }
      const host = new URL(urlStr).hostname;
      return host.replace(/^www\./, '');
    } catch {
      // fallback if URL constructor fails
      const match = cleanInput.match(/([a-z0-9|-]+\.[a-z0-9|.]+)/i);
      if (match) return match[1].replace(/^www\./, '');
    }
  }

  // 2. Direct dictionary lookup
  if (POPULAR_BRANDS[cleanInput]) {
    return POPULAR_BRANDS[cleanInput];
  }

  // 3. Substring / Fuzzy match in dictionary
  const entries = Object.entries(POPULAR_BRANDS);
  for (const [key, domain] of entries) {
    if (cleanInput.includes(key) || key.includes(cleanInput)) {
      return domain;
    }
  }

  // 4. Fallback for clean english names without dots (e.g. "mystore")
  const sanitized = cleanInput.replace(/[^a-z0-9-]/gi, '');
  if (sanitized.length >= 2) {
    return `${sanitized}.com`;
  }

  return null;
}

/**
 * Generates Google Favicon URL for a given input (URL, brand, or query).
 */
export function getSmartFaviconUrl(input?: string): string | null {
  const domain = resolveBrandDomain(input);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
