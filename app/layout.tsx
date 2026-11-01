import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'拾材 — 素材准备工作室',description:'将网页与图库素材汇总到项目收集箱，本机检测、缓存、转换，导出源图包与选片预览。',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
