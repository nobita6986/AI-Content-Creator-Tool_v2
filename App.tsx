
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { OutlineItem, ScriptBlock, SEOResult, LoadingStates } from './types';
import * as geminiService from './services/geminiService';
import { Card, Empty, LoadingOverlay, Modal } from './components/ui';

const INITIAL_LOADING_STATES: LoadingStates = {
  outline: false,
  seo: false,
  script: false,
  prompts: false,
};

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}

const Button: React.FC<ButtonProps> = ({ children, onClick, disabled, className, title }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-lg border border-sky-800 bg-sky-900/40 px-3 py-2 text-sm font-semibold transition hover:bg-sky-900/60 disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {children}
  </button>
);

export default function App() {
  const [bookTitle, setBookTitle] = useState("");
  const [bookImage, setBookImage] = useState<string | null>(null);
  const [frameRatio, setFrameRatio] = useState("9:16");
  const [durationMin, setDurationMin] = useState(240);
  const [chaptersCount, setChaptersCount] = useState(12);

  // API Management State
  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-preview");
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [apiKeyGemini, setApiKeyGemini] = useState("");
  const [apiKeyOpenAI, setApiKeyOpenAI] = useState("");

  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [seo, setSeo] = useState<SEOResult | null>(null);
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [videoPrompts, setVideoPrompts] = useState<string[]>([]);
  const [thumbTextIdeas, setThumbTextIdeas] = useState<string[]>([]);

  const [loading, setLoading] = useState<LoadingStates>(INITIAL_LOADING_STATES);
  const [error, setError] = useState<string | null>(null);

  const totalCharsTarget = useMemo(() => durationMin * 1000, [durationMin]);

  // Load keys from localStorage on mount
  useEffect(() => {
    const storedGeminiKey = localStorage.getItem("nd_gemini_api_key");
    const storedOpenAIKey = localStorage.getItem("nd_openai_api_key");
    if (storedGeminiKey) setApiKeyGemini(storedGeminiKey);
    if (storedOpenAIKey) setApiKeyOpenAI(storedOpenAIKey);
  }, []);

  const handleSaveKeys = () => {
    localStorage.setItem("nd_gemini_api_key", apiKeyGemini);
    localStorage.setItem("nd_openai_api_key", apiKeyOpenAI);
    // alert("Đã lưu API Key thành công vào trình duyệt!"); 
    setIsApiModalOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBookImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const withErrorHandling = <T extends any[], R>(fn: (...args: T) => Promise<R>, key: keyof LoadingStates) => {
    return async (...args: T): Promise<R | void> => {
      if (!bookTitle) {
        setError("Vui lòng nhập tên sách trước.");
        return;
      }
      // Basic validation for OpenAI selection
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
        setError(`Đã xảy ra lỗi khi tạo ${key}. Vui lòng thử lại. Lỗi: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(prev => ({ ...prev, [key]: false }));
      }
    };
  };

  // Pass apiKeyGemini to services. 
  const handleGenerateOutline = withErrorHandling(async () => {
    const result = await geminiService.generateOutline(bookTitle, chaptersCount, durationMin, selectedModel, apiKeyGemini);
    const indexedResult = result.map((item, index) => ({ ...item, index }));
    setOutline(indexedResult);
  }, 'outline');

  const handleGenerateSEO = withErrorHandling(async () => {
    const result = await geminiService.generateSEO(bookTitle, durationMin, selectedModel, apiKeyGemini);
    setSeo(result);
  }, 'seo');
  
  const handleGeneratePrompts = withErrorHandling(async () => {
    const [prompts, thumbs] = await Promise.all([
      geminiService.generateVideoPrompts(bookTitle, frameRatio, selectedModel, apiKeyGemini),
      geminiService.generateThumbIdeas(bookTitle, durationMin, selectedModel, apiKeyGemini)
    ]);
    setVideoPrompts(prompts);
    setThumbTextIdeas(thumbs);
  }, 'prompts');

  const handleGenerateScript = withErrorHandling(async () => {
    setScriptBlocks([]);
    let currentOutline = outline;
    if (currentOutline.length === 0) {
      const generatedOutline = await geminiService.generateOutline(bookTitle, chaptersCount, durationMin, selectedModel, apiKeyGemini);
      currentOutline = generatedOutline.map((item, index) => ({ ...item, index }));
      setOutline(currentOutline);
    }

    const totalWeight = currentOutline.length; 
    const charsPerBlock = Math.round(totalCharsTarget / totalWeight);

    for (const item of currentOutline) {
      const text = await geminiService.generateScriptBlock(item, bookTitle, charsPerBlock, selectedModel, apiKeyGemini);
      const newBlock: ScriptBlock = {
        index: item.index + 1,
        chapter: item.title,
        text: text,
        chars: text.length,
      };
      setScriptBlocks(prev => [...prev, newBlock]);
    }
  }, 'script');

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const fmtNumber = (n: number) => n.toLocaleString("vi-VN");

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
    const rows = [["STT", "Chương", "Kịch bản"], ...scriptBlocks.map(b => [String(b.index), b.chapter, b.text])];
    downloadCSV(`kichban_${geminiService.slugify(bookTitle)}.csv`, rows);
  };

  const exportPromptCSV = () => {
    if (!videoPrompts.length) return;
    const rows = [["STT", "Prompt"], ...videoPrompts.map((p, i) => [String(i + 1), p])];
    downloadCSV(`prompts_${geminiService.slugify(bookTitle)}.csv`, rows);
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(1200px_700px_at_50%_0%,#0b1a22_0%,#07141b_45%,#031017_85%)] text-sky-50 font-sans">
      <header className="px-6 py-8 border-b border-sky-900/40 sticky top-0 backdrop-blur bg-black/30 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <a href="/" className="group transition-transform hover:scale-105">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500 group-hover:from-sky-300 group-hover:to-blue-400">
              AI Content Creator Tool
            </h1>
          </a>
          
          <button 
            onClick={() => setIsApiModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 border border-sky-700/50 text-sky-300 text-sm font-medium hover:bg-sky-900/40 hover:text-white transition shadow-lg"
          >
            <span className={`w-2 h-2 rounded-full ${apiKeyGemini ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></span>
            <span>Cấu hình API</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-6">
          <Card title="1) Thông tin sách & Cài đặt">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sky-300 mb-1">Tên sách</label>
                <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="Nhập tên sách…" className="w-full rounded-lg bg-slate-900/70 border border-sky-900 px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-sky-300 mb-1">Tải ảnh bìa (tùy chọn)</label>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-900/50 file:text-sky-200 hover:file:bg-sky-900/80" />
                {bookImage && <img src={bookImage} alt="cover" className="mt-2 w-full max-w-xs mx-auto rounded-lg border border-sky-900/60" />}
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-sky-300 mb-1">Thời lượng (phút)</label>
                    <input type="number" value={durationMin} min={5} max={240} onChange={(e)=>setDurationMin(clamp(parseInt(e.target.value||'0'),5,240))} className="w-full rounded-lg bg-slate-900/70 border border-sky-900 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-sky-300 mb-1">Số chương</label>
                    <input type="number" value={chaptersCount} min={6} max={24} onChange={(e)=>setChaptersCount(clamp(parseInt(e.target.value||'0'),6,24))} className="w-full rounded-lg bg-slate-900/70 border border-sky-900 px-3 py-2" />
                  </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/50 border border-sky-900/60 text-sm">
                <div>Tổng ký tự mục tiêu: <b>{fmtNumber(totalCharsTarget)}</b></div>
              </div>
            </div>
          </Card>
          
          <Card title="2) Tạo Nội Dung">
            <div className="flex flex-col space-y-2">
              <Button onClick={handleGenerateOutline} disabled={loading.outline}>Phân tích & Tạo sườn</Button>
              {/* Order changed: Script before SEO */}
              <Button onClick={handleGenerateScript} disabled={loading.script}>Viết Kịch Bản Chi Tiết</Button>
              <Button onClick={handleGenerateSEO} disabled={loading.seo}>Tạo Tiêu đề & Mô tả SEO</Button>
              <Button onClick={handleGeneratePrompts} disabled={loading.prompts}>Tạo Prompt Video & Thumbnail</Button>
              {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
            </div>
          </Card>
        </section>

        <section className="lg:col-span-2 space-y-6">
          <Card title="3) Sườn kịch bản (Humanized Audiobook)" actions={
              <Button onClick={handleGenerateOutline} disabled={loading.outline} className="text-xs px-2 py-1 h-8">Phân tích & Tạo sườn</Button>
          }>
            <div className="relative">
             {loading.outline && <LoadingOverlay />}
             {outline.length === 0 ? <Empty text="Chưa có sườn. Nhấn ‘Phân tích & Tạo sườn’." /> : (
              <ol className="space-y-3 list-decimal ml-5">
                {outline.map((o) => (
                  <li key={o.index} className="p-3 rounded-xl bg-slate-900/50 border border-sky-900/60">
                    <div className="font-semibold text-sky-100">{o.title}</div>
                    <div className="text-sky-300 text-sm mt-1">{o.focus}</div>
                    <ul className="mt-2 text-sm grid md:grid-cols-2 gap-2">
                      {o.actions.map((a,idx)=>(<li key={idx} className="px-2 py-1 rounded bg-slate-800/60 border border-sky-900/60 text-sky-200">• {a}</li>))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
            </div>
          </Card>

          <Card title="4) Kịch bản chi tiết" actions={
            <div className="flex gap-2">
               <Button onClick={handleGenerateScript} disabled={loading.script} className="text-xs px-2 py-1 h-8">Viết Kịch Bản</Button>
               <Button onClick={exportScriptCSV} disabled={scriptBlocks.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</Button>
            </div>
          }>
             <div className="relative">
                {loading.script && <LoadingOverlay />}
                {scriptBlocks.length === 0 ? <Empty text="Chưa có kịch bản. Nhấn ‘Viết Kịch Bản’." /> : (
                  <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
                    {scriptBlocks.map((b) => (
                      <div key={b.index} className="p-3 rounded-xl bg-slate-900/50 border border-sky-900/60">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold">{b.index}. {b.chapter}</div>
                          <div className="text-xs text-sky-300">{fmtNumber(b.chars)} ký tự</div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-sky-200">{b.text}</p>
                      </div>
                    ))}
                    <div className="text-sm text-sky-300 pt-2">Tổng ký tự hiện tại: <b>{fmtNumber(scriptBlocks.reduce((s,x)=>s+x.chars,0))}</b></div>
                  </div>
                )}
            </div>
          </Card>

          <Card title="5) Gợi ý SEO (Tiêu đề, Mô tả...)" actions={
             <Button onClick={handleGenerateSEO} disabled={loading.seo} className="text-xs px-2 py-1 h-8" title="Tạo Tiêu đề & Mô tả SEO">Tạo SEO</Button>
          }>
            <div className="relative">
              {loading.seo && <LoadingOverlay />}
              {!seo ? <Empty text="Chưa có SEO. Nhấn ‘Tạo Tiêu đề & Mô tả SEO’." /> : (
                <div className="grid md:grid-cols-2 gap-4">
                   <div>
                      <h4 className="font-semibold mb-2">Tiêu đề gợi ý</h4>
                      <ul className="space-y-2 text-sm">{seo.titles.map((t,i)=> <li key={i} className="p-2 rounded bg-slate-900/50 border border-sky-900/60">{t}</li>)}</ul>
                      <h4 className="font-semibold mt-4 mb-2">Hashtags</h4>
                      <div className="p-2 rounded bg-slate-900/50 border border-sky-900/60 text-sm">{seo.hashtags.join(' ')}</div>
                   </div>
                   <div>
                      <h4 className="font-semibold mb-2">Mô tả video</h4>
                      <textarea rows={12} readOnly className="w-full text-sm rounded-lg bg-slate-900/70 border border-sky-900 p-3" value={seo.description}></textarea>
                   </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="6) Prompt Video & Thumbnail" actions={
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm">Khung hình:
                  <select value={frameRatio} onChange={(e)=>setFrameRatio(e.target.value)} className="bg-transparent outline-none ml-1 text-sky-200 rounded p-1 border border-transparent hover:border-sky-800">
                    {['9:16','16:9','1:1','4:5','21:9'].map(r=> <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                  </select>
                </span>
                <Button onClick={handleGeneratePrompts} disabled={loading.prompts} className="text-xs px-2 py-1 h-8" title="Tạo Prompt Video & Thumbnail">Tạo Prompt</Button>
                <Button onClick={exportPromptCSV} disabled={videoPrompts.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</Button>
              </div>
          }>
            <div className="relative">
              {loading.prompts && <LoadingOverlay />}
              {videoPrompts.length === 0 && thumbTextIdeas.length === 0 ? <Empty text="Chưa có prompt. Nhấn ‘Tạo prompt video & thumbnail’." /> : (
                 <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Prompt Video (Không gian/Vũ trụ)</h4>
                    <ul className="space-y-2 text-sm">{videoPrompts.map((p,i)=> <li key={i} className="p-2 rounded bg-slate-900/50 border border-sky-900/60">{i+1}. {p}</li>)}</ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Gợi ý Text cho Thumbnail</h4>
                    <div className="space-y-2 text-sm">{thumbTextIdeas.map((t,i)=> (<div key={i} className="p-2 rounded bg-slate-900/50 border border-sky-900/60">{t}</div>))}</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </main>
      
      <footer className="max-w-7xl mx-auto px-6 py-10 text-sky-400/80 text-center text-sm">
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
              <label className="block text-sm font-medium text-sky-300 mb-2">Dịch vụ & Model đang dùng</label>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-lg bg-black/40 border border-sky-800/60 px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none text-sm font-medium text-sky-100"
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

            <div className="p-4 rounded-lg bg-black/40 border border-sky-900/40 text-sm space-y-4">
                <div>
                  <label className="block text-xs font-medium text-sky-400 mb-1">Google Gemini API Keys (Mỗi dòng một key)</label>
                  <textarea 
                    value={apiKeyGemini}
                    onChange={(e) => setApiKeyGemini(e.target.value)}
                    placeholder="Dán danh sách API Key vào đây..."
                    className="w-full rounded bg-slate-900/80 border border-sky-800/50 px-3 py-2 text-xs font-mono focus:border-sky-500 outline-none text-sky-100 placeholder:text-sky-800 min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-sky-400 mb-1">OpenAI API Keys (Mỗi dòng một key)</label>
                  <textarea 
                    value={apiKeyOpenAI}
                    onChange={(e) => setApiKeyOpenAI(e.target.value)}
                    placeholder="Dán danh sách API Key vào đây..."
                    className="w-full rounded bg-slate-900/80 border border-sky-800/50 px-3 py-2 text-xs font-mono focus:border-sky-500 outline-none text-sky-100 placeholder:text-sky-800 min-h-[80px]"
                  />
                </div>

                <p className="text-[10px] text-sky-600 italic">
                  * API Key được lưu an toàn trong Local Storage của trình duyệt. 
                  <br/>
                  * Nhập nhiều key (mỗi dòng 1 key) để tự động chuyển đổi khi key bị giới hạn.
                </p>

                <div className="pt-2">
                  <Button onClick={handleSaveKeys} className="w-full bg-sky-600 hover:bg-sky-500 border-sky-500 text-white">Lưu Cấu Hình & Đóng</Button>
                </div>
            </div>
        </div>
      </Modal>
    </div>
  );
}
