'use client'

import { useAuth } from '@/hooks/useAuth'
import ChatInterface from '@/components/ChatInterface'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export default function AiAssistantPage() {
    const { isAuthenticated, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/login?redirect=/ai-assistant')
        }
    }, [isAuthenticated, loading, router])

    if (loading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
                <p className="text-lg font-semibold">正在載入 AI 助理...</p>
                <p>需要您保持登入狀態</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-2 sm:p-4">
            <div className="w-full max-w-4xl h-[95vh] max-h-[800px] flex">
                <ChatInterface />
            </div>
        </div>
    )
}
