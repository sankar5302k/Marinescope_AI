"use client"

import { useState, useEffect } from 'react';
import { Rss, Server, Database, BrainCircuit, Monitor } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";

// --- Configuration ---
const pipelineStages = [
  { name: 'Data Sources', icon: Rss, description: 'Ingesting live data from APIs, Sensors, and FTP servers.' },
  { name: 'Preprocessing', icon: Server, description: 'Cleaning, validating, and structuring raw data for storage.' },
  { name: 'Data Storage', icon: Database, description: 'Storing processed data in a scalable MongoDB cluster.' },
  { name: 'AI Analysis', icon: BrainCircuit, description: 'Running predictions, time-series analysis, and powering the chatbot.' },
  { name: 'Visualization', icon: Monitor, description: 'Presenting data and insights on the dashboard and map.' },
];

// Positions for each node [top%, left%] - creates a meandering path
const nodePositions = [
  [20, 10], [80, 30], [20, 50], [80, 70], [20, 90]
];

// SVG path commands for the curved connectors
const svgPaths = [
  "M 100 50 C 150 50, 150 150, 200 150", // Path from 1 to 2
  "M 200 150 C 250 150, 250 50, 300 50",   // Path from 2 to 3
  "M 300 50 C 350 50, 350 150, 400 150", // Path from 3 to 4
  "M 400 150 C 450 150, 450 50, 500 50"    // Path from 4 to 5
];

export default function DataPipelineAnimation() {
  const [activeStage, setActiveStage] = useState(-1);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage(prev => (prev + 1) % pipelineStages.length);
    }, 2500); // Animation speed for each stage
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-[#0A102A]/80 border-cyan-800/60 shadow-[0_0_15px_rgba(0,255,255,0.1)] mb-4 overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="relative h-[250px] w-full">
          {/* SVG for drawing curved paths */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {svgPaths.map((path, index) => (
              <path
                key={index}
                d={path}
                strokeWidth="2"
                strokeDasharray="5 5"
                className={`transition-all duration-500 ${activeStage === index ? 'stroke-cyan-400' : 'stroke-cyan-800/60'}`}
                fill="none"
                style={{ filter: activeStage === index ? 'url(#glow)' : 'none' }}
              />
            ))}
          </svg>

          {/* Animated data creatures (plankton/bubbles) */}
          {svgPaths.map((path, index) => (
            <div key={`creatures-${index}`} className="absolute inset-0 w-full h-full creature-path" style={{ offsetPath: `path("${path}")` }}>
              {activeStage === index && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="data-creature" style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
          ))}

          {/* Pipeline Nodes */}
          {pipelineStages.map((stage, index) => (
            <div
              key={stage.name}
              className="absolute group"
              style={{ top: `${nodePositions[index][0]}%`, left: `${nodePositions[index][1]}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className={`flex items-center justify-center h-20 w-20 rounded-full border-2 transition-all duration-500 cursor-pointer
                  ${activeStage === index ? 'bg-cyan-900/80 border-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.7)] scale-110' : 'bg-[#0c1a4f]/50 border-cyan-800/60'}`}
              >
                <stage.icon className={`h-10 w-10 transition-colors duration-500 ${activeStage === index ? 'text-cyan-300' : 'text-cyan-500/70'}`} />
              </div>
              <p className={`mt-2 text-center text-sm font-semibold transition-colors duration-500 ${activeStage === index ? 'text-cyan-200' : 'text-blue-200/80'}`}>
                {stage.name}
              </p>
              <div className="absolute bottom-full mb-2 w-48 p-2 bg-[#020412] border border-cyan-700/50 rounded-lg text-xs text-blue-200/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                {stage.description}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}