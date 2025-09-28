"use client"

import useSWR from "swr"
import { useMemo, useState, useEffect } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ScatterChart, Scatter, ZAxis, AreaChart, Area, Cell, ComposedChart
} from 'recharts';
import { TrendingUp, Calendar, GitBranch, GitCommit, MapPin, Globe, Thermometer, LineChart as LineChartIcon, BarChart3, AreaChart as AreaChartIcon } from "lucide-react";
import MarineScopeLogo from "./MarineScopeLogo";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Helper function to clean MongoDB strings
function cleanString(str: any): string {
  if (typeof str !== 'string') return 'N/A';
  const cleaned = str.replace(/\u0000/g, '').trim();
  return cleaned || 'N/A';
}

type CastRecord = Record<string, any>;

// Main Dashboard Component
export default function OceanAnalyticsDashboard() {
  const { data, error, isLoading } = useSWR('/api/casts?limit=200&page=1', fetcher, {
    refreshInterval: 60000,
  });

  // State for interactivity
  const [selectedCastId, setSelectedCastId] = useState<string | null>(null);
  const [predictDate, setPredictDate] = useState('');
  const [predictionResult, setPredictionResult] = useState<{ date: string; value: number } | null>(null);
  
  // ✨ FIX: State to ensure charts only render on the client-side after mounting
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only once on the client, after the component mounts
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (data?.items?.length > 0 && !selectedCastId) {
        const firstItem = data.items[0].raw ?? data.items[0];
        const firstId = String(firstItem._id?.$oid ?? firstItem._id);
        setSelectedCastId(firstId);
    }
  }, [data, selectedCastId]);


  const processedData = useMemo(() => {
    if (!data?.items) return null;
    const items = (data.items as CastRecord[]).map(d => d.raw ?? d);
    // ... (All data processing logic remains the same)
    const countByCountry = items.reduce((acc, item) => { const country = cleanString(item.cast_data?.country); if (country !== 'N/A' && country !== 'UNKNOWN') acc[country] = (acc[country] || 0) + 1; return acc; }, {} as Record<string, number>);
    const countryData = Object.entries(countByCountry).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 10);
    const countByRecorder = items.reduce((acc, item) => { const recorder = cleanString(item.cast_data?.Recorder); if (recorder !== 'N/A') acc[recorder] = (acc[recorder] || 0) + 1; return acc; }, {} as Record<string, number>);
    const recorderData = Object.entries(countByRecorder).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
    const tempVsLatData = items.map(item => ({ lat: item.cast_data?.lat, temp: item.cast_data?.Temperature?.[0], depths: item.cast_data?.z_row_size })).filter(d => d.lat != null && d.temp != null);
    const surfaceTempTrend = items.map(item => { const dateStr = String(item.cast_data?.date); if (dateStr.length !== 8) return null; return { date: `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`, temp: item.cast_data?.Temperature?.[0] }; }).filter((d): d is { date: string; temp: number } => d != null && d.temp != null).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const selectedCast = items.find(item => String(item._id?.$oid ?? item._id) === selectedCastId);
    const temperatureProfile = selectedCast?.cast_data?.z?.map((depth: number, index: number) => ({ depth, temperature: selectedCast?.cast_data?.Temperature?.[index] })).filter((d: any) => d.temperature != null) ?? [];
    const geoData = items.map(item => ({ lon: item.cast_data?.lon, lat: item.cast_data?.lat, temp: item.cast_data?.Temperature?.[0] })).filter(d => d.lon != null && d.lat != null && d.temp != null);
    const countByDataset = items.reduce((acc, item) => { const dataset = cleanString(item.cast_data?.dataset); if (dataset !== 'N/A') acc[dataset] = (acc[dataset] || 0) + 1; return acc; }, {} as Record<string, number>);
    const datasetData = Object.entries(countByDataset).map(([name, count]) => ({ name, count }));
    const castsByDate = items.reduce((acc, item) => { const dateStr = String(item.cast_data?.date); if (dateStr.length === 8) { const date = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`; acc[date] = (acc[date] || 0) + 1; } return acc; }, {} as Record<string, number>);
    const sortedDates = Object.entries(castsByDate).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    let cumulative = 0;
    const cumulativeCastsData = sortedDates.map(([date, count]) => { cumulative += count; return { date, cumulative }; });
    const depthsTrend = items.map(item => { const dateStr = String(item.cast_data?.date); if (dateStr.length !== 8) return null; return { date: `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`, depths: item.cast_data?.z_row_size }; }).filter(d => d && d.depths != null).sort((a, b) => new Date(a!.date).getTime() - new Date(b!.date).getTime());
    const heatmapData = items.reduce((acc, item) => { const dateStr = String(item.cast_data?.date); if(dateStr && dateStr.length === 8) { const dateObj = new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')); const month = dateObj.getMonth(); const dayOfWeek = dateObj.getDay(); if(!isNaN(month) && !isNaN(dayOfWeek)){ const key = `${dayOfWeek}-${month}`; acc[key] = (acc[key] || 0) + 1; } } return acc; }, {} as Record<string, number>);

    // Time Series Forecasting for Temperature
    let tempForecastData: any[] = [];
    let regressionModel = { slope: 0, intercept: 0, firstDate: new Date() };
    if (surfaceTempTrend.length > 1) {
        const n = surfaceTempTrend.length;
        const x = surfaceTempTrend.map((_, i) => i);
        const y = surfaceTempTrend.map(d => d.temp);
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, val, i) => acc + val * y[i], 0);
        const sumX2 = x.reduce((acc, val) => acc + val * val, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        const firstDate = new Date(surfaceTempTrend[0].date);
        regressionModel = { slope, intercept, firstDate };
        const FORECAST_DAYS = 30;
        const lastDate = new Date(surfaceTempTrend[n - 1].date);
        tempForecastData = surfaceTempTrend.map((d, i) => ({ ...d, prediction: parseFloat((slope * i + intercept).toFixed(2)) }));
        for (let i = 0; i < FORECAST_DAYS; i++) {
            const futureDate = new Date(lastDate);
            futureDate.setDate(lastDate.getDate() + i + 1);
            tempForecastData.push({ date: futureDate.toISOString().split('T')[0], prediction: parseFloat((slope * (n + i) + intercept).toFixed(2)) });
        }
    }
    return { items, countryData, recorderData, tempVsLatData, surfaceTempTrend, temperatureProfile, geoData, datasetData, cumulativeCastsData, depthsTrend, heatmapData, tempForecastData, regressionModel };
  }, [data, selectedCastId]);
  
  const handlePrediction = () => {
    if (!predictDate || !processedData?.regressionModel) return;
    const { slope, intercept, firstDate } = processedData.regressionModel;
    const targetDate = new Date(predictDate);
    const timeDiff = targetDate.getTime() - firstDate.getTime();
    const dayIndex = Math.ceil(timeDiff / (1000 * 3600 * 24));
    if (dayIndex < 0) {
        setPredictionResult({ date: predictDate, value: -999 });
        return;
    }
    const predictedValue = parseFloat((slope * dayIndex + intercept).toFixed(2));
    setPredictionResult({ date: predictDate, value: predictedValue });
  };

  const ChartCard = ({ title, icon, children, className = '' }: { title: string, icon: React.ReactNode, children: React.ReactNode, className?: string }) => (
    <div className={`bg-gradient-to-br from-[#0A102A]/80 to-[#0c1a4f]/60 rounded-xl shadow-[0_0_20px_rgba(0,255,255,0.1)] border border-cyan-800/60 p-4 sm:p-6 flex flex-col ${className}`}>
      <h3 className="text-lg font-semibold text-cyan-200 mb-4 flex items-center gap-3">{icon}{title}</h3>
      <div className="flex-grow">{children}</div>
    </div>
  );
  
  const DashboardLoadingSkeleton = () => (
    <div className="h-[600px] w-full flex items-center justify-center bg-[#020412]">
        <div className="text-center text-white">
            <MarineScopeLogo className="h-16 w-16 mx-auto animate-pulse" />
            <p className="mt-4 text-lg tracking-widest">ANALYZING DATASTREAMS...</p>
        </div>
    </div>
  );

  if (isLoading || !isClient) return <DashboardLoadingSkeleton />;
  if (error || !processedData) return <div className="p-6 text-red-400 bg-red-900/50 rounded-lg">Error: Failed to load dashboard telemetry.</div>;

  const { items, countryData, recorderData, tempVsLatData, surfaceTempTrend, temperatureProfile, geoData, datasetData, cumulativeCastsData, depthsTrend, heatmapData, tempForecastData } = processedData;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const maxHeatmapValue = Math.max(...Object.values(heatmapData), 1);
  const tempColors = ['#5DADE2', '#58D68D', '#F4D03F', '#F5B041', '#E74C3C'];
  
  return (
    <div className="p-4 sm:p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">Analytics Dashboard</h1>
        <p className="text-lg text-blue-300/70 mt-1">Visualizing the latest 200 oceanographic cast records</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* All 11 charts are rendered here... */}
        <ChartCard title="Temperature Profile by Depth" icon={<LineChartIcon className="text-cyan-400"/>}><div className="mb-4"><select id="cast-select" value={selectedCastId ?? ''} onChange={(e) => setSelectedCastId(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-[#020412] border-cyan-700/50 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md">{items.map(item => <option key={String(item._id?.$oid ?? item._id)} value={String(item._id?.$oid ?? item._id)}>{String(item._id?.$oid ?? item._id)}</option>)}</select></div><ResponsiveContainer width="100%" height={250}><LineChart data={temperatureProfile} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#0e7490" strokeOpacity={0.2} /><YAxis stroke="#9ca3af" domain={['dataMin - 1', 'dataMax + 1']} label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill:'#9ca3af', fontSize: 12 }}/><XAxis dataKey="depth" stroke="#9ca3af" type="number" domain={[0, 'dataMax']} label={{ value: 'Depth (m)', position: 'insideBottom', offset: 0, fill:'#9ca3af', fontSize: 12 }}/><Tooltip contentStyle={{ backgroundColor: 'rgba(2, 4, 18, 0.8)', borderColor: '#0891b2', color: '#e0f7fa' }} /><Line type="monotone" dataKey="temperature" stroke="#34d399" strokeWidth={2} dot={false} name="Temperature"/></LineChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Top 10 Record Origins" icon={<Globe className="text-cyan-400"/>}><ResponsiveContainer width="100%" height={300}><BarChart layout="vertical" data={countryData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#0e7490" strokeOpacity={0.1} /><XAxis type="number" stroke="#9ca3af" /><YAxis dataKey="name" type="category" width={80} stroke="#9ca3af" tick={{fontSize: 12}} /><Tooltip cursor={{fill: 'rgba(8, 145, 178, 0.1)'}} contentStyle={{ backgroundColor: 'rgba(2, 4, 18, 0.8)', borderColor: '#0891b2' }} /><Bar dataKey="count" name="Record Count">{countryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={`hsl(180, 70%, ${80 - index * 4}%)`} />))}</Bar></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Surface Temp vs. Latitude" icon={<Thermometer className="text-cyan-400"/>}><ResponsiveContainer width="100%" height={300}><ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}><CartesianGrid stroke="#0e7490" strokeOpacity={0.1}/><XAxis type="number" dataKey="lat" name="Latitude" unit="°" stroke="#9ca3af" /><YAxis type="number" dataKey="temp" name="Temperature" unit="°C" stroke="#9ca3af" /><ZAxis dataKey="depths" range={[20, 200]} name="depths" unit="m" /><Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderColor: '#0891b2' }} /><Scatter name="Casts" data={tempVsLatData} fill="#2dd4bf" shape="circle" /></ScatterChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Geographic Cast Distribution" icon={<MapPin className="text-cyan-400"/>}><ResponsiveContainer width="100%" height={300}><ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}><CartesianGrid stroke="#0e7490" strokeOpacity={0.1}/><XAxis type="number" dataKey="lon" name="Longitude" domain={[-180, 180]} stroke="#9ca3af" /><YAxis type="number" dataKey="lat" name="Latitude" domain={[-90, 90]} stroke="#9ca3af" /><Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{borderColor: '#0891b2' }} /><Scatter name="Cast Locations" data={geoData} fill="#818cf8">{geoData.map((entry, index) => (<Cell key={`cell-${index}`} fill={tempColors[Math.floor(Math.max(0, entry.temp-5)/5)] || "#E74C3C"} />))}</Scatter></ScatterChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Surface Temperature Trend" icon={<AreaChartIcon className="text-cyan-400"/>}><ResponsiveContainer width="100%" height={300}><AreaChart data={surfaceTempTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><defs><linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.7}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#0e7490" strokeOpacity={0.1} /><XAxis dataKey="date" stroke="#9ca3af" tick={{fontSize: 10}} /><YAxis stroke="#9ca3af" /><Tooltip contentStyle={{ backgroundColor: 'rgba(2, 4, 18, 0.8)', borderColor: '#0891b2' }} /><Area type="monotone" dataKey="temp" stroke="#f43f5e" fillOpacity={1} fill="url(#colorTemp)" name="Avg Temp" /></AreaChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Cumulative Casts Over Time" icon={<GitCommit className="text-cyan-400"/>}><ResponsiveContainer width="100%" height={300}><AreaChart data={cumulativeCastsData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><defs><linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7}/><stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#0e7490" strokeOpacity={0.1} /><XAxis dataKey="date" stroke="#9ca3af" tick={{fontSize: 10}}/><YAxis stroke="#9ca3af" /><Tooltip contentStyle={{ backgroundColor: 'rgba(2, 4, 18, 0.8)', borderColor: '#0891b2' }} /><Area type="monotone" dataKey="cumulative" stroke="#38bdf8" fill="url(#colorCum)" name="Total Casts" /></AreaChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Records by Recorder Type" icon={<BarChart3 className="text-cyan-400"/>}><ResponsiveContainer width="100%" height={300}><BarChart data={recorderData} margin={{ top: 5, right: 20, left: -10, bottom: 50 }}><CartesianGrid strokeDasharray="3 3" stroke="#0e7490" strokeOpacity={0.1}/><XAxis dataKey="name" stroke="#9ca3af" angle={-45} textAnchor="end" height={60} tick={{fontSize: 10}}/><YAxis stroke="#9ca3af" /><Tooltip contentStyle={{ backgroundColor: 'rgba(2, 4, 18, 0.8)', borderColor: '#0891b2' }} /><Bar dataKey="count" fill="#a78bfa" name="Count" /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Records by Dataset" icon={<GitBranch className="text-cyan-400"/>}><ResponsiveContainer width="100%" height={300}><BarChart data={datasetData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#0e7490" strokeOpacity={0.1}/><XAxis dataKey="name" stroke="#9ca3af" /><YAxis stroke="#9ca3af" /><Tooltip contentStyle={{ backgroundColor: 'rgba(2, 4, 18, 0.8)', borderColor: '#0891b2' }} /><Bar dataKey="count" fill="#fb923c" name="Count" /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Depth Recordings Trend" icon={<LineChartIcon className="text-cyan-400" />}><ResponsiveContainer width="100%" height={300}><LineChart data={depthsTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#0e7490" strokeOpacity={0.1} /><XAxis dataKey="date" stroke="#9ca3af" tick={{fontSize: 10}} /><YAxis stroke="#9ca3af" /><Tooltip contentStyle={{ backgroundColor: 'rgba(2, 4, 18, 0.8)', borderColor: '#0891b2' }} /><Line type="monotone" dataKey="depths" stroke="#e879f9" strokeWidth={2} name="Number of Depths" dot={false}/></LineChart></ResponsiveContainer></ChartCard>
                </div><div>

        <ChartCard title="Daily/Monthly Activity Heatmap" icon={<Calendar className="text-cyan-400"/>} className="lg:col-span-2"><div className="flex flex-col items-center p-4"><div className="flex w-full max-w-3xl"><div className="grid grid-rows-7 gap-1.5 mr-2">{days.map(d => <div key={d} className="text-xs text-right h-5 flex items-center justify-end text-blue-300/80">{d}</div>)}</div><div className="w-full overflow-x-auto pb-2"><div className="grid grid-flow-col grid-rows-7 gap-1" style={{width: `${12 * 3}rem`}}>{Array.from({ length: 12 * 7 }).map((_, i) => { const monthIndex = Math.floor(i / 7); const dayIndex = i % 7; const count = heatmapData[`${dayIndex}-${monthIndex}`] || 0; const opacity = count > 0 ? 0.2 + (count / maxHeatmapValue) * 0.8 : 0.05; return (<div key={i} title={`${months[monthIndex]}, ${days[dayIndex]}: ${count} casts`} className="w-full h-5 rounded-sm bg-cyan-400 transition-opacity" style={{ opacity }}></div>); })}</div></div></div></div></ChartCard>
        
        {tempForecastData.length > 0 && (
          <ChartCard title="Surface Temperature Forecast" icon={<TrendingUp className="text-cyan-400"/>} className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={tempForecastData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <defs><linearGradient id="colorTempForecast" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.7}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0e7490" strokeOpacity={0.1} />
                      <XAxis dataKey="date" stroke="#9ca3af" tick={{fontSize: 10}} />
                      <YAxis stroke="#9ca3af" domain={['dataMin - 2', 'dataMax + 2']} unit="°C" />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(2, 4, 18, 0.8)', borderColor: '#0891b2' }} />
                      <Legend wrapperStyle={{fontSize: "14px"}}/>
                      <Area type="monotone" dataKey="temp" stroke="#f43f5e" fill="url(#colorTempForecast)" name="Historical Temperature" />
                      <Line type="monotone" dataKey="prediction" stroke="#f59e0b" strokeWidth={2} name="Forecast Trend" dot={false} strokeDasharray="5 5" />
                  </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-6 p-4 border-t border-cyan-800/60">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex-grow w-full sm:w-auto">
                          <label htmlFor="predict-date" className="block text-sm font-medium text-blue-200/90 mb-1">Get Prediction for a Specific Date:</label>
                          <input type="date" id="predict-date" value={predictDate} onChange={e => setPredictDate(e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-[#020412] border-cyan-700/50 text-white rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500"/>
                      </div>
                      <button onClick={handlePrediction} disabled={!predictDate} className="w-full sm:w-auto px-6 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end">Predict</button>
                  </div>
                  {predictionResult && (
                      <div className="mt-4 p-3 rounded-md bg-cyan-900/40 text-center">
                          {predictionResult.value === -999 ? (
                              <p className="font-medium text-yellow-400">Please select a future date for prediction.</p>
                          ) : (
                              <p className="font-medium text-cyan-200">
                                  Predicted temperature for <span className="font-bold text-white">{new Date(predictionResult.date + 'T00:00:00').toLocaleDateString()}</span>: 
                                  <span className="text-2xl ml-2 font-bold text-yellow-400">{predictionResult.value.toFixed(2)}°C</span>
                              </p>
                          )}
                      </div>
                  )}
              </div>
          </ChartCard>
        )}
      </div>
    </div>
  );
}