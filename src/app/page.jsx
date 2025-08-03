"use client";
import Image from "next/image";
import AnnouncementList from "@/components/AnnouncementList";
import { motion } from "framer-motion";

export default function Home() {
	return (
		<div className="font-sans min-h-screen bg-slate-50">
			{/* Hero Section */}
			<div className="relative w-full h-64 md:h-80 xl:h-96 overflow-hidden">
				<Image
					src="/banner.jpg"
					alt="NCUE Banner"
					fill
					priority
					className="object-cover object-center"
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-slate-900/20" />
				<div className="absolute inset-0 flex flex-col justify-center items-center text-center text-white p-4">
					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
						className="text-4xl md:text-5xl font-bold tracking-tight text-shadow"
						style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}
					>
						彰師校外獎學金資訊平台
					</motion.h1>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="mt-4 text-lg md:text-xl max-w-3xl text-shadow-sm"
						style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.6)' }}
					>
						一站式獲取所有校外獎學金資訊，並由 AI 助教為您解惑。
					</motion.p>
				</div>
			</div>

			{/* Main Content */}
			<main className="-mt-16 md:-mt-24 relative z-10">
				<div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
					<div className="bg-white rounded-xl shadow-2xl shadow-slate-900/10">
						<AnnouncementList />
					</div>
				</div>
			</main>

			{/* Add some space at the bottom */}
			<div className="h-24"></div>
		</div>
	);
}
