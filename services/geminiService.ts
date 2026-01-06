
import { GoogleGenAI, Type } from "@google/genai";
import { OutlineItem, SEOResult } from '../types';

/**
 * Execute a Google GenAI operation with multiple keys.
 * Implements Round-Robin selection and Failover (Retry) logic.
 */
const executeGenAIRequest = async <T>(
    apiKeyInput: string | undefined,
    operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> => {
    // 1. Parse keys from input string (split by newlines, commas, semicolons)
    const userKeys = apiKeyInput
        ? apiKeyInput.split(/[\n,;]+/).map(k => k.trim()).filter(k => k.length > 0)
        : [];
    
    // 2. Add environment key as fallback if available
    const envKey = process.env.API_KEY;
    const candidates = userKeys.length > 0 ? userKeys : (envKey ? [envKey] : []);

    if (candidates.length === 0) {
        throw new Error("Chưa có API Key. Vui lòng nhập API Key trong phần Quản lý API & Model.");
    }

    let lastError: any;
    
    // 3. Pick a random starting index to distribute load across keys (Load Balancing)
    const startIndex = Math.floor(Math.random() * candidates.length);

    // 4. Iterate through keys (Failover Logic)
    for (let i = 0; i < candidates.length; i++) {
        // Wrap around using modulo
        const keyIndex = (startIndex + i) % candidates.length;
        const apiKey = candidates[keyIndex];
        
        try {
            const ai = new GoogleGenAI({ apiKey });
            // Execute the operation
            return await operation(ai);
        } catch (error: any) {
            console.warn(`API Key ending in ...${apiKey.slice(-4)} failed. Attempting switch...`, error);
            lastError = error;
            // If it's the last key, loop ends and we throw error
        }
    }

    throw lastError || new Error("All provided API keys failed.");
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

export const generateOutline = async (bookTitle: string, idea: string, chaptersCount: number, durationMin: number, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<Omit<OutlineItem, 'index'>[]> => {
    const ideaContext = idea ? `Kết hợp với ý tưởng/bối cảnh sau: "${idea}".` : "";
    const prompt = `Dựa trên tên sách/chủ đề "${bookTitle}". ${ideaContext} Hãy tạo dàn ý kịch bản cho một video YouTube theo phong cách kể chuyện/audiobook dài ${durationMin} phút. Dàn ý cần có khoảng ${chaptersCount} chương nội dung chính. Cấu trúc phải bao gồm: 1. Hook (Móc nối), 2. Intro, 3. Các chương chính của câu chuyện, 4. Bài học rút ra, và 5. Kết thúc. Với mỗi mục, cung cấp 'title' (tiêu đề), 'focus' (trọng tâm nội dung), và 3-4 'actions' (chi tiết chính). Trả lời JSON.`;

    return executeGenAIRequest(apiKey, async (ai) => {
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
    });
};

// NEW: Generate Story Content based on Outline
export const generateStoryBlock = async (item: OutlineItem, bookTitle: string, idea: string, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string> => {
    const ideaContext = idea ? `Lưu ý ý tưởng chủ đạo: "${idea}".` : "";
    const prompt = `Bạn là một tiểu thuyết gia tài ba. Hãy viết nội dung chi tiết cho chương "${item.title}" của tác phẩm "${bookTitle}". ${ideaContext}
    Mục tiêu chương này: "${item.focus}".
    Các tình tiết chính: ${item.actions.join(', ')}.
    Hãy viết dưới dạng văn xuôi, kể chuyện, văn phong lôi cuốn, giàu cảm xúc. Độ dài khoảng 400-600 từ. Chỉ trả về nội dung truyện, không bao gồm lời dẫn của AI.`;
    
    return executeGenAIRequest(apiKey, async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    });
};

// UPDATED: Generate Review Script based on Story Content (instead of Outline)
export const generateReviewBlock = async (storyContent: string, chapterTitle: string, bookTitle: string, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string> => {
    const prompt = `Bạn là một Reviewer/MC kênh AudioBook nổi tiếng (giọng đọc trầm ấm, sâu sắc).
    Nhiệm vụ: Viết lời dẫn/kịch bản Review cho phần nội dung sau của cuốn sách/truyện "${bookTitle}".
    
    Chương: "${chapterTitle}"
    Nội dung gốc: "${storyContent}"
    
    Yêu cầu:
    1. Không đọc lại y nguyên truyện. Hãy phân tích, bình luận, và dẫn dắt người nghe đi qua các tình tiết này.
    2. Đan xen giữa kể lại tóm tắt và đưa ra bài học/cảm nhận sâu sắc.
    3. Giọng văn tự nhiên, như đang trò chuyện với thính giả.
    4. Trả lời bằng tiếng Việt.`;
    
    return executeGenAIRequest(apiKey, async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    });
};

export const generateSEO = async (bookTitle: string, durationMin: number, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<SEOResult> => {
    const prompt = `Tạo nội dung SEO cho video YouTube về "${bookTitle}". Video dạng Review/Kể chuyện dài ${durationMin} phút. Cung cấp: 8 tiêu đề clickbait/hấp dẫn, hashtags, keywords, và mô tả video chuẩn SEO. JSON format.`;

    return executeGenAIRequest(apiKey, async (ai) => {
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
    });
};

export const generateVideoPrompts = async (bookTitle: string, frameRatio: string, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string[]> => {
    const prompt = `Generate 5 cinematic, photorealistic video prompts for background visuals in a YouTube video about "${bookTitle}". Visuals should match the story's mood. Aspect ratio: ${frameRatio}. No text/logos. JSON array of strings.`;
    
    return executeGenAIRequest(apiKey, async (ai) => {
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
    });
};

export const generateThumbIdeas = async (bookTitle: string, durationMin: number, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string[]> => {
    const durationStr = `${Math.floor(durationMin / 60)}H${(durationMin % 60).toString().padStart(2, "0")}M`;
    const prompt = `Cho video YouTube về "${bookTitle}", đề xuất 5 text thumbnail ngắn gọn, gây tò mò, tiếng Việt. Một ý phải chứa thời lượng: ${durationStr}. JSON array.`;
    
    return executeGenAIRequest(apiKey, async (ai) => {
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
    });
};

// Helper to chunk large text if needed (simple version)
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
