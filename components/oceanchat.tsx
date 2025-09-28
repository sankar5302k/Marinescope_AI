"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Send, Bot } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { Card, CardContent } from './ui/card';

// --- Type Definitions ---
type ChatMessage = {
  sender: 'user' | 'bot';
  text: string;
};

type CastRecord = Record<string, any>;

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

// --- Main Chatbot Component ---
export default function OceanChatbot({ castData }: { castData: CastRecord[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'bot', text: "Greetings. I am the Marinescope AI. How may I assist with your oceanic data queries?" }
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

    const cleanString = (str: any): string => (typeof str === 'string' ? str.replace(/\u0000/g, '').trim() : '');
    const countryList = [...new Set(castData.map(d => cleanString(d.raw?.cast_data?.country)).filter(c => c && c !== "UNKNOWN" && c !== '-'))];
    const tempValues = castData.map(d => d.raw?.cast_data?.Temperature?.[0]).filter(t => t != null);
    const tempRange = tempValues.length > 0 ? {
        min: Math.min(...tempValues).toFixed(1),
        max: Math.max(...tempValues).toFixed(1)
    } : { min: 'N/A', max: 'N/A' };

    const dataContext = `
      You are processing a live feed of ${castData.length} oceanographic cast records.
      - The sensor network includes data from: ${countryList.slice(0, 10).join(', ')}.
      - Current surface temperature telemetry ranges from ${tempRange.min}°C to ${tempRange.max}°C.
    `;
    const systemPrompt = "You are a marine data analyst AI named 'Marinescope AI'. Answer questions based *only* on the provided real-time data context. Be concise and formal. If a question cannot be answered, state 'The requested information is beyond the scope of the current sensor data.'";
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
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-[#0A102A]/80 border-cyan-800/60 shadow-[0_0_15px_rgba(0,255,255,0.1)]">
      <style jsx global>{`
        .chatbot-scroll::-webkit-scrollbar { width: 6px; }
        .chatbot-scroll::-webkit-scrollbar-track { background: transparent; }
        .chatbot-scroll::-webkit-scrollbar-thumb { background-color: rgba(34, 211, 238, 0.5); border-radius: 6px; }
      `}</style>
      <CardContent className="p-4">
        <div className="h-64 overflow-y-auto pr-4 space-y-4 chatbot-scroll">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {msg.sender === 'bot' && <AtlanteanBotIcon />}
              <div className={`px-4 py-2 rounded-lg max-w-md shadow-lg ${msg.sender === 'bot' ? 'bg-blue-900/50 border border-cyan-700/50 text-cyan-200' : 'bg-slate-700/50 border border-slate-600/50 text-slate-100'}`}>
                <ReactMarkdown >{msg.text}</ReactMarkdown>
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
      </CardContent>
    </Card>
  );
}