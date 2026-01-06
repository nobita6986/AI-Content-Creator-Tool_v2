
import { GoogleGenAI, Type } from "@google/genai";
import { OutlineItem, SEOResult, Language } from '../types';

/**
 * Execute a Google GenAI operation using provided apiKey or process.env.API_KEY.
 */
const executeGenAIRequest = async <T>(
    operation: (ai: GoogleGenAI) => Promise<T>,
    apiKey?: string
): Promise<T> => {
    // Prioritize user-provided key, fallback to env key
    const rawKey = apiKey || process.env.API_KEY || "";

    // Sanitize key aggressively to prevent 'Invalid value' header errors.
    // 1. Split by newlines to handle textarea input (user might paste multiple lines)
    // 2. Find the first non-empty candidate
    // 3. Remove ALL whitespace (spaces, tabs, etc) from that candidate
    const candidates = rawKey.split(/[\r\n]+/);
    const key = candidates
        .map(k => k.replace(/\s/g, '')) // Remove all whitespace
        .find(k => k.length > 0);

    if (!key) {
        throw new Error("Missing API Key: Please configure your Gemini API Key in Settings.");
    }
    
    // Verify key only contains safe characters (printable ASCII)
    if (/[^\x21-\x7E]/.test(key)) {
         console.warn("API Key contains potential invalid characters, attempting to strip them.");
    }
    const cleanKey = key.replace(/[^\x21-\x7E]/g, '');

    const ai = new GoogleGenAI({ apiKey: cleanKey });
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

export const generateOutline = async (bookTitle: string, idea: string, channelName: string, mcName: string, chaptersCount: number, durationMin: number, language: Language, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<Omit<OutlineItem, 'index'>[]> => {
    const isVi = language === 'vi';
    const langContext = isVi 
        ? "Ngôn ngữ đầu ra: Tiếng Việt." 
        : "Output Language: English (US). Tone: Professional, Engaging.";
    
    const identityContext = `Context info - Channel Name: "${channelName || 'N/A'}", Host/MC Name: "${mcName || 'N/A'}".`;
    const ideaContext = idea ? (isVi ? `Kết hợp với ý tưởng/bối cảnh: "${idea}".` : `Incorporate this idea/context: "${idea}".`) : "";
    
    const prompt = isVi 
        ? `Dựa trên tên sách/chủ đề "${bookTitle}". ${ideaContext} ${identityContext} Hãy tạo dàn ý kịch bản cho một video YouTube theo phong cách kể chuyện/audiobook dài ${durationMin} phút. Dàn ý cần có khoảng ${chaptersCount} chương nội dung chính. Cấu trúc phải bao gồm: 1. Hook (Móc nối - Nhắc tên kênh ${channelName} nếu phù hợp), 2. Intro (Giới thiệu MC ${mcName}), 3. Các chương chính của câu chuyện, 4. Bài học rút ra, và 5. Kết thúc. ${langContext}`
        : `Based on the book/topic "${bookTitle}". ${ideaContext} ${identityContext} Create a script outline for a YouTube video in storytelling/audiobook style, ${durationMin} minutes long. The outline should have about ${chaptersCount} main chapters. Structure: 1. Hook (Mention channel ${channelName} if fitting), 2. Intro (Introduce Host ${mcName}), 3. Main Story Chapters, 4. Key Takeaways, 5. Conclusion. ${langContext}`;

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
                            actions: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        },
                        required: ["title", "focus", "actions"]
                    }
                }
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    }, apiKey);
};

export const generateStoryBlock = async (item: OutlineItem, bookTitle: string, idea: string, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string> => {
    const isVi = language === 'vi';
    const ideaContext = idea ? (isVi ? `Lưu ý ý tưởng chủ đạo: "${idea}".` : `Note the core idea: "${idea}".`) : "";
    
    const prompt = isVi
        ? `Bạn là một tiểu thuyết gia tài ba. Hãy viết nội dung chi tiết cho chương "${item.title}" của tác phẩm "${bookTitle}". ${ideaContext}
           Mục tiêu: "${item.focus}". Tình tiết: ${item.actions.join(', ')}.
           Viết dạng văn xuôi, kể chuyện, văn phong lôi cuốn, giàu cảm xúc. 400-600 từ. Chỉ trả về nội dung truyện tiếng Việt.`
        : `You are a best-selling novelist. Write detailed content for the chapter "${item.title}" of the book/story "${bookTitle}". ${ideaContext}
           Goal: "${item.focus}". Plot points: ${item.actions.join(', ')}.
           Write in prose, storytelling style, engaging and emotional. 400-600 words. Output strictly in English.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    }, apiKey);
};

export const generateReviewBlock = async (storyContent: string, chapterTitle: string, bookTitle: string, channelName: string, mcName: string, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string> => {
    const isVi = language === 'vi';
    const identityInfo = isVi 
        ? `Tên Kênh: "${channelName || 'Kênh của bạn'}", Tên MC: "${mcName || 'Mình'}".`
        : `Channel Name: "${channelName || 'Your Channel'}", Host Name: "${mcName || 'Me'}".`;

    const prompt = isVi
        ? `Bạn là một Reviewer/MC kênh AudioBook nổi tiếng (giọng đọc trầm ấm, sâu sắc).
           Thông tin định danh: ${identityInfo}. Hãy sử dụng tên Kênh và tên MC này thay cho các từ chung chung khi chào hỏi hoặc giới thiệu.
           Nhiệm vụ: Viết lời dẫn/kịch bản Review cho phần nội dung sau của cuốn sách "${bookTitle}".
           Chương: "${chapterTitle}"
           Nội dung gốc: "${storyContent}"
           Yêu cầu: Phân tích, bình luận, dẫn dắt. Đan xen tóm tắt và bài học. Giọng văn tự nhiên. Trả lời Tiếng Việt.`
        : `You are a famous Audiobook Narrator/Reviewer (warm, insightful voice).
           Identity Info: ${identityInfo}. Use this Channel Name and Host Name naturally in intros/outros instead of placeholders.
           Task: Write a script/commentary review for the following content of the book "${bookTitle}".
           Chapter: "${chapterTitle}"
           Original Content: "${storyContent}"
           Requirements: Analyze, commentate, and guide the listener. Interweave summary with deep insights. Natural, conversational tone. Output strictly in English.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    }, apiKey);
};

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
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
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
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
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
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
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
