export const speakText = (text: string) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      
      // Limit decimal numbers in the text to at most 2 decimal places for cleaner speech
      const formattedText = text.replace(/(\d+)\.(\d+)/g, (match, integerPart, decimalPart) => {
        if (decimalPart.length > 2) {
          const num = parseFloat(match);
          const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
          return rounded.toString();
        }
        return match;
      });

      const utterance = new SpeechSynthesisUtterance(formattedText);
      utterance.lang = 'th-TH';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        const thaiVoice = voices.find(v => v.lang.includes('th') || v.lang.toLowerCase().includes('thai'));
        if (thaiVoice) {
          utterance.voice = thaiVoice;
        }
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        setVoiceAndSpeak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          setVoiceAndSpeak();
          window.speechSynthesis.onvoiceschanged = null;
        };
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
};
