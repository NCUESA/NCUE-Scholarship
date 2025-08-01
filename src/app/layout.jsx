import { Noto_Sans_TC } from 'next/font/google'
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ClientProviders from "@/components/ClientProviders";

const notoSans = Noto_Sans_TC({
	subsets: ['latin'],
	weight: ['400', '700'],
	variable: '--font-noto-sans',
	display: 'swap',
})

export const metadata = {
	title: '彰師大生輔組 校外獎學金資訊平台',
}

export default function RootLayout({ children }) {
	return (
		<html lang="zh-TW" className={notoSans.variable}>
			<body className={notoSans.className}>
				<ClientProviders>
					<div className="layout-container">
						<Header />
						<main className="main-content">
							{children}
						</main>
						<Footer />
					</div>
				</ClientProviders>
			</body>
		</html>
	);
}
