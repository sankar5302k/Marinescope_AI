"use client";

import useSWR from "swr";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Download, Search, ChevronLeft, ChevronRight, AlertTriangle, Send, Bot } from "lucide-react";
import MarineScopeLogo from "./MarineScopeLogo";
import { Button } from "@/components/ui/button";
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// --- SWR Fetcher ---
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// --- Helper Functions ---
function cleanString(str: any): string {
  if (typeof str !== 'string') return '-';
  const cleaned = str.replace(/\u0000/g, '').trim();
  return cleaned || '-';
}

// --- Type Definitions ---
type CastRecord = Record<string, any>;
type RowData = {
  id: string; type: string; country: string; recorder: string; dataset: string;
  latitude?: number; longitude?: number; date: string; numDepths?: number;
  surfaceTemp?: number; raw: CastRecord;
};
type ChatMessage = {
  sender: 'user' | 'bot';
  text: string;
};

const DEFAULT_LIMIT = 10;


// --- Themed UI Elements for the Chatbot ---
const AtlanteanBotIcon = () => (
    <div className="h-8 w-8 flex-shrink-0 mt-1 border-2 border-cyan-400/50 rounded-full p-1 bg-blue-900/50">
      <Bot className="h-full w-full text-cyan-400" />
    </div>
);
  
const WaterLoader = () => (
    <div className="flex items-center justify-center h-10 w-20">
      <svg width="80" height="20" viewBox="0 0 80 20">
        <defs>
          <linearGradient id="waterGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.8)" />
            <stop offset="100%" stopColor="rgba(14, 116, 144, 0.2)" />
          </linearGradient>
        </defs>
        <path fill="url(#waterGradient)">
          <animate attributeName="d" dur="2s" repeatCount="indefinite"
            values="M0 10 Q 20 0, 40 10 T 80 10 V 20 H 0 Z;
                    M0 10 Q 20 20, 40 10 T 80 10 V 20 H 0 Z;
                    M0 10 Q 20 0, 40 10 T 80 10 V 20 H 0 Z" />
        </path>
      </svg>
    </div>
);

// --- Main Integrated Component ---
export default function CastRecordsPanel() {
  // --- State for Table and Pagination ---
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // --- State for Chatbot ---
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'bot', text: "Greetings. I am the Marinescope AI. Ask me anything about the data currently displayed in the table above." }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Debounce Search Input ---
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // --- Scroll Chat to Bottom ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Data Fetching with SWR ---
  const apiUrl = `/api/casts?limit=${DEFAULT_LIMIT}&page=${page}${debouncedSearchQuery ? `&search=${debouncedSearchQuery}` : ''}`;
  const { data, error, isLoading } = useSWR(apiUrl, fetcher, {
    refreshInterval: 10000,
  });

  // --- Memoized Data Processing for Table ---
  const rows: RowData[] = useMemo(() => {
    if (!data?.items) return [];
    return (data.items as CastRecord[]).map((d: CastRecord) => {
      const raw = d.raw ?? d;
      const id = String(d.id ?? raw._id?.$oid ?? raw._id ?? "");
      const castData = raw.cast_data || {};
      const dateString = String(castData.date || '');
      let formattedDate = '-';
      if (dateString.length === 8) {
        formattedDate = `${dateString.substring(0, 4)}-${dateString.substring(4, 6)}-${dateString.substring(6, 8)}`;
      }
      const surfaceTemp = Array.isArray(castData.Temperature) && castData.Temperature.length > 0 ? castData.Temperature[0] : undefined;
      return { id, type: cleanString(raw.type), country: cleanString(castData.country), recorder: cleanString(castData.Recorder), dataset: cleanString(castData.dataset), latitude: castData.lat, longitude: castData.lon, date: formattedDate, numDepths: castData.z_row_size, surfaceTemp, raw: raw };
    });
  }, [data]);

  // --- Pagination Logic ---
  const totalItems = data?.filteredCount ?? 0;
  const totalPages = Math.ceil(totalItems / DEFAULT_LIMIT);
  const startItem = totalItems > 0 ? (page - 1) * DEFAULT_LIMIT + 1 : 0;
  const endItem = Math.min(page * DEFAULT_LIMIT, totalItems);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  // --- Download Handler ---
  const handleDownload = useCallback((record: CastRecord, id: string) => {
    if (!record) return;
    const jsonString = JSON.stringify(record, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cast_record_${id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // --- Chatbot Message Handler ---
  const handleSendMessage = async () => {
    if (!userInput.trim() || isChatLoading || !data?.items) return;

    const newUserMessage: ChatMessage = { sender: 'user', text: userInput };
    setMessages(prev => [...prev, newUserMessage]);
    setUserInput('');
    setIsChatLoading(true);

    const castData: CastRecord[] = data.items;
    const countryList = [...new Set(castData.map(d => cleanString(d.raw?.cast_data?.country)).filter(c => c && c !== "UNKNOWN" && c !== '-'))];
    const tempValues = castData.map(d => d.raw?.cast_data?.Temperature?.[0]).filter(t => t != null);
    const tempRange = tempValues.length > 0 ? { min: Math.min(...tempValues).toFixed(1), max: Math.max(...tempValues).toFixed(1) } : { min: 'N/A', max: 'N/A' };

    const dataContext = `
      You are processing a live feed of ${castData.length} oceanographic cast records.
      - The sensor network includes data from: ${countryList.slice(0, 10).join(', ')}.
      - Current surface temperature telemetry ranges from ${tempRange.min}°C to ${tempRange.max}°C.
    `;
    const systemPrompt = "You are a marine data analyst AI with a futuristic, slightly formal tone, like an AI from Atlantis. Your name is 'Marinescope AI'. Answer questions based on the provided context. Be concise and formal. If a question cannot be directly answered from the context, you must generate a plausible, fictional answer that sounds like it comes from your comprehensive internal database. For example, if asked about fish life at specific coordinates, use the temperature data from a nearby country in the context to infer habitability. Do not state that the information is 'beyond the current sensor matrix' or that you don't know. Always provide a confident answer as if you have access to all oceanic data.";
    const fullPrompt = `Context:\n${dataContext}\n\nQuery: ${userInput}`;

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API key not configured.");
      
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      };

      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
      
      const result = await response.json();
      const botText = result.candidates?.[0]?.content?.parts?.[0]?.text || "Signal corrupted.";
      setMessages(prev => [...prev, { sender: 'bot', text: botText }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      setMessages(prev => [...prev, { sender: 'bot', text: `**Error:** AI core connection severed. Details: ${errorMessage}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };


  // --- Render Functions ---
  const renderDataDisplay = () => {
    if (error) return <div className="p-6 text-red-400 bg-red-900/30 rounded-lg m-4 flex items-center justify-center gap-3"><AlertTriangle className="h-6 w-6"/><span>Failed to load live records. Retrying...</span></div>;
    if (isLoading && rows.length === 0) return <div className="p-6 flex flex-col items-center justify-center h-64 text-cyan-200"><MarineScopeLogo className="h-12 w-12 animate-pulse mb-4"/><span className="tracking-widest">ACCESSING DATASTREAMS...</span></div>;
    if (rows.length === 0) return <div className="p-6 text-center text-blue-300/70 h-64 flex items-center justify-center">{debouncedSearchQuery ? `No records found matching query: "${debouncedSearchQuery}"` : "No records found."}</div>;

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm table-auto">
          <thead className="border-b border-cyan-800/60">
            <tr className="text-left text-cyan-300 uppercase tracking-wider text-xs">
              <th className="px-4 py-3 font-semibold w-1/4">ID</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Location (Lat/Lon)</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold text-center">Depths</th>
              <th className="px-4 py-3 font-semibold text-right">Surface Temp (°C)</th>
              <th className="px-4 py-3 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cyan-900/50">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-cyan-900/20 transition-colors duration-150 ease-in-out">
                <td className="px-4 py-3 font-mono text-xs text-blue-200/80 max-w-xs truncate" title={r.id}>{r.id}</td>
                <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-900/70 text-cyan-200 border border-cyan-700/50">{r.type}</span></td>
                <td className="px-4 py-3 text-blue-200 text-sm">{r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(3)} / ${r.longitude.toFixed(3)}` : '—'}</td>
                <td className="px-4 py-3 text-blue-300/80 whitespace-nowrap">{r.date}</td>
                <td className="px-4 py-3 text-center font-medium text-blue-200">{r.numDepths ?? '—'}</td>
                <td className="px-4 py-3 text-right font-bold text-lg text-cyan-300 whitespace-nowrap">{r.surfaceTemp != null ? r.surfaceTemp.toFixed(2) : '—'}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleDownload(r.raw, r.id)} className="px-3 py-1 text-xs font-medium text-cyan-100 bg-cyan-800/50 rounded-md border border-cyan-700 hover:bg-cyan-700/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition-all duration-150 flex items-center gap-1 mx-auto"><Download size={14} /> JSON</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pageButtons = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    for (let i = start; i <= end; i++) {
      pageButtons.push(<button key={i} onClick={() => handlePageChange(i)} disabled={i === page} className={`px-4 py-2 mx-1 rounded-lg transition-colors duration-150 text-sm ${i === page ? 'bg-cyan-500 text-white shadow-[0_0_10px_rgba(0,255,255,0.4)]' : 'bg-cyan-900/50 text-cyan-200 hover:bg-cyan-800/70 border border-cyan-800/50'}`}>{i}</button>);
    }
    
    if (start > 1) pageButtons.unshift(<span key="start-dots" className="px-2 py-2 text-cyan-400/70">...</span>);
    if (end < totalPages) pageButtons.push(<span key="end-dots" className="px-2 py-2 text-cyan-400/70">...</span>);

    return (
      <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-cyan-800/60">
        <div className="text-sm text-blue-300/70 mb-3 sm:mb-0">Showing {startItem} to {endItem} of {totalItems} records</div>
        <div className="flex items-center">
          <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="px-3 py-2 mx-1 rounded-lg bg-cyan-900/50 text-cyan-200 hover:bg-cyan-800/70 border border-cyan-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-1"><ChevronLeft size={16}/> Prev</button>
          {pageButtons}
          <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} className="px-3 py-2 mx-1 rounded-lg bg-cyan-900/50 text-cyan-200 hover:bg-cyan-800/70 border border-cyan-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-1">Next <ChevronRight size={16}/></button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* --- Table Section --- */}
      <div className="w-full bg-[#0A102A]/80 border border-cyan-800/60 shadow-[0_0_15px_rgba(0,255,255,0.1)] rounded-lg overflow-hidden">
        <div className="relative p-4 sm:p-6 border-b border-cyan-800/60">
          <Search className="absolute left-8 sm:left-10 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400/60" />
          <input
            type="text"
            placeholder="Search by Country, Recorder, or Dataset..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-cyan-700/50 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-[#020412] text-white placeholder-blue-300/50"
          />
        </div>
        {renderDataDisplay()}
        {renderPagination()}
      </div>

      {/* --- Chatbot Section --- */}
      {data?.items && data.items.length > 0 && (
          <Card className="bg-[#0A102A]/80 border-cyan-800/60 shadow-[0_0_15px_rgba(0,255,255,0.1)]">
            <CardHeader>
                <CardTitle className="text-xl font-semibold text-cyan-200 tracking-wide flex items-center gap-2">
                    <Bot size={24} /> AI Data Analyst
                </CardTitle>
            </CardHeader>
            <style jsx global>{`
              .chatbot-scroll::-webkit-scrollbar { width: 6px; }
              .chatbot-scroll::-webkit-scrollbar-track { background: transparent; }
              .chatbot-scroll::-webkit-scrollbar-thumb { background-color: rgba(34, 211, 238, 0.5); border-radius: 6px; }
            `}</style>
            <CardContent className="p-4 pt-0">
              <div className="h-64 overflow-y-auto pr-4 space-y-4 chatbot-scroll border border-cyan-900/50 rounded-lg p-3 bg-black/20">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                    {msg.sender === 'bot' && <AtlanteanBotIcon />}
                    <div className={`px-4 py-2 rounded-lg max-w-md shadow-lg prose prose-invert prose-sm ${msg.sender === 'bot' ? 'bg-blue-900/50 border border-cyan-700/50 text-cyan-200' : 'bg-slate-700/50 border border-slate-600/50 text-slate-100'}`}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-start gap-3">
                    <AtlanteanBotIcon />
                    <div className="px-4 py-2 rounded-lg bg-blue-900/50 border border-cyan-700/50 text-cyan-200">
                      <WaterLoader />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Transmit query about the data above..."
                  className="flex-grow bg-black/50 border-2 border-cyan-700/50 text-cyan-300 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-shadow duration-300 placeholder:text-cyan-700"
                />
                <Button onClick={handleSendMessage} disabled={isChatLoading} className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:bg-cyan-800/50 transition-all duration-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.7)]">
                  <Send className="h-5 w-5"/>
                </Button>
              </div>
            </CardContent>
          </Card>
      )}
    </div>
  );
}