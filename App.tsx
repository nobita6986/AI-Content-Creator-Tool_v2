
import React, { useEffect, useMemo, useState } from "react";
import { OutlineItem, ScriptBlock, StoryBlock, SEOResult, LoadingStates, Language } from './types';
import * as geminiService from './services/geminiService';
import { Card, Empty, LoadingOverlay, Modal, Toast, Tooltip } from './components/ui';

// --- CONFIGURATION & THEMES ---

const THEMES = {
  vi: {
    bg: "bg-[radial-gradient(1200px_700px_at_50%_0%,#0b1a22_0%,#07141b_45%,#031017_85%)]",
    textMain: "text-sky-50",
    textAccent: "text-sky-300",
    textHighlight: "text-sky-100",
    border: "border-sky-900",
    borderLight: "border-sky-800",
    bgCard: "bg-slate-900",
    bgButton: "bg-sky-900/40",
    bgButtonHover: "hover:bg-sky-900/60",
    ring: "ring-sky-500",
    gradientTitle: "from-sky-400 to-blue-500",
    iconColor: "text-sky-300",
    buttonPrimary: "bg-sky-700/50 hover:bg-sky-600/50",
    subtleBg: "bg-sky-900/20",
    badge: "bg-sky-600 shadow-[0_0_10px_rgba(2,132,199,0.5)]"
  },
  en: {
    // English theme: Emerald / Teal / Slate
    bg: "bg-[radial-gradient(1200px_700px_at_50%_0%,#022c22_0%,#064e3b_45%,#020617_85%)]",
    textMain: "text-emerald-50",
    textAccent: "text-emerald-300",
    textHighlight: "text-emerald-100",
    border: "border-emerald-900",
    borderLight: "border-emerald-800",
    bgCard: "bg-slate-950",
    bgButton: "bg-emerald-900/40",
    bgButtonHover: "hover:bg-emerald-900/60",
    ring: "ring-emerald-500",
    gradientTitle: "from-emerald-400 to-teal-500",
    iconColor: "text-emerald-300",
    buttonPrimary: "bg-emerald-700/50 hover:bg-emerald-600/50",
    subtleBg: "bg-emerald-900/20",
    badge: "bg-emerald-600 shadow-[0_0_10px_rgba(5,150,105,0.5)]"
  }
};

const INITIAL_LOADING_STATES: LoadingStates = {
  outline: false,
  story: false,
  seo: false,
  script: false,
  prompts: false,
};

export default function App() {
  const [language, setLanguage] = useState<Language>('vi'); // Controls Theme & Output Language
  
  const [bookTitle, setBookTitle] = useState("");
  const [bookIdea, setBookIdea] = useState("");
  const [bookImage, setBookImage] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("");
  const [mcName, setMcName] = useState("");

  const [frameRatio, setFrameRatio] = useState("16:9"); // Default to 16:9
  const [durationMin, setDurationMin] = useState(240);
  const [chaptersCount, setChaptersCount] = useState(12);

  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-preview");
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isExtraConfigModalOpen, setIsExtraConfigModalOpen] = useState(false);

  const [apiKeyGemini, setApiKeyGemini] = useState("");
  const [apiKeyOpenAI, setApiKeyOpenAI] = useState("");

  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [storyBlocks, setStoryBlocks] = useState<StoryBlock[]>([]);
  const [seo, setSeo] = useState<SEOResult | null>(null);
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [videoPrompts, setVideoPrompts] = useState<string[]>([]);
  const [thumbTextIdeas, setThumbTextIdeas] = useState<string[]>([]);

  const [loading, setLoading] = useState<LoadingStates>(INITIAL_LOADING_STATES);
  const [error, setError] = useState<string | null>(null);
  
  const [isStoryUploaded, setIsStoryUploaded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const theme = THEMES[language];
  const totalCharsTarget = useMemo(() => durationMin * 1000, [durationMin]);

  useEffect(() => {
    const storedGeminiKey = localStorage.getItem("nd_gemini_api_key");
    const storedOpenAIKey = localStorage.getItem("nd_openai_api_key");
    const storedChannel = localStorage.getItem("nd_channel_name");
    const storedMC = localStorage.getItem("nd_mc_name");

    if (storedGeminiKey) setApiKeyGemini(storedGeminiKey);
    if (storedOpenAIKey) setApiKeyOpenAI(storedOpenAIKey);
    if (storedChannel) setChannelName(storedChannel);
    if (storedMC) setMcName(storedMC);
  }, []);

  const handleSaveKeys = () => {
    localStorage.setItem("nd_gemini_api_key", apiKeyGemini);
    localStorage.setItem("nd_openai_api_key", apiKeyOpenAI);
    setIsApiModalOpen(false);
  };

  const handleSaveExtraConfig = () => {
    localStorage.setItem("nd_channel_name", channelName);
    localStorage.setItem("nd_mc_name", mcName);
    setIsExtraConfigModalOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBookImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Tự động lấy tên file làm tên sách
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    setBookTitle(fileName);

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
            const chunks = geminiService.chunkText(text, 3000);
            const newBlocks: StoryBlock[] = chunks.map((chunk, idx) => ({
                index: idx + 1,
                title: `${language === 'vi' ? 'Phần' : 'Part'} ${idx + 1} (Upload)`,
                content: chunk
            }));
            setStoryBlocks(newBlocks);
            setOutline([]); 
            setScriptBlocks([]); 
            setIsStoryUploaded(true);
            setToastMessage(`Đã upload truyện "${fileName}" thành công (${newBlocks.length} phần). Nhấn 'Review Truyện' để bắt đầu.`);
            e.target.value = ''; // Reset input to allow re-upload
        }
    };
    reader.readAsText(file);
  };

  const withErrorHandling = <T extends any[], R>(fn: (...args: T) => Promise<R>, key: keyof LoadingStates) => {
    return async (...args: T): Promise<R | void> => {
      if (!bookTitle) {
        setError("Vui lòng nhập tên sách trước.");
        return;
      }
      if (selectedModel.startsWith("gpt") && !apiKeyOpenAI) {
        setError("Vui lòng nhập OpenAI API Key để sử dụng các model ChatGPT.");
        return;
      }

      setError(null);
      setLoading(prev => ({ ...prev, [key]: true }));
      try {
        return await fn(...args);
      } catch (err) {
        console.error(`Error in ${key}:`, err);
        setError(`Lỗi khi tạo ${key}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(prev => ({ ...prev, [key]: false }));
      }
    };
  };

  const handleGenerateOutline = withErrorHandling(async () => {
    const result = await geminiService.generateOutline(bookTitle, bookIdea, channelName, mcName, chaptersCount, durationMin, language, selectedModel, apiKeyGemini);
    const indexedResult = result.map((item, index) => ({ ...item, index }));
    setOutline(indexedResult);
    setStoryBlocks([]);
    setScriptBlocks([]);
    setIsStoryUploaded(false);
  }, 'outline');

  const handleGenerateStory = withErrorHandling(async () => {
    if (outline.length === 0) {
        setError("Cần có sườn (outline) trước khi viết truyện.");
        setLoading(prev => ({ ...prev, story: false }));
        return;
    }
    
    setStoryBlocks([]);
    for (const item of outline) {
        const content = await geminiService.generateStoryBlock(item, bookTitle, bookIdea, language, selectedModel, apiKeyGemini);
        setStoryBlocks(prev => [...prev, {
            index: item.index,
            title: item.title,
            content: content
        }]);
    }
  }, 'story');

  const handleGenerateReviewScript = withErrorHandling(async () => {
    if (storyBlocks.length === 0) {
        setError("Chưa có nội dung truyện. Vui lòng 'Viết Truyện' hoặc Upload file trước.");
        setLoading(prev => ({ ...prev, script: false }));
        return;
    }

    setScriptBlocks([]);
    for (const block of storyBlocks) {
      const text = await geminiService.generateReviewBlock(block.content, block.title, bookTitle, channelName, mcName, language, selectedModel, apiKeyGemini);
      const newBlock: ScriptBlock = {
        index: block.index,
        chapter: block.title,
        text: text,
        chars: text.length,
      };
      setScriptBlocks(prev => [...prev, newBlock]);
    }
  }, 'script');

  const handleGenerateSEO = withErrorHandling(async () => {
    const result = await geminiService.generateSEO(bookTitle, channelName, durationMin, language, selectedModel, apiKeyGemini);
    setSeo(result);
  }, 'seo');
  
  const handleGeneratePrompts = withErrorHandling(async () => {
    const [prompts, thumbs] = await Promise.all([
      geminiService.generateVideoPrompts(bookTitle, frameRatio, language, selectedModel, apiKeyGemini),
      geminiService.generateThumbIdeas(bookTitle, durationMin, language, selectedModel, apiKeyGemini)
    ]);
    setVideoPrompts(prompts);
    setThumbTextIdeas(thumbs);
  }, 'prompts');

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const fmtNumber = (n: number) => n.toLocaleString(language === 'vi' ? "vi-VN" : "en-US");

  const downloadCSV = (filename: string, rows: (string[])[]) => {
    const processRow = (row: string[]) => row.map(v => `"${(v ?? "").replace(/"/g, '""')}"`).join(",");
    const csvContent = "\uFEFF" + rows.map(processRow).join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportScriptCSV = () => {
    if (!scriptBlocks.length) return;
    const rows = [["STT", "Chương", "Review Script"], ...scriptBlocks.map(b => [String(b.index), b.chapter, b.text])];
    downloadCSV(`review_${geminiService.slugify(bookTitle)}.csv`, rows);
  };

  const exportStoryCSV = () => {
    if (!storyBlocks.length) return;
    const rows = [["STT", "Chương", "Nội dung Truyện"], ...storyBlocks.map(b => [String(b.index), b.title, b.content])];
    downloadCSV(`truyen_${geminiService.slugify(bookTitle)}.csv`, rows);
  };

  const exportPromptCSV = () => {
    if (!videoPrompts.length) return;
    const rows = [["STT", "Prompt"], ...videoPrompts.map((p, i) => [String(i + 1), p])];
    downloadCSV(`prompts_${geminiService.slugify(bookTitle)}.csv`, rows);
  };

  // Reusable themed button
  const ThemedButton: React.FC<{ children: React.ReactNode, onClick: () => void, disabled?: boolean, className?: string, title?: string }> = ({ children, onClick, disabled, className, title }) => (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border ${theme.borderLight} ${theme.bgButton} px-3 py-2 text-sm font-semibold transition ${theme.bgButtonHover} disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className={`min-h-screen w-full font-sans transition-colors duration-500 ${theme.bg} ${theme.textMain}`}>
      <header className={`px-6 py-8 border-b ${theme.border} sticky top-0 backdrop-blur bg-black/30 z-20`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <a href="/" className="group transition-transform hover:scale-105">
            <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${theme.gradientTitle}`}>
              AI Content Tool
            </h1>
          </a>
          
          <div className="flex items-center gap-3">
              {/* Language Toggle */}
              <div className={`flex items-center p-1 rounded-full ${theme.bgCard} border ${theme.borderLight}`}>
                  <button 
                    onClick={() => setLanguage('vi')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${language === 'vi' ? theme.badge + ' text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Tiếng Việt
                  </button>
                  <button 
                     onClick={() => setLanguage('en')}
                     className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${language === 'en' ? theme.badge + ' text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Tiếng Anh (US)
                  </button>
              </div>

              <button 
                onClick={() => setIsApiModalOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${theme.bgCard}/80 border ${theme.borderLight} ${theme.textAccent} text-sm font-medium hover:${theme.bgButton} hover:text-white transition shadow-lg`}
              >
                <span className={`w-2 h-2 rounded-full ${apiKeyGemini ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></span>
                <span>Cấu hình API</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>

               <button 
                onClick={() => setIsGuideModalOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${theme.bgCard}/80 border ${theme.borderLight} ${theme.textAccent} text-sm font-medium hover:${theme.bgButton} hover:text-white transition shadow-lg`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                <span>Hướng dẫn</span>
              </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-6">
          <Card title="1) Thông tin sách & Cài đặt">
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                  Tên sách / Chủ đề
                  <Tooltip text="Nhập tên sách, chủ đề hoặc từ khóa chính. AI sẽ phát triển nội dung dựa trên thông tin này." />
                </label>
                <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="Nhập tên sách hoặc chủ đề..." className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 focus:ring-2 ${theme.ring} outline-none transition-colors`} />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                  Ý tưởng / Bối cảnh (Tùy chọn)
                  <Tooltip text="Cung cấp thêm ngữ cảnh, phong cách kể chuyện (vd: hài hước, kinh dị) hoặc ý đồ riêng để AI hiểu rõ hơn." />
                </label>
                <textarea 
                    value={bookIdea} 
                    onChange={(e) => setBookIdea(e.target.value)} 
                    placeholder="Mô tả ý tưởng, bối cảnh, hoặc phong cách bạn muốn..." 
                    className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 focus:ring-2 ${theme.ring} outline-none min-h-[80px] text-sm transition-colors`} 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className={`block text-sm font-medium ${theme.textAccent} flex items-center`}>
                      Upload Truyện (để Review ngay)
                      <Tooltip text="Nếu bạn đã có sẵn nội dung truyện (file .txt), hãy tải lên đây để AI tạo kịch bản Review ngay lập tức." />
                    </label>
                    <span className="text-[10px] opacity-70 italic">.txt</span>
                </div>
                <input type="file" accept=".txt" onChange={handleStoryUpload} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold ${theme.bgButton} ${theme.textHighlight} hover:file:${theme.bgCard} cursor-pointer`} />
              </div>

              <div className="pt-1">
                 <button onClick={() => setIsExtraConfigModalOpen(true)} className={`w-full py-2 rounded-lg ${theme.bgCard} border border-dashed ${theme.border} ${theme.textAccent} hover:${theme.bgButton} transition text-sm flex items-center justify-center gap-2`}>
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                   Cấu hình thêm (Ảnh bìa, Kênh, MC)
                 </button>
                 {(bookImage || channelName || mcName) && <div className="text-[10px] mt-1 text-center opacity-60">Đã có thông tin bổ sung</div>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                      Thời lượng (phút)
                      <Tooltip text="Ước lượng thời gian của video thành phẩm. AI sẽ căn chỉnh độ dài nội dung cho phù hợp." />
                    </label>
                    <input type="number" value={durationMin} min={5} max={240} onChange={(e)=>setDurationMin(clamp(parseInt(e.target.value||'0'),5,240))} className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 transition-colors`} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                      Số chương
                      <Tooltip text="Chia nội dung thành bao nhiêu phần nhỏ. Số chương nhiều giúp nội dung chi tiết hơn cho các video dài." />
                    </label>
                    <input type="number" value={chaptersCount} min={3} max={24} onChange={(e)=>setChaptersCount(clamp(parseInt(e.target.value||'0'),3,24))} className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 transition-colors`} />
                  </div>
              </div>
              <div className={`p-3 rounded-lg ${theme.bgCard}/50 border ${theme.border} text-sm flex justify-between items-center`}>
                <div>Tổng ký tự mục tiêu: <b>{fmtNumber(totalCharsTarget)}</b></div>
                <Tooltip text="Số lượng ký tự ước tính dựa trên thời lượng (tốc độ đọc trung bình)." />
              </div>
            </div>
          </Card>
          
          <Card title="2) Tạo Nội Dung">
            <div className="flex flex-col space-y-2">
              <ThemedButton onClick={handleGenerateOutline} disabled={loading.outline || isStoryUploaded}>Phân tích & Tạo sườn</ThemedButton>
              <ThemedButton onClick={handleGenerateStory} disabled={loading.story || isStoryUploaded}>Viết Truyện (Theo sườn)</ThemedButton>
              <ThemedButton onClick={handleGenerateReviewScript} disabled={loading.script}>Review Truyện (Kịch bản Audio)</ThemedButton>
              <ThemedButton onClick={handleGenerateSEO} disabled={loading.seo}>Tạo Tiêu đề & Mô tả SEO</ThemedButton>
              <ThemedButton onClick={handleGeneratePrompts} disabled={loading.prompts}>Tạo Prompt Video & Thumbnail</ThemedButton>
              {error && <p className="text-sm text-red-400 mt-2 bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
          </Card>
        </section>

        <section className="lg:col-span-2 space-y-6">
          <Card title="3) Sườn kịch bản" actions={
              <ThemedButton onClick={handleGenerateOutline} disabled={loading.outline || isStoryUploaded} className="text-xs px-2 py-1 h-8">Tạo sườn</ThemedButton>
          }>
            <div className="relative">
             {loading.outline && <LoadingOverlay />}
             {outline.length === 0 ? <Empty text="Chưa có sườn. Nhấn ‘Phân tích & Tạo sườn’." /> : (
              <ol className="space-y-3 list-decimal ml-5">
                {outline.map((o) => (
                  <li key={o.index} className={`p-3 rounded-xl ${theme.bgCard}/50 border ${theme.border}`}>
                    <div className={`font-semibold ${theme.textHighlight}`}>{o.title}</div>
                    <div className={`${theme.textAccent} text-sm mt-1`}>{o.focus}</div>
                    <ul className="mt-2 text-sm grid md:grid-cols-2 gap-2">
                      {o.actions.map((a,idx)=>(<li key={idx} className={`px-2 py-1 rounded ${theme.bgCard} border ${theme.border} opacity-80`}>• {a}</li>))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
            </div>
          </Card>

          <Card title="4) Nội dung Truyện" actions={
            <div className="flex gap-2">
               <ThemedButton onClick={handleGenerateStory} disabled={loading.story || isStoryUploaded} className="text-xs px-2 py-1 h-8">Viết Truyện</ThemedButton>
               <ThemedButton onClick={exportStoryCSV} disabled={storyBlocks.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</ThemedButton>
            </div>
          }>
             <div className="relative">
                {loading.story && <LoadingOverlay />}
                {storyBlocks.length === 0 ? <Empty text="Chưa có nội dung truyện. Nhấn 'Viết Truyện' hoặc Upload file." /> : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {storyBlocks.map((b) => (
                      <div key={b.index} className={`p-3 rounded-xl ${theme.bgCard}/50 border ${theme.border}`}>
                         <div className={`font-semibold ${theme.textHighlight} mb-2`}>{b.title}</div>
                         <p className="whitespace-pre-wrap leading-relaxed opacity-90 text-sm">{b.content}</p>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </Card>

          <Card title="5) Review Truyện (Kịch bản Audio)" actions={
            <div className="flex gap-2">
               <ThemedButton onClick={handleGenerateReviewScript} disabled={loading.script} className="text-xs px-2 py-1 h-8">Review Truyện</ThemedButton>
               <ThemedButton onClick={exportScriptCSV} disabled={scriptBlocks.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</ThemedButton>
            </div>
          }>
             <div className="relative">
                {loading.script && <LoadingOverlay />}
                {scriptBlocks.length === 0 ? <Empty text="Chưa có kịch bản review. Nhấn ‘Review Truyện’." /> : (
                  <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
                    {scriptBlocks.map((b) => (
                      <div key={b.index} className={`p-3 rounded-xl ${theme.bgCard}/50 border ${theme.border}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold">{b.index}. {b.chapter}</div>
                          <div className={`text-xs ${theme.textAccent}`}>{fmtNumber(b.chars)} {language === 'vi' ? 'ký tự' : 'chars'}</div>
                        </div>
                        <p className={`mt-2 whitespace-pre-wrap leading-relaxed ${theme.textHighlight} opacity-90`}>{b.text}</p>
                      </div>
                    ))}
                    <div className={`text-sm ${theme.textAccent} pt-2`}>Tổng ký tự hiện tại: <b>{fmtNumber(scriptBlocks.reduce((s,x)=>s+x.chars,0))}</b></div>
                  </div>
                )}
            </div>
          </Card>

          <Card title="6) Gợi ý SEO" actions={
             <ThemedButton onClick={handleGenerateSEO} disabled={loading.seo} className="text-xs px-2 py-1 h-8">Tạo SEO</ThemedButton>
          }>
            <div className="relative">
              {loading.seo && <LoadingOverlay />}
              {!seo ? <Empty text="Chưa có SEO. Nhấn ‘Tạo Tiêu đề & Mô tả SEO’." /> : (
                <div className="grid md:grid-cols-2 gap-4">
                   <div>
                      <h4 className="font-semibold mb-2">Tiêu đề gợi ý</h4>
                      <ul className="space-y-2 text-sm">{seo.titles.map((t,i)=> <li key={i} className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border}`}>{t}</li>)}</ul>
                      <h4 className="font-semibold mt-4 mb-2">Hashtags</h4>
                      <div className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border} text-sm`}>{seo.hashtags.join(' ')}</div>
                   </div>
                   <div>
                      <h4 className="font-semibold mb-2">Mô tả video</h4>
                      <textarea rows={12} readOnly className={`w-full text-sm rounded-lg ${theme.bgCard}/70 border ${theme.border} p-3 outline-none`} value={seo.description}></textarea>
                   </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="7) Prompt Video & Thumbnail" actions={
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm">Khung hình:
                  <select value={frameRatio} onChange={(e)=>setFrameRatio(e.target.value)} className={`bg-transparent outline-none ml-1 ${theme.textHighlight} rounded p-1 border border-transparent hover:${theme.border}`}>
                    {['9:16','16:9','1:1','4:5','21:9'].map(r=> <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                  </select>
                </span>
                <ThemedButton onClick={handleGeneratePrompts} disabled={loading.prompts} className="text-xs px-2 py-1 h-8">Tạo Prompt</ThemedButton>
                <ThemedButton onClick={exportPromptCSV} disabled={videoPrompts.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</ThemedButton>
              </div>
          }>
            <div className="relative">
              {loading.prompts && <LoadingOverlay />}
              {videoPrompts.length === 0 && thumbTextIdeas.length === 0 ? <Empty text="Chưa có prompt." /> : (
                 <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Prompt Video (Không gian/Vũ trụ)</h4>
                    <ul className="space-y-2 text-sm">{videoPrompts.map((p,i)=> <li key={i} className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border}`}>{i+1}. {p}</li>)}</ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Gợi ý Text cho Thumbnail</h4>
                    <div className="space-y-2 text-sm">{thumbTextIdeas.map((t,i)=> (<div key={i} className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border}`}>{t}</div>))}</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </main>
      
      <footer className={`max-w-7xl mx-auto px-6 py-10 opacity-70 text-center text-sm`}>
          Powered by Google Gemini
      </footer>

      {/* API Configuration Modal */}
      <Modal 
        isOpen={isApiModalOpen} 
        onClose={() => setIsApiModalOpen(false)} 
        title="Quản lý API & Model"
      >
        <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${theme.textAccent} mb-2`}>Dịch vụ & Model đang dùng</label>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                className={`w-full rounded-lg bg-black/40 border ${theme.borderLight} px-3 py-2 focus:ring-2 ${theme.ring} outline-none text-sm font-medium ${theme.textHighlight}`}
              >
                <optgroup label="Google Gemini" className="bg-slate-900 text-sky-200">
                  <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                  <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                </optgroup>
                <optgroup label="ChatGPT 5.2" className="bg-slate-900 text-sky-200">
                  <option value="gpt-5.2-auto">GPT-5.2 Auto</option>
                  <option value="gpt-5.2-instant">GPT-5.2 Instant</option>
                  <option value="gpt-5.2-thinking">GPT-5.2 Thinking</option>
                  <option value="gpt-5.2-pro">GPT-5.2 Pro</option>
                </optgroup>
              </select>
            </div>

            <div className={`p-4 rounded-lg bg-black/40 border ${theme.borderLight} text-sm space-y-4`}>
                <div>
                  <label className={`block text-xs font-medium ${theme.textAccent} mb-1`}>Google Gemini API Keys (Mỗi dòng một key)</label>
                  <textarea 
                    value={apiKeyGemini}
                    onChange={(e) => setApiKeyGemini(e.target.value)}
                    placeholder="Key..."
                    className={`w-full rounded ${theme.bgCard}/80 border ${theme.borderLight} px-3 py-2 text-xs font-mono focus:border-sky-500 outline-none ${theme.textHighlight} placeholder:opacity-50 min-h-[100px]`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium ${theme.textAccent} mb-1`}>OpenAI API Keys (Mỗi dòng một key)</label>
                  <textarea 
                    value={apiKeyOpenAI}
                    onChange={(e) => setApiKeyOpenAI(e.target.value)}
                    placeholder="Key..."
                    className={`w-full rounded ${theme.bgCard}/80 border ${theme.borderLight} px-3 py-2 text-xs font-mono focus:border-sky-500 outline-none ${theme.textHighlight} placeholder:opacity-50 min-h-[80px]`}
                  />
                </div>

                <p className="text-[10px] opacity-70 italic whitespace-pre-wrap">
                  * API Key được lưu an toàn trong Local Storage của trình duyệt.{'\n'}
                  * Nhập nhiều key (mỗi dòng 1 key) để tự động chuyển đổi khi key bị giới hạn.
                </p>

                <div className="pt-2">
                  <button onClick={handleSaveKeys} className={`w-full py-2 rounded font-semibold ${theme.buttonPrimary} text-white`}>
                    Lưu Cấu Hình & Đóng
                  </button>
                </div>
            </div>
        </div>
      </Modal>

      {/* Guide Modal */}
      <Modal 
        isOpen={isGuideModalOpen} 
        onClose={() => setIsGuideModalOpen(false)} 
        title="Hướng dẫn sử dụng & Quy trình"
      >
        <div className={`space-y-6 ${theme.textHighlight}`}>
          
          <div className={`p-4 rounded-lg ${theme.subtleBg} border ${theme.border} text-sm`}>
            <h4 className={`font-bold text-lg mb-2 ${theme.textAccent}`}>Điểm Mạnh Của Tool</h4>
            <ul className="list-disc list-inside space-y-1 opacity-90">
              <li><b>Tự động hóa toàn diện:</b> Từ ý tưởng thô sơ đến kịch bản chi tiết, SEO, và Prompt hình ảnh chỉ trong vài cú click.</li>
              <li><b>Upload & Review linh hoạt:</b> Hỗ trợ tải lên file truyện có sẵn (.txt) để AI phân tích và viết kịch bản lời dẫn (Review) ngay lập tức mà không cần qua bước tạo sườn.</li>
              <li><b>Đa ngôn ngữ & Thị trường:</b> Hỗ trợ tạo nội dung thuần Việt hoặc chuyển đổi sang tiếng Anh (US) chuẩn bản ngữ để đánh thị trường Global.</li>
              <li><b>Cơ chế API thông minh:</b> Tự động xoay vòng (Round-Robin) và chuyển đổi API Key dự phòng (Fail-over) giúp quá trình tạo không bị gián đoạn.</li>
              <li><b>Kiểm soát chất lượng:</b> Tùy chỉnh chi tiết về thời lượng, số chương, và tỷ lệ khung hình video.</li>
            </ul>
          </div>

          <div>
            <h4 className={`font-bold text-lg mb-3 ${theme.textAccent} border-b ${theme.border} pb-2`}>Quy trình làm việc (Workflow)</h4>
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className={`flex-none w-6 h-6 rounded-full ${theme.badge} text-white flex items-center justify-center font-bold text-xs`}>1</div>
                <div>
                  <div className="font-semibold">Cấu hình & Đầu vào</div>
                  <p className="opacity-80 mt-1">Nhập API Key (Gemini/ChatGPT). Sau đó điền Tên sách, Ý tưởng chủ đạo và các thông số (Thời lượng, Số chương) tại <b>Mục 1</b>.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className={`flex-none w-6 h-6 rounded-full ${theme.badge} text-white flex items-center justify-center font-bold text-xs`}>2</div>
                <div>
                  <div className="font-semibold">Lên Sườn Bài (Outline)</div>
                  <p className="opacity-80 mt-1">Nhấn <b>"Phân tích & Tạo sườn"</b>. AI sẽ phân tích chủ đề và đưa ra cấu trúc chương hồi logic, kịch tính tại <b>Mục 3</b>.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className={`flex-none w-6 h-6 rounded-full ${theme.badge} text-white flex items-center justify-center font-bold text-xs`}>3</div>
                <div>
                  <div className="font-semibold">Viết Nội Dung Chi Tiết</div>
                  <p className="opacity-80 mt-1">Nhấn <b>"Viết Truyện (Theo sườn)"</b>. Hệ thống sẽ lần lượt viết chi tiết từng chương dựa trên dàn ý đã duyệt. Kết quả hiện tại <b>Mục 4</b>.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className={`flex-none w-6 h-6 rounded-full ${theme.badge} text-white flex items-center justify-center font-bold text-xs`}>4</div>
                <div>
                  <div className="font-semibold">Chuyển Thể Audio Script</div>
                  <p className="opacity-80 mt-1">Nhấn <b>"Review Truyện"</b>. AI sẽ đóng vai MC/Reviewer để viết lại nội dung thành lời dẫn hấp dẫn, phù hợp để thu âm (TTS) tại <b>Mục 5</b>.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className={`flex-none w-6 h-6 rounded-full ${theme.badge} text-white flex items-center justify-center font-bold text-xs`}>5</div>
                <div>
                  <div className="font-semibold">Đóng Gói & Xuất Bản</div>
                  <p className="opacity-80 mt-1">Cuối cùng, dùng <b>"Tạo SEO"</b> để lấy Title/Description cho YouTube và <b>"Tạo Prompt"</b> để lấy lệnh vẽ hình minh họa Midjourney/Stable Diffusion.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button onClick={() => setIsGuideModalOpen(false)} className={`w-full py-2 rounded font-semibold ${theme.buttonPrimary} text-white`}>
              Đã hiểu, bắt đầu ngay!
            </button>
          </div>

        </div>
      </Modal>

      {/* Advanced Config Modal (Cover, Channel, MC) */}
      <Modal 
        isOpen={isExtraConfigModalOpen} 
        onClose={handleSaveExtraConfig} 
        title="Cấu hình nâng cao"
      >
         <div className="space-y-4">
            <div className={`p-3 rounded-lg ${theme.bgCard}/50 border border-yellow-800/50 text-sm text-yellow-500`}>
              Thông tin dưới đây sẽ giúp AI cá nhân hóa nội dung tốt hơn (Ví dụ: Chào hỏi tên Kênh, xưng tên MC).
            </div>

            <div>
              <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                Tên Kênh (Channel Name)
                <Tooltip text="Tên kênh YouTube của bạn. AI sẽ nhắc đến tên kênh trong phần Chào mừng hoặc Kêu gọi đăng ký." />
              </label>
              <input value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="VD: Sách Hay Mỗi Ngày..." className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 outline-none transition-colors`} />
            </div>

            <div>
              <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                Tên MC / Người dẫn (Host Name)
                <Tooltip text="Tên người dẫn chuyện. AI sẽ sử dụng để xưng hô thân mật (ví dụ: 'Chào các bạn, mình là [Tên MC]...')." />
              </label>
              <input value={mcName} onChange={(e) => setMcName(e.target.value)} placeholder="VD: Minh Hạnh..." className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 outline-none transition-colors`} />
            </div>

            <div className="border-t border-dashed border-gray-700 pt-4">
               <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                 Tải ảnh bìa (Tùy chọn)
                 <Tooltip text="Ảnh bìa sách hoặc hình ảnh đại diện để tham khảo trong quá trình làm việc (không ảnh hưởng đến AI)." />
               </label>
               <input type="file" accept="image/*" onChange={handleFileUpload} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold ${theme.bgButton} ${theme.textHighlight} hover:file:${theme.bgCard}`} />
               {bookImage && <img src={bookImage} alt="cover" className={`mt-2 w-full max-w-xs mx-auto rounded-lg border ${theme.border}`} />}
            </div>

            <div className="pt-2">
               <button onClick={handleSaveExtraConfig} className={`w-full py-2 rounded font-semibold ${theme.buttonPrimary} text-white`}>
                 Lưu & Đóng
               </button>
            </div>
         </div>
      </Modal>
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}
