'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import MarkdownRenderer from './MarkdownRenderer'
import Toast from './ui/Toast'
import { authFetch } from '@/lib/authFetch'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, User, Trash2, HelpCircle, Send, Loader2, MessageSquare, GraduationCap, FileText, AlertTriangle } from 'lucide-react'

// --- Main Component ---
const ChatInterface = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [isHumanSupportModalOpen, setIsHumanSupportModalOpen] = useState(false);

    // --- State Hooks ---
    const [sessionId, setSessionId] = useState(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const scrollToBottom = () => {
        scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (user) {
            const loadChatHistory = async () => {
                setIsLoadingHistory(true);
                try {
                    const response = await authFetch(`/api/chat-history?userId=${user.id}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.data.length > 0) {
                            const historyMessages = data.data.map(record => ({
                                role: record.role === 'model' ? 'assistant' : record.role,
                                content: record.message_content,
                                timestamp: new Date(record.timestamp),
                            }));
                            setMessages(historyMessages);
                            setSessionId(data.data[0]?.session_id || crypto.randomUUID());
                        } else {
                            setSessionId(crypto.randomUUID());
                        }
                    }
                } catch (error) {
                    console.error('Failed to load chat history:', error);
                    setSessionId(crypto.randomUUID());
                } finally {
                    setIsLoadingHistory(false);
                }
            };
            loadChatHistory();
        }
    }, [user]);

    const saveChatMessage = async (role, content) => {
        if (!user || !sessionId) return;
        try {
            await authFetch('/api/chat-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    sessionId,
                    role: role === 'assistant' ? 'model' : role,
                    messageContent: content,
                }),
            });
        } catch (error) {
            console.error('Failed to save chat message:', error);
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        const messageText = input.trim();
        if (!messageText || isLoading || !user) return;

        const userMessage = { role: 'user', content: messageText, timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        await saveChatMessage('user', messageText);

        // Add a placeholder for the assistant's message
        const assistantMessagePlaceholder = { role: 'assistant', content: '', timestamp: new Date() };
        setMessages(prev => [...prev, assistantMessagePlaceholder]);

        try {
            const response = await authFetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText, history: messages }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullResponse += chunk;

                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = fullResponse;
                    return newMessages;
                });
            }

            await saveChatMessage('assistant', fullResponse);

        } catch (error) {
            const errorMessageContent = '抱歉，我遇到了一些問題。請檢查您的網路連線後再試一次。';
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = errorMessageContent;
                return newMessages;
            });
            await saveChatMessage('assistant', errorMessageContent);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearHistory = async () => {
        if (!user) return;
        try {
            const response = await authFetch(`/api/chat-history?userId=${user.id}`, { method: 'DELETE' });
            if (response.ok) {
                setMessages([]);
                setSessionId(crypto.randomUUID());
                setToast({ message: '對話記錄已清除', type: 'success' });
            } else {
                throw new Error('Failed to clear history');
            }
        } catch (error) {
            setToast({ message: '清除記錄失敗，請稍後再試', type: 'error' });
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-slate-800 shadow-2xl rounded-2xl overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 dark:text-white">AI 助理</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">智能獎學金申請顧問</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsHumanSupportModalOpen(true)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400 transition-colors">
                        <HelpCircle className="w-6 h-6" />
                    </button>
                    <button onClick={handleClearHistory} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400 transition-colors">
                        <Trash2 className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Chat Area */}
            <main ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {isLoadingHistory && <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>}

                {!isLoadingHistory && messages.length === 0 && <WelcomeScreen />}

                <AnimatePresence>
                    {messages.map((msg, index) => (
                        <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                            <MessageBubble message={msg} />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isLoading && <LoadingBubble />}
                <div ref={messagesEndRef} />
            </main>

            {/* Input Area */}
            <footer className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="詢問獎學金相關問題..."
                        className="flex-1 w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors">
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </footer>

            {toast && <Toast show={true} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <HumanSupportModal isOpen={isHumanSupportModalOpen} onClose={() => setIsHumanSupportModalOpen(false)} user={user} history={messages} setToast={setToast} />
        </div>
    );
};

// --- Sub-components ---

const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    const Avatar = isUser ? User : Sparkles;
    const avatarBg = isUser ? 'bg-indigo-500' : 'bg-slate-500';
    const bubbleBg = isUser ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200';

    // This regex logic will be more important in the next step
    const content = message.content.replace(/\[ANNOUNCEMENT_CARD:.*?\]/g, '').trim();

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${avatarBg} flex-shrink-0`}>
                <Avatar className="w-5 h-5" />
            </div>
            <div className={`p-3 rounded-2xl max-w-[80%] ${bubbleBg} ${isUser ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                <MarkdownRenderer content={content} />
            </div>
        </div>
    );
};

const LoadingBubble = () => (
    <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-slate-500 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
        </div>
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-700 rounded-bl-none">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
        </div>
    </div>
);

const WelcomeScreen = () => (
    <div className="text-center py-10">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">您好！我是您的 AI 助理</h2>
        <p className="text-slate-500 dark:text-slate-400">我可以協助您查詢獎學金相關資訊。</p>
    </div>
);

const HumanSupportModal = ({ isOpen, onClose, user, history, setToast }) => {
    const [formData, setFormData] = useState({ urgency: '中', problemType: '其他', description: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.description.trim()) {
            setToast({ message: '請填寫問題描述', type: 'error' });
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await authFetch('/api/send-support-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    userEmail: user.email,
                    userName: user.user_metadata?.name || 'N/A',
                    conversationHistory: history,
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || '提交失敗');
            setToast({ message: result.message, type: 'success' });
            onClose();
        } catch (error) {
            setToast({ message: `提交失敗: ${error.message}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <form onSubmit={handleSubmit}>
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <HelpCircle className="w-6 h-6 text-indigo-500" />
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">尋求真人協助</h2>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">請填寫以下資訊，我們將會把您的問題及對話紀錄一併寄送給承辦人員，並盡快以 Email 與您聯繫。</p>

                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="urgency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">緊急程度</label>
                                        <select id="urgency" name="urgency" value={formData.urgency} onChange={handleInputChange} className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            <option>低</option>
                                            <option>中</option>
                                            <option>高</option>
                                            <option>緊急</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="problemType" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">問題類型</label>
                                        <select id="problemType" name="problemType" value={formData.problemType} onChange={handleInputChange} className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                            <option>技術問題</option>
                                            <option>帳號問題</option>
                                            <option>功能建議</option>
                                            <option>其他</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">問題描述</label>
                                        <textarea id="description" name="description" rows="4" value={formData.description} onChange={handleInputChange} className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="請詳細說明您遇到的問題..."></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2 rounded-b-2xl">
                                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">取消</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    提交請求
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ChatInterface;
