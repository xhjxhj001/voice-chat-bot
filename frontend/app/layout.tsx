import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '语音聊天机器人',
  description: 'AI语音助手',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  )
} 