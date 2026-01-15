
import { GoogleGenAI, Type } from "@google/genai";
import { OutlineItem, SEOResult, Language } from '../types';

/**
 * Helper to safely parse JSON from AI response
 */
const safeJsonParse = (text: string | undefined): any => {
    if (!text || !text.trim()) {
        throw new Error("AI trả về phản hồi rỗng (có thể do lỗi mạng hoặc bộ lọc an toàn).");
    }
    
    let clean = text.trim();
    // Remove markdown code blocks if present (common in AI responses)
    if (clean.startsWith("```json")) {
        clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
         clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error. Raw text:", text);
        throw new Error(`Lỗi định dạng dữ liệu từ AI: ${e instanceof Error ? e.message : String(e)}`);
    }
};

/**
 * Execute a Google GenAI operation using provided apiKey or process.env.API_KEY.
 */
const executeGenAIRequest = async <T>(
    operation: (ai: GoogleGenAI) => Promise<T>,
    apiKey?: string
): Promise<T> => {
    let rawKey = apiKey;

    // Fallback to env key safely (handle cases where process is not defined in browser)
    if (!rawKey) {
        try {
            // @ts-ignore
            rawKey = process.env.API_KEY || "";
        } catch (e) {
            rawKey = "";
        }
    }
    rawKey = rawKey || "";

    // Strategy 1: Regex match for standard Google API Key (AIza...)
    const googleKeyMatch = rawKey.match(/AIza[0-9A-Za-z\-_]{35}/);
    let key = googleKeyMatch ? googleKeyMatch[0] : "";

    // Strategy 2: Fallback cleanup
    if (!key) {
        const cleaned = rawKey.replace(/[\s"'\r\n]/g, '').replace(/[^\x21-\x7E]/g, '');
        if (cleaned.length > 0) key = cleaned;
    }

    if (!key) {
        throw new Error("Missing API Key: Please configure your Gemini API Key in Settings.");
    }

    const ai = new GoogleGenAI({ apiKey: key });
    return await operation(ai);
};

export const slugify = (s: string): string => {
    return (s || "ndgroup").toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

export const generateOutline = async (bookTitle: string, idea: string, channelName: string, mcName: string, chaptersCount: number, durationMin: number, language: Language, isAutoDuration: boolean = false, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<Omit<OutlineItem, 'index'>[]> => {
    const isVi = language === 'vi';
    const langContext = isVi 
        ? "Ngôn ngữ đầu ra: Tiếng Việt." 
        : "Output Language: English (US). Tone: Professional, Engaging.";
    
    const identityContext = `Context info - Channel Name: "${channelName || 'N/A'}", Host/MC Name: "${mcName || 'N/A'}".`;
    const ideaContext = idea ? (isVi ? `Kết hợp với ý tưởng/bối cảnh: "${idea}".` : `Incorporate this idea/context: "${idea}".`) : "";
    
    let structurePrompt = "";
    if (isAutoDuration) {
        structurePrompt = isVi
            ? `Mục tiêu: Tạo ra một video dài khoảng 40-60 phút. Hãy tự quyết định số lượng chương phù hợp (thường từ 15 đến 25 chương).`
            : `Goal: Create a video approximately 40-60 minutes long. You decide the appropriate number of chapters (usually 15-25).`;
    } else {
        structurePrompt = isVi
            ? `Mục tiêu: Video dài chính xác ${durationMin} phút. Chia thành ${chaptersCount} chương chính.`
            : `Goal: Video strictly ${durationMin} minutes long. Structure into ${chaptersCount} main chapters.`;
    }

    const prompt = isVi 
        ? `Dựa trên tên sách/chủ đề "${bookTitle}". ${ideaContext} ${identityContext} Hãy tạo dàn ý kịch bản cho một video YouTube theo phong cách kể chuyện/audiobook.
           ${structurePrompt}
           Cấu trúc bắt buộc: 1. Hook (Móc nối), 2. Intro (Giới thiệu MC), 3. Các chương chính, 4. Bài học, 5. Kết thúc. ${langContext}`
        : `Based on the book/topic "${bookTitle}". ${ideaContext} ${identityContext} Create a script outline for a YouTube video in storytelling/audiobook style.
           ${structurePrompt}
           Required Structure: 1. Hook, 2. Intro, 3. Main Story Chapters, 4. Key Takeaways, 5. Conclusion. ${langContext}`;

    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-pro-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            focus: { type: Type.STRING },
                            actions: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["title", "focus", "actions"]
                    }
                }
            }
        });
        return safeJsonParse(response.text);
    }, apiKey);
};

export const generateStoryBlock = async (item: OutlineItem, bookTitle: string, idea: string, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string> => {
    const isVi = language === 'vi';
    const ideaContext = idea ? (isVi ? `Lưu ý ý tưởng chủ đạo: "${idea}".` : `Note the core idea: "${idea}".`) : "";
    
    const prompt = isVi
        ? `Bạn là một tiểu thuyết gia. Viết nội dung cho chương "${item.title}" của tác phẩm "${bookTitle}". ${ideaContext}
           Mục tiêu: "${item.focus}". Tình tiết: ${item.actions.join(', ')}.
           Viết văn xuôi, kể chuyện, lôi cuốn. 400-600 từ. Chỉ trả về nội dung truyện tiếng Việt.`
        : `You are a novelist. Write content for chapter "${item.title}" of "${bookTitle}". ${ideaContext}
           Goal: "${item.focus}". Plot points: ${item.actions.join(', ')}.
           Write in prose, storytelling style. 400-600 words. Output strictly in English.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text || "";
    }, apiKey);
};

export const generateReviewBlock = async (storyContent: string, chapterTitle: string, bookTitle: string, channelName: string, mcName: string, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string> => {
    const isVi = language === 'vi';
    const identityInfo = isVi 
        ? `Tên Kênh: "${channelName || 'Kênh của bạn'}", Tên MC: "${mcName || 'Mình'}".`
        : `Channel Name: "${channelName || 'Your Channel'}", Host Name: "${mcName || 'Me'}".`;

    const prompt = isVi
        ? `Bạn là MC AudioBook (giọng đọc trầm ấm). ${identityInfo}.
           Viết lời dẫn/review cho: "${bookTitle}", Chương: "${chapterTitle}".
           Nội dung gốc: "${storyContent.substring(0, 5000)}"
           Yêu cầu: Phân tích, bình luận, dẫn dắt. Giọng văn tự nhiên. Trả lời Tiếng Việt.`
        : `You are an Audiobook Narrator. ${identityInfo}.
           Write commentary/script for: "${bookTitle}", Chapter: "${chapterTitle}".
           Original Content: "${storyContent.substring(0, 5000)}"
           Requirements: Analyze, commentate, guide. Natural tone. Output strictly in English.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text || "";
    }, apiKey);
};

// --- EXISTING SEO/PROMPT FUNCTIONS (FOR AI GENERATED FLOW) ---

export const generateSEO = async (bookTitle: string, channelName: string, durationMin: number, language: Language, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<SEOResult> => {
    const isVi = language === 'vi';
    const channelContext = channelName ? (isVi ? `Tên kênh là "${channelName}".` : `Channel name is "${channelName}".`) : "";

    const prompt = isVi
        ? `Tạo nội dung SEO cho video YouTube về "${bookTitle}". ${channelContext} Dạng Review/Kể chuyện dài ${durationMin} phút. Cung cấp: 8 tiêu đề clickbait, hashtags, keywords (bao gồm tên kênh), và mô tả video chuẩn SEO (nhắc đến tên kênh). JSON format. Ngôn ngữ: Tiếng Việt.`
        : `Generate SEO content for a YouTube video about "${bookTitle}". ${channelContext} Format: Audiobook/Review, ${durationMin} minutes long. Provide: 8 clickbait titles, hashtags, keywords (include channel name), and a SEO-optimized video description (mention channel name). JSON format. Language: English.`;

    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-pro-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        titles: { type: Type.ARRAY, items: { type: Type.STRING } },
                        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                        description: { type: Type.STRING }
                    },
                    required: ["titles", "hashtags", "keywords", "description"]
                }
            }
        });
        return safeJsonParse(response.text);
    }, apiKey);
};

export const generateVideoPrompts = async (bookTitle: string, frameRatio: string, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string[]> => {
    const prompt = `Generate 5 cinematic, photorealistic video prompts for background visuals in a YouTube video about "${bookTitle}". Visuals should match the story's mood. Aspect ratio: ${frameRatio}. No text/logos. JSON array of strings.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return safeJsonParse(response.text);
    }, apiKey);
};

export const generateThumbIdeas = async (bookTitle: string, durationMin: number, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string[]> => {
    const isVi = language === 'vi';
    const durationStr = `${Math.floor(durationMin / 60)}H${(durationMin % 60).toString().padStart(2, "0")}M`;
    const prompt = isVi
        ? `Cho video YouTube về "${bookTitle}", đề xuất 5 text thumbnail ngắn gọn, gây tò mò, tiếng Việt. Một ý phải chứa thời lượng: ${durationStr}. JSON array.`
        : `For a YouTube video about "${bookTitle}", suggest 5 short, curiosity-inducing thumbnail texts in English. One idea must include duration: ${durationStr}. JSON array.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return safeJsonParse(response.text);
    }, apiKey);
};

// --- NEW SEO/PROMPT FUNCTIONS (FOR UPLOADED STORY FLOW) ---

export const generateSEOFromContent = async (storyContent: string, channelName: string, durationMin: number, language: Language, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<SEOResult> => {
    const isVi = language === 'vi';
    const channelContext = channelName ? (isVi ? `Tên kênh là "${channelName}".` : `Channel name is "${channelName}".`) : "";
    
    // TRUNCATE CONTENT SAFELY: 15,000 characters (~4000 tokens) is plenty for context but safe from limits.
    const truncatedContent = storyContent.substring(0, 15000);

    const prompt = isVi
        ? `Hãy đọc đoạn trích truyện bên dưới. Bỏ qua tên file nếu vô nghĩa. Tự xác định tên truyện, thể loại, nhân vật chính từ nội dung.
           Nhiệm vụ: Tạo nội dung SEO cho video YouTube Review/Kể chuyện dài ${durationMin} phút về tác phẩm này. ${channelContext}
           Nội dung truyện (trích đoạn): "${truncatedContent}..."
           Yêu cầu output: 8 tiêu đề clickbait hấp dẫn (dựa trên cốt truyện), hashtags, keywords (gồm tên kênh), và mô tả video chuẩn SEO (tóm tắt cốt truyện & nhắc tên kênh). JSON format. Ngôn ngữ: Tiếng Việt.`
        : `Read the story excerpt below. Ignore filename if generic. Identify real title, genre, characters.
           Task: Generate SEO content for YouTube Review/Audiobook (${durationMin} mins). ${channelContext}
           Story Excerpt: "${truncatedContent}..."
           Output Requirements: 8 clickbait titles (based on plot), hashtags, keywords (include channel name), and SEO description. JSON format. Language: English.`;

    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-pro-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        titles: { type: Type.ARRAY, items: { type: Type.STRING } },
                        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                        description: { type: Type.STRING }
                    },
                    required: ["titles", "hashtags", "keywords", "description"]
                }
            }
        });
        return safeJsonParse(response.text);
    }, apiKey);
};

export const generateVideoPromptsFromContent = async (storyContent: string, frameRatio: string, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string[]> => {
    // Truncate safely
    const truncatedContent = storyContent.substring(0, 10000);

    const prompt = `Analyze the story excerpt: "${truncatedContent}...". Identify setting, mood, and visual style.
    Task: Generate 5 cinematic, photorealistic video prompts for background visuals in a YouTube video about this story. Visuals should match the story's actual mood. Aspect ratio: ${frameRatio}. No text/logos. JSON array of strings.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return safeJsonParse(response.text);
    }, apiKey);
};

export const generateThumbIdeasFromContent = async (storyContent: string, durationMin: number, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string[]> => {
    const isVi = language === 'vi';
    const durationStr = `${Math.floor(durationMin / 60)}H${(durationMin % 60).toString().padStart(2, "0")}M`;
    const truncatedContent = storyContent.substring(0, 10000);

    const prompt = isVi
        ? `Đọc đoạn trích: "${truncatedContent}...". Hiểu cốt truyện chính.
           Cho video YouTube về truyện này, đề xuất 5 text thumbnail ngắn gọn, gây tò mò, sát với tình tiết gay cấn. Ngôn ngữ: Tiếng Việt.
           Yêu cầu: Một ý phải chứa thời lượng: ${durationStr}. JSON array.`
        : `Read excerpt: "${truncatedContent}...". Understand main plot.
           Suggest 5 short, curiosity-inducing thumbnail texts based on actual dramatic plot points. Language: English.
           Requirement: One idea must include duration: ${durationStr}. JSON array.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return safeJsonParse(response.text);
    }, apiKey);
};

export const chunkText = (text: string, maxChars: number = 2000): string[] => {
    const chunks: string[] = [];
    let currentChunk = "";
    const paragraphs = text.split('\n');
    
    for (const para of paragraphs) {
        if ((currentChunk + para).length > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = "";
        }
        currentChunk += para + "\n";
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk);
    return chunks;
};
