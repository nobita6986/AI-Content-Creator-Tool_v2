
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

export const generateOutline = async (bookTitle: string, chaptersCount: number, durationMin: number, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<Omit<OutlineItem, 'index'>[]> => {
    const prompt = `Dựa trên tên sách "${bookTitle}", hãy tạo dàn ý kịch bản cho một video YouTube theo phong cách audiobook "nhân văn hóa" dài ${durationMin} phút. Dàn ý cần có khoảng ${chaptersCount} chương nội dung chính. Cấu trúc phải bao gồm: 1. Hook (Móc nối), 2. Intro + POV của người dẫn chuyện, 3. Các chương chính (đặt tiêu đề theo chủ đề có thể có của sách), 4. Kế hoạch hành động 7 ngày, 5. Tóm tắt 3 điểm chính, và 6. Kêu gọi hành động (CTA). Với mỗi mục trong dàn ý, hãy cung cấp 'title' (tiêu đề), 'focus' (nội dung chính của phần đó), và một danh sách 3-4 'actions' (các điểm chính cần nói). Trả lời bằng tiếng Việt.`;

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

export const generateSEO = async (bookTitle: string, durationMin: number, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<SEOResult> => {
    const prompt = `Tạo nội dung SEO cho một video YouTube về cuốn sách "${bookTitle}". Video này là một bài phân tích theo phong cách audiobook dài ${durationMin} phút. Hãy cung cấp: 8 tiêu đề hấp dẫn, một danh sách các hashtag liên quan, một danh sách từ khóa, và một phần mô tả video hấp dẫn. Trả lời bằng tiếng Việt.`;

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

export const generateScriptBlock = async (item: OutlineItem, bookTitle: string, targetChars: number, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string> => {
    const prompt = `Bạn là một người viết kịch bản cho kênh YouTube nổi tiếng. Phong cách của bạn là một người dẫn chuyện tự nhiên, đàm thoại cho audiobook, kết hợp với góc nhìn cá nhân. Hãy viết kịch bản cho phần có tiêu đề "${item.title}" trong một video về cuốn sách "${bookTitle}". Mục tiêu của phần này là: "${item.focus}". Các điểm chính cần nói là: ${item.actions.join(', ')}. Kịch bản nên dài khoảng ${targetChars} ký tự. Viết bằng giọng văn tự nhiên, hấp dẫn, phù hợp để thu âm. Trả lời bằng tiếng Việt.`;
    
    return executeGenAIRequest(apiKey, async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    });
};

export const generateVideoPrompts = async (bookTitle: string, frameRatio: string, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string[]> => {
    const prompt = `Generate 5 cinematic, photorealistic video prompts for background visuals in a YouTube video about the book "${bookTitle}". The prompts should be inspired by the book's main themes (e.g., if about stoicism, think calm nature, ancient architecture; if sci-fi, think cosmic visuals). Each prompt MUST be for the aspect ratio ${frameRatio}. The style should be beautiful, subtle, and non-distracting. Do not include any text or logos. Respond with a JSON array of strings.`;
    
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
    const prompt = `Cho một video YouTube về cuốn sách "${bookTitle}", hãy đề xuất 5 ý tưởng văn bản ngắn gọn, có tác động mạnh cho thumbnail. Văn bản phải hấp dẫn và bằng tiếng Việt. Một ý tưởng phải bao gồm thời lượng: ${durationStr}.`;
    
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
