import { NextResponse } from 'next/server';
import { verifyUserAuth, checkRateLimit, validateRequestData, handleApiError, logSuccessAction } from '@/lib/apiMiddleware';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const getSystemPrompt = () => `# 角色 (Persona)
你是一位專為「NCUE 獎學金資訊整合平台」設計的**頂尖AI助理**。你的個性是專業、精確且樂於助人。

# 你的核心任務
你的任務是根據我提供給你的「# 參考資料」（這可能來自內部公告或外部網路搜尋），用**自然、流暢的繁體中文**總結並回答使用者關於獎學金的問題。

# 表達與格式化規則
1.  **直接回答:** 請直接以對話的方式回答問題，不要說「根據我找到的資料...」。
2.  **結構化輸出:** 當資訊包含多個項目時，請**務必使用 Markdown 的列表或表格**來呈現。
3.  **引用來源:**
    -   如果參考資料來源是「外部網頁搜尋結果」，你【必須】在回答的適當位置，以 \`[參考連結](URL)\` 的格式自然地嵌入來源連結。
    -   如果參考資料來源是「內部公告」，你【絕對不能】生成任何連結。
4.  **最終回應:** 在你的主要回答內容之後，如果本次回答參考了內部公告，請務必在訊息的【最後】加上 \`[ANNOUNCEMENT_CARD:id1,id2,...]\` 這樣的標籤，其中 id 是你參考的公告 ID。
5.  **嚴禁事項:**
    -   【絕對禁止】輸出任何 JSON 格式的程式碼或物件。
    -   如果「# 參考資料」為空或與問題無關，就直接回答：「抱歉，關於您提出的問題，我目前找不到相關的資訊。」

# 服務範圍限制
你的知識範圍【嚴格限定】在「獎學金申請」相關事務。若問題無關，請禮貌地說明你的服務範圍並拒絕回答。`;

// --- Helper Functions ---

async function getGeminiModel() {
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }
    const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
    return genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        },
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
    });
}

async function checkUserIntent(message) {
    const model = await getGeminiModel();
    const prompt = `你是一個意圖分類器。請判斷以下使用者問題是否與「獎學金」、「助學金」或「校內財務補助」相關。請只回傳 "RELATED" 或 "UNRELATED"。\n\n使用者問題: '${message}'`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim().toUpperCase();
}

async function retrieveRelevantAnnouncements(message) {
    try {
        const { supabase } = await import('@/lib/supabase/client');
        const { data, error } = await supabase
            .from('announcements')
            .select('id, title, summary, full_content, target_audience, application_limitations')
            .or(`title.ilike.%${message}%,summary.ilike.%${message}%,target_audience.ilike.%${message}%`)
            .limit(5);

        if (error) {
            console.error('Error fetching announcements:', error);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error('Error in retrieveRelevantAnnouncements:', error);
        return [];
    }
}

// Main API handler
export async function POST(request) {
    try {
        const rateLimitCheck = checkRateLimit(request, 'chat', 30, 60000);
        if (!rateLimitCheck.success) return rateLimitCheck.error;

        const authCheck = await verifyUserAuth(request, { requireAuth: true });
        if (!authCheck.success) return authCheck.error;

        const body = await request.json();
        const dataValidation = validateRequestData(body, ['message'], ['history']);
        if (!dataValidation.success) return dataValidation.error;
        const { message, history = [] } = dataValidation.data;

        // --- Intent Check ---
        const intent = await checkUserIntent(message);
        if (intent === 'UNRELATED') {
            const rejectionMessage = "🌋呃呃呃……我腦袋冒煙了！\n我只懂「獎學金申請」的事，其他的話……就像數學考卷一樣讓我大當機 🫠\n\n這個問題我可能無法幫上忙，但你可以試試找真人幫手唷👇";
            return new NextResponse(rejectionMessage, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }

        // --- RAG Pipeline ---
        const relevantAnnouncements = await retrieveRelevantAnnouncements(message);
        let contextText = '';
        if (relevantAnnouncements.length > 0) {
            contextText = relevantAnnouncements.map(ann => `
## 公告標題：《${ann.title}》 (ID: ${ann.id})
**摘要:** ${ann.summary}
**詳細內容:** ${ann.full_content || ann.summary}
**適用對象:** ${ann.target_audience || '未指定'}
**申請限制:** ${ann.application_limitations || '請查看詳細公告'}
---`).join('\n\n');
        }

        const systemPrompt = getSystemPrompt();
        const fullPrompt = `${systemPrompt}\n\n# 對話歷史:\n${history.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\nuser: ${message}\n\n# 參考資料 (內部獎學金公告)：\n${contextText || '無相關內部公告資料。'}`;

        const model = await getGeminiModel();
        const result = await model.generateContentStream(fullPrompt);

        // --- Streaming Response ---
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    controller.enqueue(encoder.encode(text));
                }

                // Append announcement cards if relevant
                if (relevantAnnouncements.length > 0) {
                    const announcementIds = relevantAnnouncements.map(ann => ann.id).join(',');
                    const cardTag = `\n\n[ANNOUNCEMENT_CARD:${announcementIds}]`;
                    controller.enqueue(encoder.encode(cardTag));
                }

                controller.close();
            }
        });

        logSuccessAction('CHAT_STREAM_RESPONSE', '/api/chat', {
            userId: authCheck.user.id,
            messageLength: message.length,
            foundAnnouncements: relevantAnnouncements.length > 0
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff'
            }
        });

    } catch (error) {
        return handleApiError(error, '/api/chat');
    }
}
