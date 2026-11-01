import type { Metadata } from 'next'
import './globals.css'
export const metadata:Metadata={title:'ZenOne — One AI. Every Device.',description:'A trusted coordination layer for your connected digital life.'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
