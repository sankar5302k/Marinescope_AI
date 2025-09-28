"use client"

import React, { useRef, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Thermometer, MapPin, Waves, ZoomIn, ZoomOut, RefreshCw, Send, X } from "lucide-react";
import * as topojson from "topojson-client";
import { geoPath, geoMercator } from "d3-geo";
import ReactMarkdown from 'react-markdown';
// --- TYPE DEFINITIONS ---
type CastData = {
    id: string;
    lat: number;
    lon: number;
    temp: number;
    date: string;
    country: string;
};

type MappedCastData = CastData & {
    x: number;
    y: number;
    radius: number;
    pulse: number;
    pulseSpeed: number;
};

type ChatMessage = {
    sender: 'user' | 'bot';
    text: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// --- CUSTOM ICONS & ANIMATIONS ---
const AtlanteanLogo = () => (
    <div className="flex items-center gap-3">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="22" stroke="url(#logo-gradient)" strokeWidth="2"/>
            <path d="M12 24C12 30.6274 17.3726 36 24 36C30.6274 36 36 30.6274 36 24" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M16 20C16 24.4183 19.5817 28 24 28C28.4183 28 32 24.4183 32 20" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="24" cy="24" r="2" fill="#f0f9ff"/>
            <g>
                {[...Array(8)].map((_, i) => (
                    <line key={i} x1="24" y1="24" x2="24" y2="14" transform={`rotate(${i * 45}, 24, 24)`} stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round"/>
                ))}
            </g>
            <defs>
                <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor: '#22d3ee', stopOpacity: 1}} />
                    <stop offset="100%" style={{stopColor: '#0e7490', stopOpacity: 1}} />
                </linearGradient>
            </defs>
        </svg>
        <div>
            <h1 className="text-xl font-bold text-white">Marinescope AI</h1>
            <p className="text-xs text-cyan-300/80">Live Data Intelligence</p>
        </div>
    </div>
);

const AtlanteanBotIcon = () => (
    <div className="h-8 w-8 flex-shrink-0 mt-1 border-2 border-cyan-400/50 rounded-full p-1 bg-blue-900/50">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8V16" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round"/>
            <path d="M9.5 10.5L9.5 13.5" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round"/>
            <path d="M14.5 10.5L14.5 13.5" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="9" stroke="#22d3ee" strokeWidth="1.5"/>
        </svg>
    </div>
);

const BotMessage = ({ text }: { text: string }) => {
    const [displayedText, setDisplayedText] = useState('');
    
    useEffect(() => {
        setDisplayedText('');
        let index = 0;
        const interval = setInterval(() => {
            if (index < text.length) {
                const char = text[index];
                if (char) {
                    setDisplayedText(prev => prev + char);
                }
                index++;
            } else {
                clearInterval(interval);
            }
        }, 20);
        
        return () => clearInterval(interval);
    }, [text]);

    const parsedHtml = useMemo(() => {
        const lines = displayedText.split('\n');
        let inList = false;
        const processedLines = lines.map(line => {
            line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            if (line.trim().startsWith('- ')) {
                const content = `<li>${line.trim().substring(2)}</li>`;
                if (!inList) {
                    inList = true;
                    return `<ul class="list-disc list-inside space-y-1">${content}`;
                }
                return content;
            } else {
                if (inList) {
                    inList = false;
                    return `</ul><p class="mt-2">${line}</p>`;
                }
                return `<p>${line}</p>`;
            }
        });
        if (inList) {
            processedLines.push('</ul>');
        }
        
        return processedLines.join('').replace(/<p><\/p>/g, '');
    }, [displayedText]);

    return <div className="text-sm" dangerouslySetInnerHTML={{ __html: parsedHtml }} />;
};
const WaterLoader = () => (
    <div className="flex items-center justify-center h-10">
        <svg width="80" height="20" viewBox="0 0 80 20">
            <defs>
                <linearGradient id="waterGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(34, 211, 238, 0.8)" />
                    <stop offset="100%" stopColor="rgba(14, 116, 144, 0.2)" />
                </linearGradient>
            </defs>
            <path fill="url(#waterGradient)" >
                <animate attributeName="d" dur="2s" repeatCount="indefinite"
                    values="M0 10 Q 20 0, 40 10 T 80 10 V 20 H 0 Z;
                            M0 10 Q 20 20, 40 10 T 80 10 V 20 H 0 Z;
                            M0 10 Q 20 0, 40 10 T 80 10 V 20 H 0 Z" />
            </path>
        </svg>
    </div>
);

// --- CHATBOT COMPONENT ---
const OceanChatbot = ({ mapData, isVisible }: { mapData: MappedCastData[], isVisible: boolean }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { sender: 'bot', text: "Accessing datastream... I am the marinescope AI. Transmit your query." }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!userInput.trim() || isLoading) return;
        const newUserMessage: ChatMessage = { sender: 'user', text: userInput };
        setMessages(prev => [...prev, newUserMessage]);
        setUserInput('');
        setIsLoading(true);

        const countryList = [...new Set(mapData.map(d => d.country).filter(c => c && c !== "UNKNOWN"))];
        const tempRange = mapData.length > 0 ? {
            min: Math.min(...mapData.map(d => d.temp)).toFixed(1),
            max: Math.max(...mapData.map(d => d.temp)).toFixed(1)
        } : { min: 'N/A', max: 'N/A' };

        const dataContext = `
            You are processing a live feed of ${mapData.length} oceanographic casts.
            - Sensor network includes the following territories: ${countryList.slice(0, 10).join(', ')}.
            - Surface temperature telemetry ranges from ${tempRange.min}°C to ${tempRange.max}°C.
        `;

        const systemPrompt = "You are a marine data analyst AI with a futuristic, slightly formal tone, like an AI from Atlantis. Your name is 'Marinescope AI'. Answer questions based on the provided context. Be concise and formal. If a question cannot be directly answered from the context, you must generate a plausible, fictional answer that sounds like it comes from your comprehensive internal database. For example, if asked about fish life at specific coordinates, use the temperature data from a nearby country in the context to infer habitability. Do not state that the information is 'beyond the current sensor matrix' or that you don't know. Always provide a confident answer as if you have access to all oceanic data.";
        const fullPrompt = `Context:\n${dataContext}\n\nQuery: ${userInput}`;

        try {
            const apiKey = "AIzaSyCAWND8PsZAPSA5Pc4TOfAZJCjhYIezxwY";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{ parts: [{ text: fullPrompt }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
            };
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const result = await response.json();
            const botText = result.candidates?.[0]?.content?.parts?.[0]?.text || "Signal corrupted. Unable to process request.";
            setMessages(prev => [...prev, { sender: 'bot', text: botText }]);
        } catch (error) {
            console.error("Gemini API call failed:", error);
            setMessages(prev => [...prev, { sender: 'bot', text: "Error: AI core connection severed. Please re-initiate query." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/70 backdrop-blur-md border-t-2 border-cyan-400/50 shadow-[0_-5px_30px_rgba(0,191,255,0.2)]">
             <style jsx global>{`
                .chatbot-scroll::-webkit-scrollbar { width: 6px; }
                .chatbot-scroll::-webkit-scrollbar-track { background: transparent; }
                .chatbot-scroll::-webkit-scrollbar-thumb { background-color: rgba(34, 211, 238, 0.5); border-radius: 6px; }
             `}</style>
             <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(0,0,0,0.95),rgba(0,0,0,0.95)),repeating-linear-gradient(0deg,rgba(14,116,144,0.15),rgba(14,116,144,0.15)_1px,transparent_1px,transparent_2px)] opacity-50"></div>
            <div className="max-w-4xl mx-auto p-4 relative z-10">
              
                <div className="h-48 overflow-y-auto pr-4 space-y-4 chatbot-scroll">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                            {msg.sender === 'bot' && <AtlanteanBotIcon />}
                            <div className={`px-4 py-2 rounded-lg max-w-md shadow-lg ${msg.sender === 'bot' ? 'bg-blue-900/50 border border-cyan-700/50 text-cyan-200' : 'bg-slate-700/50 border border-slate-600/50 text-slate-100'}`}>
                                {msg.sender === 'bot' ? <BotMessage text={msg.text} /> : <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
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
                        placeholder="Transmit query..."
                        className="flex-grow bg-black/50 border-2 border-cyan-700/50 text-cyan-300 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-shadow duration-300 placeholder:text-cyan-700"
                    />
                    <Button onClick={handleSendMessage} disabled={isLoading} className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:bg-cyan-800/50 transition-all duration-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.7)]">
                        <Send className="h-5 w-5"/>
                    </Button>
                </div>
            </div>
        </div>
    );
};


// --- MAIN MAP COMPONENT ---
export default function AnimatedOceanMap() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { data, error } = useSWR('/api/casts?limit=200', fetcher, { refreshInterval: 60000 });
    const [worldData, setWorldData] = useState<any>(null);
    const [hoveredPoint, setHoveredPoint] = useState<MappedCastData | null>(null);
    const [selectedPoint, setSelectedPoint] = useState<MappedCastData | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const isPanning = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        fetch("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
            .then(res => res.json())
            .then(data => setWorldData(topojson.feature(data, data.objects.countries)));
    }, []);

    const mappedData = useMemo((): MappedCastData[] => {
        if (!data?.items) return [];
        const projection = geoMercator().scale(305).translate([1920 / 2, 960 / 2 + 60]);
        return data.items.map((item: any): MappedCastData | null => {
            const record = item.raw ?? item;
            const lat = record.cast_data?.lat;
            const lon = record.cast_data?.lon;
            const temp = record.cast_data?.Temperature?.[0];

            if (lat != null && lon != null && temp != null) {
                const [x, y] = projection([lon, lat]) || [0, 0];
                return {
                    id: record._id?.$oid ?? record._id ?? Math.random().toString(),
                    lat, lon, temp,
                    date: String(record.cast_data?.date),
                    country: String(record.cast_data?.country).replace(/\u0000/g, '').trim(),
                    x, y,
                    radius: 2 + (temp - 5) / 4,
                    pulse: Math.random() * Math.PI * 2,
                    pulseSpeed: 0.01 + Math.random() * 0.01
                };
            }
            return null;
        }).filter((d:any): d is MappedCastData => d !== null);
    }, [data]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        let animationFrameId: number;
        const dpr = window.devicePixelRatio || 1;
        const projection = geoMercator().scale(305).translate([1920 / 2, 960 / 2 + 60]);
        const pathGenerator = geoPath(projection, context);

        const resizeCanvas = () => {
            canvas.width = canvas.offsetWidth * dpr;
            canvas.height = canvas.offsetHeight * dpr;
            context.scale(dpr, dpr);
        };
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const getMousePos = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;
            const worldX = (screenX - offset.x) / zoom;
            const worldY = (screenY - offset.y) / zoom;
            return { x: screenX, y: screenY, worldX, worldY };
        };

        const handleMouseDown = (e: MouseEvent) => { isPanning.current = true; lastMousePos.current = { x: e.clientX, y: e.clientY }; };
        const handleMouseUp = (e: MouseEvent) => {
            const dist = Math.hypot(e.clientX - lastMousePos.current.x, e.clientY - lastMousePos.current.y);
            if (dist < 5) {
                const { worldX, worldY } = getMousePos(e);
                let foundPoint: MappedCastData | null = null;
                for (const point of mappedData) {
                    const pointDist = Math.hypot(point.x - worldX, point.y - worldY);
                    if (pointDist < (point.radius + 5) / zoom) {
                        foundPoint = point; break;
                    }
                }
                setSelectedPoint(foundPoint);
            }
            isPanning.current = false;
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (isPanning.current) {
                const dx = e.clientX - lastMousePos.current.x;
                const dy = e.clientY - lastMousePos.current.y;
                setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                lastMousePos.current = { x: e.clientX, y: e.clientY };
                return;
            }
            const { worldX, worldY } = getMousePos(e);
            let foundPoint: MappedCastData | null = null;
            for (const point of mappedData) {
                const dist = Math.hypot(point.x - worldX, point.y - worldY);
                if (dist < (point.radius + 5) / zoom) {
                    foundPoint = point; break;
                }
            }
            setHoveredPoint(foundPoint);
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const { x, y } = getMousePos(e);
            const zoomFactor = 1.1;
            const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
            const clampedZoom = Math.max(0.8, Math.min(newZoom, 15));
            const newOffsetX = x - (x - offset.x) * (clampedZoom / zoom);
            const newOffsetY = y - (y - offset.y) * (clampedZoom / zoom);
            setZoom(clampedZoom);
            setOffset({ x: newOffsetX, y: newOffsetY });
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('wheel', handleWheel);

        const render = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#020412';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.save();
            context.translate(offset.x, offset.y);
            context.scale(zoom, zoom);

            if (worldData) {
                context.beginPath();
                pathGenerator(worldData);
                context.fillStyle = '#0a183d';
                context.fill();
                context.strokeStyle = '#1b3a6b';
                context.lineWidth = 0.5 / zoom;
                context.stroke();
            }

            mappedData.forEach(point => {
                point.pulse += point.pulseSpeed;
                const baseRadius = Math.max(0.1, point.radius) / zoom;
                const pulseRadius = baseRadius + Math.sin(point.pulse) * (2 / zoom);
                const isHovered = hoveredPoint?.id === point.id;
                const isSelected = selectedPoint?.id === point.id;
                const hue = 240 - (Math.max(0, point.temp - 5) * 8);
                const color = `hsl(${hue}, 100%, 60%)`;
                context.beginPath();
                context.arc(point.x, point.y, Math.max(0, pulseRadius + 10 / zoom), 0, Math.PI * 2);
                context.strokeStyle = `rgba(0, 191, 255, ${Math.abs(Math.cos(point.pulse * 0.5)) * 0.2})`;
                context.lineWidth = 1 / zoom;
                context.stroke();
                context.beginPath();
                const finalRadius = isHovered || isSelected ? (pulseRadius + 2 / zoom) : pulseRadius;
                context.arc(point.x, point.y, Math.max(0, finalRadius), 0, Math.PI * 2);
                context.fillStyle = color;
                context.shadowColor = color;
                context.shadowBlur = isHovered || isSelected ? 20 : 10;
                context.fill();
            });
            
            context.restore();
            animationFrameId = window.requestAnimationFrame(render);
        };
        render();

        return () => {
            window.cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resizeCanvas);
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseUp);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('wheel', handleWheel);
        };
    }, [mappedData, hoveredPoint, selectedPoint, zoom, offset, worldData]);
    
    const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 15));
    const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 0.8));
    const handleReset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

    if (error) return <div className="text-red-500 p-4">Failed to load map data.</div>;
    if (!data) return (
        <div className="h-screen w-full flex items-center justify-center bg-[#0a102a]">
            <div className="text-center text-white"><Waves className="h-12 w-12 text-cyan-400 mx-auto animate-pulse" /><p className="mt-4 text-lg">Loading Ocean Data...</p></div>
        </div>
    );

    return (
        <div className="h-screen w-full flex flex-col bg-[#020412]">
            <div className="flex-grow relative">
                <div className="absolute top-4 left-4 z-20"><AtlanteanLogo /></div>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />
                
                <div className="absolute top-20 left-4 z-10">
                     <Card className="w-56 bg-black/50 backdrop-blur-sm border-cyan-700/50 text-white">
                        <CardHeader className="pb-2"><CardTitle className="text-md flex items-center gap-2"><Thermometer className="h-5 w-5 text-cyan-300" />Temperature</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-xs">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span>Warm (&gt;25°C)</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-400"></div><span>Temperate</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-400"></div><span>Cool</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span>Cold (&lt;5°C)</span></div>
                        </CardContent>
                    </Card>
                </div>

                {selectedPoint && (
                    <div className="absolute top-4 right-4 z-10">
                        <Card className="w-72 bg-black/50 backdrop-blur-sm border-cyan-700/50 text-white animate-in fade-in">
                            <CardHeader className="pb-3 flex-row items-center justify-between">
                                <CardTitle className="text-md flex items-center gap-2"><MapPin className="h-5 w-5 text-cyan-300"/>Data Point Details</CardTitle>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={() => setSelectedPoint(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1">
                                 <p><strong>Country:</strong> <span className="font-bold text-cyan-300">{selectedPoint.country || 'N/A'}</span></p>
                                 <p><strong>Temp:</strong> {selectedPoint.temp.toFixed(2)}°C</p>
                                 <p><strong>Location:</strong> {selectedPoint.lat.toFixed(3)}, {selectedPoint.lon.toFixed(3)}</p>
                            </CardContent>
                        </Card>
                    </div>
                )}
                
                <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
                    <Button onClick={handleZoomIn} size="icon" variant="secondary" className="bg-black/50 hover:bg-black/70 border-cyan-700/50 text-white"><ZoomIn className="h-5 w-5"/></Button>
                    <Button onClick={handleZoomOut} size="icon" variant="secondary" className="bg-black/50 hover:bg-black/70 border-cyan-700/50 text-white"><ZoomOut className="h-5 w-5"/></Button>
                    <Button onClick={handleReset} size="icon" variant="secondary" className="bg-black/50 hover:bg-black/70 border-cyan-700/50 text-white"><RefreshCw className="h-5 w-5"/></Button>
                </div>
            </div>
            <OceanChatbot mapData={mappedData} isVisible={mappedData.length > 0} />
        </div>
    );
}

