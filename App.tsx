
import React, { useEffect, useMemo, useState } from "react";
import { OutlineItem, ScriptBlock, StoryBlock, SEOResult, LoadingStates, Language } from './types';
import * as geminiService from './services/geminiService';
import { Card, Empty, LoadingOverlay, Modal } from './components/ui';

// --- CONFIGURATION & LOCALIZATION ---

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
    subtleBg: "bg-sky-900/20"
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
    subtleBg: "bg-emerald-900/20"
  }
};

const TRANSLATIONS = {
  vi: {
    appTitle: "AI Content Creator Tool",
    configApi: "Cấu hình API",
    manageApi: "Quản lý API & Model",
    serviceModel: "Dịch vụ & Model đang dùng",
    geminiKeys: "Google Gemini API Keys (Mỗi dòng một key)",
    openaiKeys: "OpenAI API Keys (Mỗi dòng một key)",
    saveKeys: "Lưu Cấu Hình & Đóng",
    keysNote: "* API Key được lưu an toàn trong Local Storage của trình duyệt.\n* Nhập nhiều key để tự động chuyển đổi khi key bị giới hạn.",
    
    // Section 1
    s1Title: "1) Thông tin sách & Cài đặt",
    bookTitleLabel: "Tên sách / Chủ đề",
    bookTitlePlace: "Nhập tên sách hoặc chủ đề...",
    ideaLabel: "Ý tưởng / Bối cảnh (Tùy chọn)",
    ideaPlace: "Mô tả ý tưởng, bối cảnh, hoặc phong cách bạn muốn...",
    uploadLabel: "Upload Truyện (để Review ngay)",
    uploadCoverLabel: "Tải ảnh bìa (Tùy chọn)",
    durationLabel: "Thời lượng (phút)",
    chapterLabel: "Số chương",
    targetChars: "Tổng ký tự mục tiêu",
    
    // Section 2 - Buttons
    s2Title: "2) Tạo Nội Dung",
    btnOutline: "Phân tích & Tạo sườn",
    btnStory: "Viết Truyện (Theo sườn)",
    btnReview: "Review Truyện (Kịch bản Audio)",
    btnSeo: "Tạo Tiêu đề & Mô tả SEO",
    btnPrompts: "Tạo Prompt Video & Thumbnail",
    
    // Section 3 - Outline
    s3Title: "3) Sườn kịch bản",
    emptyOutline: "Chưa có sườn. Nhấn ‘Phân tích & Tạo sườn’.",
    btnCreateOutline: "Tạo sườn",
    
    // Section 4 - Story
    s4Title: "4) Nội dung Truyện",
    emptyStory: "Chưa có nội dung truyện. Nhấn 'Viết Truyện' hoặc Upload file truyện.",
    btnWriteStory: "Viết Truyện",
    btnDownloadCsv: "Tải CSV",
    alertUploadSuccess: "Đã upload thành công {n} phần truyện. Bạn có thể nhấn 'Review Truyện' ngay bây giờ.",

    // Section 5 - Review
    s5Title: "5) Review Truyện (Kịch bản Audio)",
    emptyReview: "Chưa có kịch bản review. Nhấn ‘Review Truyện’.",
    btnCreateReview: "Review Truyện",
    
    // Section 6 - SEO
    s6Title: "6) Gợi ý SEO",
    emptySeo: "Chưa có SEO. Nhấn ‘Tạo Tiêu đề & Mô tả SEO’.",
    btnCreateSeo: "Tạo SEO",
    lblTitles: "Tiêu đề gợi ý",
    lblHashtags: "Hashtags",
    lblDesc: "Mô tả video",
    
    // Section 7 - Prompts
    s7Title: "7) Prompt Video & Thumbnail",
    emptyPrompts: "Chưa có prompt.",
    lblFrame: "Khung hình:",
    btnCreatePrompt: "Tạo Prompt",
    lblVideoPrompts: "Prompt Video (Không gian/Vũ trụ)",
    lblThumbText: "Gợi ý Text cho Thumbnail",
    
    // Errors
    errNoTitle: "Vui lòng nhập tên sách trước.",
    errNoOpenAi: "Vui lòng nhập OpenAI API Key để sử dụng các model ChatGPT.",
    errGen: "Đã xảy ra lỗi khi tạo {key}. Vui lòng thử lại. Lỗi: {msg}",
    errNoOutline: "Cần có sườn (outline) trước khi viết truyện. Hoặc hãy upload file truyện.",
    errNoStory: "Chưa có nội dung truyện. Vui lòng 'Viết Truyện' hoặc Upload file truyện trước."
  },
  en: {
    appTitle: "AI Content Creator Tool",
    configApi: "API Config",
    manageApi: "API & Model Management",
    serviceModel: "Service & Model",
    geminiKeys: "Google Gemini API Keys (One per line)",
    openaiKeys: "OpenAI API Keys (One per line)",
    saveKeys: "Save Config & Close",
    keysNote: "* API Keys are stored safely in your browser's Local Storage.\n* Enter multiple keys for automatic failover.",
    
    // Section 1
    s1Title: "1) Book Info & Settings",
    bookTitleLabel: "Book Title / Topic",
    bookTitlePlace: "Enter book title or topic...",
    ideaLabel: "Idea / Context (Optional)",
    ideaPlace: "Describe your idea, context, or desired style...",
    uploadLabel: "Upload Story (Review immediately)",
    uploadCoverLabel: "Upload Cover (Optional)",
    durationLabel: "Duration (min)",
    chapterLabel: "Chapters",
    targetChars: "Target Characters",
    
    // Section 2
    s2Title: "2) Actions",
    btnOutline: "Analyze & Outline",
    btnStory: "Write Story (From Outline)",
    btnReview: "Review Story (Audio Script)",
    btnSeo: "Generate SEO Meta",
    btnPrompts: "Video & Thumbnail Prompts",
    
    // Section 3
    s3Title: "3) Script Outline",
    emptyOutline: "No outline yet. Click 'Analyze & Outline'.",
    btnCreateOutline: "Create Outline",
    
    // Section 4
    s4Title: "4) Story Content",
    emptyStory: "No story content yet. Click 'Write Story' or Upload file.",
    btnWriteStory: "Write Story",
    btnDownloadCsv: "Download CSV",
    alertUploadSuccess: "Successfully uploaded {n} story parts. You can click 'Review Story' now.",
    
    // Section 5
    s5Title: "5) Story Review (Audio Script)",
    emptyReview: "No review script yet. Click 'Review Story'.",
    btnCreateReview: "Review Story",
    
    // Section 6
    s6Title: "6) SEO Suggestions",
    emptySeo: "No SEO data. Click 'Generate SEO Meta'.",
    btnCreateSeo: "Create SEO",
    lblTitles: "Suggested Titles",
    lblHashtags: "Hashtags",
    lblDesc: "Video Description",
    
    // Section 7
    s7Title: "7) Video & Thumbnail Prompts",
    emptyPrompts: "No prompts yet.",
    lblFrame: "Ratio:",
    btnCreatePrompt: "Create Prompts",
    lblVideoPrompts: "Video Prompts (Cinematic)",
    lblThumbText: "Thumbnail Text Ideas",
    
    // Errors
    errNoTitle: "Please enter book title first.",
    errNoOpenAi: "Please enter OpenAI API Key to use ChatGPT models.",
    errGen: "Error generating {key}. Please try again. Error: {msg}",
    errNoOutline: "Outline required before writing story. Or upload a story file.",
    errNoStory: "No story content. Please 'Write Story' or Upload file first."
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
  const [language, setLanguage] = useState<Language>('vi');
  
  const [bookTitle, setBookTitle] = useState("");
  const [bookIdea, setBookIdea] = useState("");
  const [bookImage, setBookImage] = useState<string | null>(null);
  const [frameRatio, setFrameRatio] = useState("9:16");
  const [durationMin, setDurationMin] = useState(240);
  const [chaptersCount, setChaptersCount] = useState(12);

  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-preview");
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
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

  const theme = THEMES[language];
  const t = TRANSLATIONS[language];

  const totalCharsTarget = useMemo(() => durationMin * 1000, [durationMin]);

  useEffect(() => {
    const storedGeminiKey = localStorage.getItem("nd_gemini_api_key");
    const storedOpenAIKey = localStorage.getItem("nd_openai_api_key");
    if (storedGeminiKey) setApiKeyGemini(storedGeminiKey);
    if (storedOpenAIKey) setApiKeyOpenAI(storedOpenAIKey);
  }, []);

  const handleSaveKeys = () => {
    localStorage.setItem("nd_gemini_api_key", apiKeyGemini);
    localStorage.setItem("nd_openai_api_key", apiKeyOpenAI);
    setIsApiModalOpen(false);
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
            alert(t.alertUploadSuccess.replace('{n}', String(newBlocks.length)));
        }
    };
    reader.readAsText(file);
  };

  const withErrorHandling = <T extends any[], R>(fn: (...args: T) => Promise<R>, key: keyof LoadingStates) => {
    return async (...args: T): Promise<R | void> => {
      if (!bookTitle) {
        setError(t.errNoTitle);
        return;
      }
      if (selectedModel.startsWith("gpt") && !apiKeyOpenAI) {
        setError(t.errNoOpenAi);
        return;
      }

      setError(null);
      setLoading(prev => ({ ...prev, [key]: true }));
      try {
        return await fn(...args);
      } catch (err) {
        console.error(`Error in ${key}:`, err);
        setError(t.errGen.replace('{key}', key).replace('{msg}', err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(prev => ({ ...prev, [key]: false }));
      }
    };
  };

  const handleGenerateOutline = withErrorHandling(async () => {
    const result = await geminiService.generateOutline(bookTitle, bookIdea, chaptersCount, durationMin, language, selectedModel, apiKeyGemini);
    const indexedResult = result.map((item, index) => ({ ...item, index }));
    setOutline(indexedResult);
    setStoryBlocks([]);
    setScriptBlocks([]);
  }, 'outline');

  const handleGenerateStory = withErrorHandling(async () => {
    if (outline.length === 0) {
        setError(t.errNoOutline);
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
        setError(t.errNoStory);
        setLoading(prev => ({ ...prev, script: false }));
        return;
    }

    setScriptBlocks([]);
    for (const block of storyBlocks) {
      const text = await geminiService.generateReviewBlock(block.content, block.title, bookTitle, language, selectedModel, apiKeyGemini);
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
    const result = await geminiService.generateSEO(bookTitle, durationMin, language, selectedModel, apiKeyGemini);
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
    const rows = [["STT", "Chapter", "Review Script"], ...scriptBlocks.map(b => [String(b.index), b.chapter, b.text])];
    downloadCSV(`review_${geminiService.slugify(bookTitle)}.csv`, rows);
  };

  const exportStoryCSV = () => {
    if (!storyBlocks.length) return;
    const rows = [["STT", "Chapter", "Story Content"], ...storyBlocks.map(b => [String(b.index), b.title, b.content])];
    downloadCSV(`story_${geminiService.slugify(bookTitle)}.csv`, rows);
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
              {t.appTitle}
            </h1>
          </a>
          
          <div className="flex items-center gap-3">
              {/* Language Toggle */}
              <div className={`flex p-1 rounded-full ${theme.bgCard} border ${theme.borderLight}`}>
                  <button 
                    onClick={() => setLanguage('vi')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${language === 'vi' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    VIE
                  </button>
                  <button 
                     onClick={() => setLanguage('en')}
                     className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${language === 'en' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    ENG
                  </button>
              </div>

              <button 
                onClick={() => setIsApiModalOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${theme.bgCard}/80 border ${theme.borderLight} ${theme.textAccent} text-sm font-medium hover:${theme.bgButton} hover:text-white transition shadow-lg`}
              >
                <span className={`w-2 h-2 rounded-full ${apiKeyGemini ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></span>
                <span>{t.configApi}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-6">
          <Card title={t.s1Title}>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.textAccent} mb-1`}>{t.bookTitleLabel}</label>
                <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder={t.bookTitlePlace} className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 focus:ring-2 ${theme.ring} outline-none transition-colors`} />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${theme.textAccent} mb-1`}>{t.ideaLabel}</label>
                <textarea 
                    value={bookIdea} 
                    onChange={(e) => setBookIdea(e.target.value)} 
                    placeholder={t.ideaPlace}
                    className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 focus:ring-2 ${theme.ring} outline-none min-h-[80px] text-sm transition-colors`} 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className={`block text-sm font-medium ${theme.textAccent}`}>{t.uploadLabel}</label>
                    <span className="text-[10px] opacity-70 italic">.txt</span>
                </div>
                <input type="file" accept=".txt" onChange={handleStoryUpload} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold ${theme.bgButton} ${theme.textHighlight} hover:file:${theme.bgCard} cursor-pointer`} />
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.textAccent} mb-1`}>{t.uploadCoverLabel}</label>
                <input type="file" accept="image/*" onChange={handleFileUpload} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold ${theme.bgButton} ${theme.textHighlight} hover:file:${theme.bgCard}`} />
                {bookImage && <img src={bookImage} alt="cover" className={`mt-2 w-full max-w-xs mx-auto rounded-lg border ${theme.border}`} />}
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${theme.textAccent} mb-1`}>{t.durationLabel}</label>
                    <input type="number" value={durationMin} min={5} max={240} onChange={(e)=>setDurationMin(clamp(parseInt(e.target.value||'0'),5,240))} className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 transition-colors`} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.textAccent} mb-1`}>{t.chapterLabel}</label>
                    <input type="number" value={chaptersCount} min={3} max={24} onChange={(e)=>setChaptersCount(clamp(parseInt(e.target.value||'0'),3,24))} className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 transition-colors`} />
                  </div>
              </div>
              <div className={`p-3 rounded-lg ${theme.bgCard}/50 border ${theme.border} text-sm`}>
                <div>{t.targetChars}: <b>{fmtNumber(totalCharsTarget)}</b></div>
              </div>
            </div>
          </Card>
          
          <Card title={t.s2Title}>
            <div className="flex flex-col space-y-2">
              <ThemedButton onClick={handleGenerateOutline} disabled={loading.outline}>{t.btnOutline}</ThemedButton>
              <ThemedButton onClick={handleGenerateStory} disabled={loading.story}>{t.btnStory}</ThemedButton>
              <ThemedButton onClick={handleGenerateReviewScript} disabled={loading.script}>{t.btnReview}</ThemedButton>
              <ThemedButton onClick={handleGenerateSEO} disabled={loading.seo}>{t.btnSeo}</ThemedButton>
              <ThemedButton onClick={handleGeneratePrompts} disabled={loading.prompts}>{t.btnPrompts}</ThemedButton>
              {error && <p className="text-sm text-red-400 mt-2 bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
          </Card>
        </section>

        <section className="lg:col-span-2 space-y-6">
          <Card title={t.s3Title} actions={
              <ThemedButton onClick={handleGenerateOutline} disabled={loading.outline} className="text-xs px-2 py-1 h-8">{t.btnCreateOutline}</ThemedButton>
          }>
            <div className="relative">
             {loading.outline && <LoadingOverlay />}
             {outline.length === 0 ? <Empty text={t.emptyOutline} /> : (
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

          <Card title={t.s4Title} actions={
            <div className="flex gap-2">
               <ThemedButton onClick={handleGenerateStory} disabled={loading.story} className="text-xs px-2 py-1 h-8">{t.btnWriteStory}</ThemedButton>
               <ThemedButton onClick={exportStoryCSV} disabled={storyBlocks.length === 0} className="text-xs px-2 py-1 h-8">{t.btnDownloadCsv}</ThemedButton>
            </div>
          }>
             <div className="relative">
                {loading.story && <LoadingOverlay />}
                {storyBlocks.length === 0 ? <Empty text={t.emptyStory} /> : (
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

          <Card title={t.s5Title} actions={
            <div className="flex gap-2">
               <ThemedButton onClick={handleGenerateReviewScript} disabled={loading.script} className="text-xs px-2 py-1 h-8">{t.btnCreateReview}</ThemedButton>
               <ThemedButton onClick={exportScriptCSV} disabled={scriptBlocks.length === 0} className="text-xs px-2 py-1 h-8">{t.btnDownloadCsv}</ThemedButton>
            </div>
          }>
             <div className="relative">
                {loading.script && <LoadingOverlay />}
                {scriptBlocks.length === 0 ? <Empty text={t.emptyReview} /> : (
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
                    <div className={`text-sm ${theme.textAccent} pt-2`}>{t.targetChars}: <b>{fmtNumber(scriptBlocks.reduce((s,x)=>s+x.chars,0))}</b></div>
                  </div>
                )}
            </div>
          </Card>

          <Card title={t.s6Title} actions={
             <ThemedButton onClick={handleGenerateSEO} disabled={loading.seo} className="text-xs px-2 py-1 h-8">{t.btnCreateSeo}</ThemedButton>
          }>
            <div className="relative">
              {loading.seo && <LoadingOverlay />}
              {!seo ? <Empty text={t.emptySeo} /> : (
                <div className="grid md:grid-cols-2 gap-4">
                   <div>
                      <h4 className="font-semibold mb-2">{t.lblTitles}</h4>
                      <ul className="space-y-2 text-sm">{seo.titles.map((t,i)=> <li key={i} className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border}`}>{t}</li>)}</ul>
                      <h4 className="font-semibold mt-4 mb-2">{t.lblHashtags}</h4>
                      <div className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border} text-sm`}>{seo.hashtags.join(' ')}</div>
                   </div>
                   <div>
                      <h4 className="font-semibold mb-2">{t.lblDesc}</h4>
                      <textarea rows={12} readOnly className={`w-full text-sm rounded-lg ${theme.bgCard}/70 border ${theme.border} p-3 outline-none`} value={seo.description}></textarea>
                   </div>
                </div>
              )}
            </div>
          </Card>

          <Card title={t.s7Title} actions={
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm">{t.lblFrame}
                  <select value={frameRatio} onChange={(e)=>setFrameRatio(e.target.value)} className={`bg-transparent outline-none ml-1 ${theme.textHighlight} rounded p-1 border border-transparent hover:${theme.border}`}>
                    {['9:16','16:9','1:1','4:5','21:9'].map(r=> <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                  </select>
                </span>
                <ThemedButton onClick={handleGeneratePrompts} disabled={loading.prompts} className="text-xs px-2 py-1 h-8">{t.btnCreatePrompt}</ThemedButton>
                <ThemedButton onClick={exportPromptCSV} disabled={videoPrompts.length === 0} className="text-xs px-2 py-1 h-8">{t.btnDownloadCsv}</ThemedButton>
              </div>
          }>
            <div className="relative">
              {loading.prompts && <LoadingOverlay />}
              {videoPrompts.length === 0 && thumbTextIdeas.length === 0 ? <Empty text={t.emptyPrompts} /> : (
                 <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">{t.lblVideoPrompts}</h4>
                    <ul className="space-y-2 text-sm">{videoPrompts.map((p,i)=> <li key={i} className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border}`}>{i+1}. {p}</li>)}</ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{t.lblThumbText}</h4>
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
        title={t.manageApi}
      >
        <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${theme.textAccent} mb-2`}>{t.serviceModel}</label>
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
                  <label className={`block text-xs font-medium ${theme.textAccent} mb-1`}>{t.geminiKeys}</label>
                  <textarea 
                    value={apiKeyGemini}
                    onChange={(e) => setApiKeyGemini(e.target.value)}
                    placeholder="Key..."
                    className={`w-full rounded ${theme.bgCard}/80 border ${theme.borderLight} px-3 py-2 text-xs font-mono focus:border-sky-500 outline-none ${theme.textHighlight} placeholder:opacity-50 min-h-[100px]`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium ${theme.textAccent} mb-1`}>{t.openaiKeys}</label>
                  <textarea 
                    value={apiKeyOpenAI}
                    onChange={(e) => setApiKeyOpenAI(e.target.value)}
                    placeholder="Key..."
                    className={`w-full rounded ${theme.bgCard}/80 border ${theme.borderLight} px-3 py-2 text-xs font-mono focus:border-sky-500 outline-none ${theme.textHighlight} placeholder:opacity-50 min-h-[80px]`}
                  />
                </div>

                <p className="text-[10px] opacity-70 italic whitespace-pre-wrap">
                  {t.keysNote}
                </p>

                <div className="pt-2">
                  <button onClick={handleSaveKeys} className={`w-full py-2 rounded font-semibold ${theme.buttonPrimary} text-white`}>
                    {t.saveKeys}
                  </button>
                </div>
            </div>
        </div>
      </Modal>
    </div>
  );
}
