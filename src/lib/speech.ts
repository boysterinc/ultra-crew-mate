// Speak an athlete's arrival notification in Thai using the Web Speech API.
// Falls back silently when the API or a Thai voice isn't available.

let cachedVoices: SpeechSynthesisVoice[] | null = null;

const getVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  if (cachedVoices && cachedVoices.length > 0) return cachedVoices;
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
};

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  // Voices load asynchronously in some browsers.
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export const speakArrival = (athleteName: string) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const utter = new SpeechSynthesisUtterance(`${athleteName} กำลังจะเข้ามา`);
    utter.lang = "th-TH";
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 1;
    const voices = getVoices();
    const thaiVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("th"));
    if (thaiVoice) utter.voice = thaiVoice;
    // Cancel any prior queued speech so alerts don't pile up.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    /* ignore */
  }
};
