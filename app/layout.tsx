import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "泉知｜评级盒号与钱币成交查询",
  description: "输入或拍照识别 NGC、PCGS 评级盒号，核对官方认证信息并查询可验证的钱币成交记录。",
  openGraph: {
    title: "泉知｜评级盒号与钱币成交查询",
    description: "查盒号，看清这枚币的来历与行情。",
    type: "website",
    locale: "zh_CN",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
