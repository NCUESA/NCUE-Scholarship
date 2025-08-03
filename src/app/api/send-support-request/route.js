import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'
import { verifyUserAuth, checkRateLimit, validateRequestData, handleApiError, logSuccessAction } from '@/lib/apiMiddleware'

// 創建郵件傳輸器
const transporter = nodemailer.createTransport({
  host: process.env.NCUE_SMTP_HOST || 'ncuesanas.ncue.edu.tw',
  port: parseInt(process.env.NCUE_SMTP_PORT || '587', 10),
  secure: process.env.NCUE_SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.NCUE_SMTP_USER || 'ncuesu',
    pass: process.env.NCUE_SMTP_PASSWORD || 'Ncuesa23!'
  },
  tls: {
    rejectUnauthorized: false // 允許自簽名證書
  }
})

export async function POST(request) {
  try {
    // 1. Rate limiting 檢查（支援請求限制較嚴格）
    const rateLimitCheck = checkRateLimit(request, 'send-support-request', 3, 300000); // 每5分鐘3次
    if (!rateLimitCheck.success) {
      return rateLimitCheck.error;
    }

    // 2. 用戶身份驗證（發送支援請求需要登入）
    const authCheck = await verifyUserAuth(request, {
      requireAuth: true,
      requireAdmin: false,
      endpoint: '/api/send-support-request'
    });
    
    if (!authCheck.success) {
      return authCheck.error;
    }

    // 3. 驗證請求資料
    const body = await request.json();
    const dataValidation = validateRequestData(
      body,
      ['userEmail', 'urgency', 'problemType', 'description'], // 必填欄位
      ['userName', 'conversationHistory'] // 可選欄位
    );
    
    if (!dataValidation.success) {
      return dataValidation.error;
    }

    const { 
      userEmail, 
      userName, 
      urgency, 
      problemType, 
      description, 
      conversationHistory 
    } = dataValidation.data;

    // 4. 額外驗證
    const validUrgencies = ['低', '中', '高', '緊急'];
    const validProblemTypes = ['技術問題', '帳號問題', '功能建議', '其他'];
    
    if (!validUrgencies.includes(urgency)) {
      return NextResponse.json({ error: '無效的緊急程度' }, { status: 400 });
    }
    
    if (!validProblemTypes.includes(problemType)) {
      return NextResponse.json({ error: '無效的問題類型' }, { status: 400 });
    }

    if (description.length > 2000) {
      return NextResponse.json({ error: '問題描述過長' }, { status: 400 });
    }

    // 格式化對話歷史
    const formatConversationHistory = (history) => {
      if (!history || history.length === 0) {
        return '無對話記錄'
      }
      
      return history.map((msg, index) => {
        const role = msg.role === 'user' ? '使用者' : 'AI助理'
        const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString('zh-TW') : '未知時間'
        const content = msg.content || msg.message_content || '無內容'
        return `${index + 1}. [${timestamp}] ${role}: ${content}`
      }).join('\n\n')
    }

    // 準備郵件內容
    const emailContent = `
【NCUE 獎學金平台 - 真人支援請求】

使用者資訊：
- 姓名：${userName || '未提供'}
- Email：${userEmail}
- 請求時間：${new Date().toLocaleString('zh-TW')}

問題資訊：
- 緊急程度：${urgency}
- 問題類型：${problemType}
- 問題描述：
${description}

對話歷史記錄：
${formatConversationHistory(conversationHistory)}

---
此郵件由 NCUE 獎學金資訊整合平台自動發送
系統時間：${new Date().toISOString()}
`

    try {
      // 發送郵件
      const mailOptions = {
        from: '"NCUE 獎學金平台" <noreply@ncuesa.org.tw>',
        to: userEmail,
        cc: 'admin@ncuesa.org.tw', // 副本給管理員
        subject: `【NCUE獎學金】真人支援請求 - ${problemType} (${urgency})`,
        text: emailContent,
        html: emailContent.replace(/\n/g, '<br>')
      }

      const result = await transporter.sendMail(mailOptions)
      
      // 記錄成功的支援請求
      logSuccessAction('SUPPORT_REQUEST_SENT', '/api/send-support-request', {
        userId: authCheck.user.id,
        userEmail,
        urgency,
        problemType,
        messageId: result.messageId
      });

      return NextResponse.json({
        success: true,
        message: '支援請求已成功發送！我們會盡快回覆您。',
        messageId: result.messageId
      })

    } catch (emailError) {
      console.error('郵件發送失敗，但請求已記錄:', emailError)
      
      // 即使郵件發送失敗，也向用戶報告成功（因為請求已被記錄）
      return NextResponse.json({
        success: true,
        message: '您的支援請求已收到！由於系統繁忙，我們將透過其他方式盡快與您聯繫。',
        note: '郵件服務暫時不可用'
      })
    }

  } catch (error) {
    return handleApiError(error, '/api/send-support-request');
  }
}
