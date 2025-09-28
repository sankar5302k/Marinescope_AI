"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrainCircuit } from 'lucide-react';

// --- Reusable Types ---
type CardData = {
  id: number;
  fact: string;
};

// ============================================================================
// --- Ocean Wave Loader Component ---
// ============================================================================
const WaveLoader = () => (
  <div className="flex flex-col justify-center items-center h-64 text-center">
    <div className="wave-container">
      <div className="wave"></div>
      <div className="wave"></div>
      <div className="wave"></div>
    </div>
    <p className="mt-4 text-cyan-200 tracking-widest text-lg">GENERATING AI INSIGHTS...</p>
  </div>
);

// ============================================================================
// --- STACK COMPONENT ---
// Themed with the "wave-like" transition animation.
// ============================================================================
type StackProps = {
  cardsData: CardData[];
  title: string;
};

const Stack: React.FC<StackProps> = ({ cardsData, title }) => {
  const [stackOrder, setStackOrder] = useState<number[]>([]);
  const initialRotations = useRef<number[]>([]);

  useEffect(() => {
    // Initialize stack in a natural order and assign random rotations
    const order = cardsData.map((_, i) => i);
    setStackOrder(order);
    initialRotations.current = cardsData.map(() => (Math.random() - 0.5) * 8); // Slightly less aggressive rotation
  }, [cardsData]);

  const handleClick = useCallback((clickedIndex: number) => {
    // Only allow clicking the actual top card to cycle it
    if (stackOrder[0] !== clickedIndex) return;

    setStackOrder(currentStack => {
      // Find the card that was at the top
      const topCard = currentStack[0];
      // Move it to the back of the stack
      const newStack = [...currentStack.slice(1), topCard];
      return newStack;
    });
  }, [stackOrder]);

  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-lg font-bold text-blue-300">{title}</h3>
      <div className="relative w-[280px] h-[300px] sm:w-[300px] sm:h-[320px]">
        {cardsData.map((card, index) => {
          const stackPosition = stackOrder.indexOf(index);
          const isTopCard = stackPosition === 0;
          
          // These values control the "wave" effect when cards move back
          const offsetBaseX = 10; // How much cards shift horizontally when not on top
          const offsetBaseY = 8;  // How much cards shift vertically
          const scaleFactor = 0.05; // How much cards shrink
          const blurFactor = 1.5; // How much cards blur
          const rotationFactor = 5; // How much secondary cards rotate

          // Determine the transform for each card based on its position in the current stackOrder
          let transformStyle = '';
          let opacityStyle = 1;
          let filterStyle = 'none';
          let cursorStyle = 'default';
          let transitionStyle = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'; // Smooth, wave-like ease-in-out

          if (isTopCard) {
            transformStyle = `translate3d(0, 0, 0) rotateZ(0deg) scale(1)`;
            opacityStyle = 1;
            filterStyle = 'none';
            cursorStyle = 'pointer';
            transitionStyle = 'all 0.4s ease-out'; // Faster transition for the top card
          } else if (stackPosition === -1) {
             // Card is not in the current stack, effectively hidden
             transformStyle = `translateX(-100%) translateY(0) scale(0)`;
             opacityStyle = 0;
          }
          else {
            // For cards behind the top one
            transformStyle = `
              translateX(${(stackPosition * offsetBaseX)}px) 
              translateY(${stackPosition * offsetBaseY}px) 
              scale(${1 - stackPosition * scaleFactor}) 
              rotateZ(${initialRotations.current[index] + (stackPosition * rotationFactor)}deg)
            `;
            opacityStyle = Math.max(0.2, 1 - stackPosition * 0.25); // Fade out more gradually
            filterStyle = `blur(${stackPosition * blurFactor}px)`;
            cursorStyle = 'default';
          }

          return (
            <div
              key={card.id}
              className="absolute inset-0 flex items-center justify-center p-6 text-center 
                         bg-gradient-to-br from-[#0A102A]/90 to-[#0c1a4f]/80 
                         border border-cyan-800/60 shadow-[0_0_20px_rgba(0,255,255,0.1)]
                         rounded-2xl select-none overflow-hidden"
              style={{
                zIndex: cardsData.length - stackPosition, // zIndex based on position in stack
                transform: transformStyle,
                opacity: opacityStyle,
                cursor: cursorStyle,
                filter: filterStyle,
                transition: transitionStyle,
                // Ensure card is visible when transitioning back to front
                visibility: opacityStyle > 0 ? 'visible' : 'hidden', 
              }}
              onClick={() => handleClick(index)}
            >
              <p className="text-blue-200/90 text-sm leading-relaxed">{card.fact}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// --- MAIN AIINSIGHTS COMPONENT ---
// Merged with your original direct API fetching logic.
// ============================================================================
export default function AIInsights() {
  const [biodiversityFacts, setBiodiversityFacts] = useState<CardData[]>([]);
  const [ednaFacts, setEdnaFacts] = useState<CardData[]>([]);
  const [taxonomyFacts, setTaxonomyFacts] = useState<CardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Your restored API logic ---
  const fetchWithExponentialBackoff = async (url: string, payload: object, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (response.ok) return response.json();
        if (response.status === 429) { // Handle rate limiting
             console.warn(`Rate limited. Retrying in ${delay}ms...`);
        }
      } catch (error) {
        console.error(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
        if (i === retries - 1) throw error;
      }
      await new Promise(res => setTimeout(res, delay));
      delay *= 2; // Exponential backoff
    }
    throw new Error('Failed to fetch after multiple retries.');
  };

  const fetchInsights = async (topic: string, count: number): Promise<CardData[]> => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("API key is not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY in your .env.local file.");
    }
    
    const userQuery = `Generate exactly ${count} interesting, concise, and distinct facts about ocean ${topic}. Return the response as a valid JSON array of objects, where each object has an "id" (from 1 to ${count}) and a "content" (the fact string).`;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    facts: {
                        type: "ARRAY",
                        items: { type: "STRING" }
                    }
                },
                required: ["facts"]
            }
        }
    };

    try {
        const result = await fetchWithExponentialBackoff(apiUrl, payload);
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) throw new Error("Invalid response structure from API.");
        
        const parsedJson = JSON.parse(jsonText);
        // Gemini sometimes wraps the facts in another 'facts' object
        const actualFacts = parsedJson.facts || parsedJson; 

        if (!Array.isArray(actualFacts)) {
            throw new Error("Facts array not found or invalid in parsed JSON.");
        }

        return actualFacts.map((fact: string | { id: number, content: string }, index: number) => {
            if (typeof fact === 'string') {
                return { id: index + 1, fact: fact };
            }
            return { id: fact.id || index + 1, fact: fact.content };
        });
    } catch (e) {
        console.error(`Failed to fetch insights for ${topic}:`, e);
        throw new Error(`Could not fetch insights for ${topic}. Check console for details.`);
    }
  };

  useEffect(() => {
    const loadAllInsights = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [bio, edna, taxonomy] = await Promise.all([
          fetchInsights("biodiversity", 5),
          fetchInsights("eDNA (Environmental DNA)", 5),
          fetchInsights("taxonomy", 5),
        ]);
        setBiodiversityFacts(bio);
        setEdnaFacts(edna);
        setTaxonomyFacts(taxonomy);
      } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("An unknown error occurred.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadAllInsights();
  }, []); // Empty dependency array means this runs once on mount

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-cyan-200 tracking-wide flex items-center gap-2">
        <BrainCircuit size={24} /> AI-Powered Insights
      </h2>
      <div className="pt-8">
        {isLoading && <WaveLoader />}
        {error && <p className="text-center text-red-400 bg-red-900/30 p-4 rounded-lg">{`Error: ${error}`}</p>}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 lg:gap-8">
            <Stack title="Biodiversity" cardsData={biodiversityFacts} />
            <Stack title="eDNA" cardsData={ednaFacts} />
            <Stack title="Taxonomy" cardsData={taxonomyFacts} />
          </div>
        )}
      </div>
    </section>
  );
}