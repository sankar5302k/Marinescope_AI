"use client"

import type React from "react"
import { useMemo, useState } from "react"
import useSWR, { mutate } from "swr"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Database, ArrowLeft, Upload, HardDrive, FileText, CheckCircle2, Clock, Binary, Layers, Leaf, TestTube } from "lucide-react"
import MarineScopeLogo from "@/components/MarineScopeLogo"

// --- TYPE DEFINITIONS ---
type RepoKey = "ocean" | "taxonomy" | "edna"
type FileRecord = {
  id: string; name: string; category: RepoKey; type: "CSV" | "NetCDF" | "DNA" | "Other";
  sizeBytes: number; status: "done" | "pending"; obisCompliant: boolean; uploadedAt: string;
}

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export default function OceanDatabase() {
  const { data, isLoading } = useSWR<{ files: FileRecord[] }>("/api/files", fetcher, { refreshInterval: 4000 })
  const files = data?.files ?? []

  const totals = useMemo(() => ({
    count: files.length,
    sizeBytes: files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0),
  }), [files]);

  const obisPercent = (k: RepoKey) => {
    const cat = files.filter((f) => f.category === k)
    if (cat.length === 0) return null
    const compliant = cat.filter((f) => f.obisCompliant).length
    return Math.round((compliant / cat.length) * 100)
  }

  // --- FORM STATE ---
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState<RepoKey>("ocean")
  const [type, setType] = useState<"CSV" | "NetCDF" | "DNA" | "Other">("CSV")
  const [status, setStatus] = useState<"done" | "pending">("pending")
  const [obis, setObis] = useState(false)
  const [isUploading, setUploading] = useState(false)

  async function onUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      alert("Please select a file to upload.");
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("name", name || file.name)
      fd.append("category", category)
      fd.append("type", type)
      fd.append("status", status)
      fd.append("obisCompliant", String(obis))
      fd.append("sizeBytes", String(file.size))

      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error(`Upload failed with status: ${res.status}`)
      
      await mutate("/api/files")
      
      // Reset form
      setFile(null); setName(""); setObis(false); setStatus("pending");
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if(fileInput) fileInput.value = "";

    } catch (err) {
      console.error("[MarineScope] Upload error:", err)
      alert("An error occurred during upload. Please check the console.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020412] text-cyan-50 font-sans">
      {/* Header */}
       <header className="border-b border-cyan-900/50 bg-[#080c24]/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <MarineScopeLogo className="h-10 w-10" />
              <div>
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 tracking-wider">
                  Data Repository
                </h1>
                <p className="text-sm text-blue-300/70">Upload, browse, and manage datasets</p>
              </div>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-2 bg-transparent text-cyan-300 border-cyan-700 hover:bg-cyan-900/50 hover:text-cyan-100">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-10">
        {/* Upload Panel */}
        <Card className="bg-gradient-to-br from-[#0A102A]/80 to-[#0c1a4f]/60 border-cyan-800/60 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
          <CardHeader>
            <CardTitle className="text-lg text-cyan-200 flex items-center gap-2"><Upload size={20}/> Ingest New Data</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onUpload} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="file-input" className="text-blue-200/90">Data File</Label>
                    <Input id="file-input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="file:text-cyan-300 file:bg-cyan-900/50 file:border-cyan-700/50 file:hover:bg-cyan-800/50 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:cursor-pointer"/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name" className="text-blue-200/90">Display Name (optional)</Label>
                    <Input id="name" placeholder={file?.name || "e.g., dataset.csv"} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label className="text-blue-200/90">Category</Label>
                    <Select value={category} onValueChange={(v: RepoKey) => setCategory(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ocean">Oceanographic</SelectItem><SelectItem value="taxonomy">Taxonomy</SelectItem><SelectItem value="edna">eDNA</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-blue-200/90">File Type</Label>
                    <Select value={type} onValueChange={(v: any) => setType(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CSV">CSV</SelectItem><SelectItem value="NetCDF">NetCDF</SelectItem><SelectItem value="DNA">DNA</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-blue-200/90">Initial Status</Label>
                    <Select value={status} onValueChange={(v: any) => setStatus(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                    <div className="flex items-center gap-2 h-[40px]">
                        <Input id="obis" type="checkbox" checked={obis} onChange={(e) => setObis(e.target.checked)} className="w-5 h-5 accent-cyan-500 bg-transparent border-cyan-700/50"/>
                        <Label htmlFor="obis" className="text-blue-200/90">Mark as IndOBIS compliant</Label>
                    </div>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                    <Button type="submit" disabled={isUploading || !file} className="w-full sm:w-auto float-right gap-2 text-base py-3 px-6 btn-primary">
                        <Upload className="h-5 w-5" />
                        {isUploading ? "Uploading..." : "Upload File"}
                    </Button>
                </div>
            </form>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0A102A]/80 border-cyan-800/60"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-cyan-200">Total Files</CardTitle><FileText className="h-4 w-4 text-cyan-400/70" /></CardHeader><CardContent><div className="text-3xl font-bold text-cyan-300">{totals.count}</div><p className="text-xs text-blue-300/70">Active datasets in repository</p></CardContent></Card>
            <Card className="bg-[#0A102A]/80 border-cyan-800/60"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-cyan-200">Total Size</CardTitle><HardDrive className="h-4 w-4 text-cyan-400/70" /></CardHeader><CardContent><div className="text-3xl font-bold text-cyan-300">{formatBytes(totals.sizeBytes)}</div><p className="text-xs text-blue-300/70">Total storage allocated</p></CardContent></Card>
            <Card className="bg-[#0A102A]/80 border-cyan-800/60"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-cyan-200">Preprocessing Status</CardTitle><Database className="h-4 w-4 text-cyan-400/70" /></CardHeader><CardContent className="space-y-2 pt-2 text-sm"><div className="flex items-center gap-2 text-green-300"><CheckCircle2 className="h-4 w-4" /><span>Completed: {files.filter((f) => f.status === "done").length}</span></div><div className="flex items-center gap-2 text-yellow-300"><Clock className="h-4 w-4" /><span>Pending: {files.filter((f) => f.status === "pending").length}</span></div></CardContent></Card>
        </div>

        {/* File list */}
        <Card className="bg-[#0A102A]/80 border-cyan-800/60 shadow-[0_0_15px_rgba(0,255,255,0.1)]">
          <CardHeader>
            <CardTitle className="text-lg text-cyan-200 flex items-center gap-2"><HardDrive size={20}/> Stored Datasets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (<div className="py-10 text-center text-sm text-blue-300/70">Accessing repository...</div>
            ) : files.length === 0 ? (<div className="py-10 text-center text-sm text-blue-300/70">No files uploaded yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.map((f) => (
                  <Card key={f.id} className="bg-[#0c1a4f]/50 border-cyan-900/70 hover:border-cyan-700 transition-colors">
                    <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-cyan-200 truncate" title={f.name}>{f.name}</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="flex items-center flex-wrap gap-2">
                        <Badge variant="secondary" className="capitalize gap-1.5"><Layers size={12}/> {f.category}</Badge>
                        <Badge variant="secondary" className="gap-1.5"><Binary size={12}/>{f.type}</Badge>
                         <Badge variant={f.obisCompliant ? "default" : "secondary"} className={f.obisCompliant ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : ""}> {f.obisCompliant ? "OBIS" : "Non-OBIS"}</Badge>
                      </div>
                       <div className="flex items-center justify-between"><span className="text-blue-300/70">Size</span><span className="font-mono text-cyan-300">{formatBytes(f.sizeBytes)}</span></div>
                       <div className="flex items-center justify-between"><span className="text-blue-300/70">Uploaded</span><span className="font-medium text-blue-200">{new Date(f.uploadedAt).toLocaleString()}</span></div>
                       <div className="flex items-center justify-between"><span className="text-blue-300/70">Status</span><Badge className={`capitalize ${f.status === 'done' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse'}`}>{f.status === 'done' ? <CheckCircle2 size={12} className="mr-1.5"/> : <Clock size={12} className="mr-1.5"/>}{f.status}</Badge></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category OBIS summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(["ocean", "taxonomy", "edna"] as RepoKey[]).map((k) => (
            <Card key={k} className="bg-[#0A102A]/80 border-cyan-800/60">
              <CardHeader className="pb-3">
                <CardTitle className="capitalize text-cyan-200 text-base flex items-center gap-2">
                  {k === 'ocean' ? <Database size={16}/> : k === 'taxonomy' ? <Leaf size={16}/> : <TestTube size={16}/>}
                  {k} IndOBIS Score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-right">
                  <span className="text-2xl font-bold font-mono text-cyan-300">
                    {obisPercent(k) === null ? "N/A" : `${obisPercent(k)}%`}
                  </span>
                </div>
                <Progress value={obisPercent(k) ?? 0} aria-label={`OBIS score for ${k}`} className="[&>*]:bg-cyan-400 bg-cyan-900/50 h-2"/>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}