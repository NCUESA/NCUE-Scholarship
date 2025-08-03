"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Search, X, ChevronsUpDown, ArrowUp, ArrowDown, Link as LinkIcon, Paperclip, Loader2, Calendar, Users, Shield, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper Functions ---
const categoryStyles = {
    A: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    B: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    C: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    D: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    E: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    default: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
};
const getCategoryStyle = (cat) => categoryStyles[cat] || categoryStyles.default;

const calculateSemester = (deadlineStr) => {
    if (!deadlineStr) return 'N/A';
    const deadline = new Date(deadlineStr);
    const year = deadline.getFullYear();
    const month = deadline.getMonth() + 1;
    const academicYear = year - 1911 - (month < 8 ? 1 : 0);
    const semester = (month >= 8 || month === 1) ? 1 : 2;
    return `${academicYear}-${semester}`;
};

const FilterButton = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500
        ${active
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
    >
        {children}
    </button>
);

// --- Main Component ---
export default function AnnouncementList() {
    const searchParams = useSearchParams();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortLoading, setSortLoading] = useState(false);
    const [filter, setFilter] = useState('open');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [sort, setSort] = useState({ column: 'application_deadline', ascending: true });
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const announcementRefs = useRef({});

    const fetchAnnouncements = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) setLoading(true);
        else setSortLoading(true);

        let query = supabase.from('announcements').select('*, attachments(*)', { count: 'exact' });
        if (search) query = query.or(`title.ilike.%${search}%,target_audience.ilike.%${search}%,application_limitations.ilike.%${search}%`);

        const today = new Date().toISOString().slice(0, 10);
        if (filter === 'open') query = query.gte('application_deadline', today);
        else if (filter === 'expired') query = query.lt('application_deadline', today);

        const orderColumn = sort.column === 'semester' ? 'application_deadline' : sort.column;
        query = query.order(orderColumn, { ascending: sort.ascending });

        const from = (page - 1) * rowsPerPage;
        const to = from + rowsPerPage - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (!error) {
            const dataWithSemester = (data || []).map(item => ({ ...item, semester: calculateSemester(item.application_deadline) }));
            setAnnouncements(dataWithSemester);
            setTotalCount(count || 0);
        } else console.error("Error fetching announcements:", error);

        if (isInitialLoad) setLoading(false);
        else setSortLoading(false);
    }, [search, filter, page, rowsPerPage, sort]);

    useEffect(() => { fetchAnnouncements(announcements.length === 0); }, [fetchAnnouncements]);

    useEffect(() => {
        const announcementId = searchParams.get('announcement_id');
        if (announcementId && announcements.length > 0) {
            const target = announcements.find(a => a.id.toString() === announcementId);
            if (target) {
                setSelectedAnnouncement(target);
                setTimeout(() => announcementRefs.current[target.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
            }
        }
    }, [searchParams, announcements]);

    const handleSort = (field) => {
        setSort(current => ({ column: field, ascending: current.column === field ? !current.ascending : true }));
        setPage(1);
    };

    const renderSortIcon = (column) => {
        if (sort.column !== column) return <ChevronsUpDown className="h-4 w-4 ml-2 text-gray-400" />;
        return sort.ascending ? <ArrowUp className="h-4 w-4 ml-2 text-indigo-500" /> : <ArrowDown className="h-4 w-4 ml-2 text-indigo-500" />;
    };

    const LoadingSpinner = () => <div className="p-10 flex justify-center items-center gap-3 text-gray-500"><Loader2 className="animate-spin h-6 w-6" /><span>載入中...</span></div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 font-sans">
            <div className="bg-slate-100/80 border border-slate-200/80 rounded-xl p-6 mb-8">
                <h2 className="text-xl font-bold text-slate-800 mb-4">獎助學金代碼定義</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4 text-slate-700">
                    <p><strong className="font-bold text-red-600">A:</strong> 各縣市政府</p>
                    <p><strong className="font-bold text-orange-600">B:</strong> 各級公家機關</p>
                    <p><strong className="font-bold text-blue-600">C:</strong> 宗教及民間團體</p>
                    <p><strong className="font-bold text-emerald-600">D:</strong> 其他民間單位</p>
                    <p><strong className="font-bold text-green-600">E:</strong> 得獎名單</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div className="relative w-full md:max-w-md">
                    <Search className="h-5 w-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="搜尋標題、對象、限制條件..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 text-gray-800 bg-white border-2 border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full">
                    <FilterButton active={filter === 'open'} onClick={() => setFilter('open')}>開放申請</FilterButton>
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>全部公告</FilterButton>
                    <FilterButton active={filter === 'expired'} onClick={() => setFilter('expired')}>已過期</FilterButton>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg overflow-hidden relative">
                {sortLoading && <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center backdrop-blur-sm"><div className="flex items-center gap-2 text-slate-600"><Loader2 className="animate-spin h-5 w-5 text-indigo-600" /><span>更新中...</span></div></div>}

                {/* Desktop Table */}
                <div className="hidden md:block">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                {['semester', '獎助學金資料', '適用對象', '兼領限制', 'application_deadline'].map(col => (
                                    <th key={col} className="px-6 py-4 text-left font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort(col)}>
                                        <div className="flex items-center">
                                            {col === 'semester' ? '學期' : col === 'application_deadline' ? '申請期限' : col.replace('_', ' ')}
                                            {renderSortIcon(col)}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? <tr><td colSpan="5"><LoadingSpinner /></td></tr> : announcements.map(item => (
                                <motion.tr key={item.id} ref={el => announcementRefs.current[item.id] = el} onClick={() => setSelectedAnnouncement(item)}
                                    className="cursor-pointer"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    whileHover={{ scale: 1.01, zIndex: 10, y: -2, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                                    transition={{ duration: 0.2 }}>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">{item.semester}</td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <div className="flex items-center gap-3">
                                            <span className={`flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg font-bold text-sm ${getCategoryStyle(item.category).bg} ${getCategoryStyle(item.category).text}`}>{item.category}</span>
                                            <span className="font-semibold text-slate-900 truncate" title={item.title}>{item.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={item.target_audience}><span dangerouslySetInnerHTML={{ __html: item.target_audience }} /></td>
                                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{item.application_limitations || '無'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className={`font-bold ${new Date(item.application_deadline) < new Date() ? 'text-gray-400' : 'text-red-600'}`}>{item.application_deadline ? new Date(item.application_deadline).toLocaleDateString('en-CA') : '-'}</div>
                                        <div className="text-slate-500">{item.submission_method}</div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card List */}
                <div className="md:hidden">
                    {loading ? <LoadingSpinner /> : (
                        <div className="divide-y divide-slate-100">
                            {announcements.map(item => (
                                <motion.div key={item.id} ref={el => announcementRefs.current[item.id] = el} onClick={() => setSelectedAnnouncement(item)}
                                    className="p-4 cursor-pointer"
                                    whileHover={{ scale: 1.02, backgroundColor: '#f8fafc' }}>
                                    <div className="flex items-start justify-between gap-4">
                                        <span className={`flex-shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-lg font-bold text-lg ${getCategoryStyle(item.category).bg} ${getCategoryStyle(item.category).text}`}>{item.category}</span>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-base text-slate-800 line-clamp-2">{item.title}</h3>
                                            <p className={`mt-1 text-sm font-semibold ${new Date(item.application_deadline) < new Date() ? 'text-gray-400' : 'text-red-600'}`}>{item.application_deadline ? new Date(item.application_deadline).toLocaleDateString('en-CA') : '-'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 pl-14 text-xs space-y-2 text-slate-600">
                                        <p className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400"/> <span className="truncate" dangerouslySetInnerHTML={{ __html: item.target_audience }} /></p>
                                        <p className="flex items-center gap-2"><Shield className="h-4 w-4 text-slate-400"/> <span>{item.application_limitations || '無限制'}</span></p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
                {announcements.length === 0 && !loading && <div className="p-10 text-center text-gray-400">無符合條件的公告。</div>}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                <div className="text-sm text-gray-600">共 <span className="font-semibold">{totalCount}</span> 筆資料，目前在第 <span className="font-semibold">{page}</span> 頁</div>
                <div className="flex items-center gap-2">
                    <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }} className="px-2 py-2 border-2 border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {[10, 25, 50].map(v => <option key={v} value={v}>{v} 筆 / 頁</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-2 bg-white border-2 border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"><span className="sr-only">上一頁</span>&lt;</button>
                        <button onClick={() => setPage(p => p + 1)} disabled={page * rowsPerPage >= totalCount} className="px-3 py-2 bg-white border-2 border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"><span className="sr-only">下一頁</span>&gt;</button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {selectedAnnouncement && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={() => setSelectedAnnouncement(null)}>
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="sticky top-0 bg-white/80 backdrop-blur-lg border-b p-5 flex justify-between items-center z-10 rounded-t-xl">
                                <h2 className="text-xl font-bold text-gray-800">{selectedAnnouncement.title}</h2>
                                <button onClick={() => setSelectedAnnouncement(null)} className="text-gray-400 hover:text-gray-800 transition-colors rounded-full p-1 hover:bg-gray-200"><X /></button>
                            </div>
                            <div className="p-6 space-y-6 overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                        <Calendar className="h-5 w-5 text-indigo-500 mt-0.5"/>
                                        <div><strong className="text-slate-700">申請期限</strong><p className="text-red-600 font-semibold">{selectedAnnouncement.application_deadline}</p></div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                                        <FileText className="h-5 w-5 text-indigo-500 mt-0.5"/>
                                        <div><strong className="text-slate-700">送件方式</strong><p className="text-slate-800">{selectedAnnouncement.submission_method}</p></div>
                                    </div>
                                </div>
                                {selectedAnnouncement.summary && (
                                    <div>
                                        <h3 className="font-semibold text-lg mb-2 text-indigo-700 border-l-4 border-indigo-500 pl-3">公告摘要</h3>
                                        <p className="text-gray-700 prose max-w-none">{selectedAnnouncement.summary}</p>
                                    </div>
                                )}
                                <div>
                                    <h3 className="font-semibold text-lg mb-2 text-indigo-700 border-l-4 border-indigo-500 pl-3">詳細內容</h3>
                                    <div className="prose max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: selectedAnnouncement.full_content || selectedAnnouncement.summary || '無詳細內容' }} />
                                </div>
                                {selectedAnnouncement.attachments?.length > 0 && (
                                    <div>
                                        <h3 className="font-semibold text-lg mb-2 text-indigo-700 border-l-4 border-indigo-500 pl-3">相關附件</h3>
                                        <div className="space-y-2">
                                            {selectedAnnouncement.attachments.map(att => (
                                                <a key={att.id} href={att.public_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-indigo-50 hover:bg-indigo-100 p-3 rounded-lg text-indigo-800 font-medium transition-colors group">
                                                    <Paperclip className="h-5 w-5 flex-shrink-0 text-indigo-500 group-hover:text-indigo-700" />
                                                    <span className="truncate">{att.file_name}</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {selectedAnnouncement.external_urls && (
                                    <div>
                                        <h3 className="font-semibold text-lg mb-2 text-indigo-700 border-l-4 border-indigo-500 pl-3">外部連結</h3>
                                        <a href={selectedAnnouncement.external_urls} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-blue-600 hover:underline">
                                            <LinkIcon className="h-4 w-4" />
                                            <span>{selectedAnnouncement.external_urls}</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
