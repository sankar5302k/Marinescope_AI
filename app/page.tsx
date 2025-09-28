"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Database, Map, UploadCloud, Cpu, Layers, FileText } from "lucide-react"
import CastRecordsPanel from "@/components/cast-records-panel"
import OceanAnalyticsDashboard from "@/components/Graph"
import MarineScopeLogo from "@/components/MarineScopeLogo" 
import useSWR from "swr"
import DataPipelineAnimation from "@/components/DataPipelineAnimation" // <-- 1. IMPORT THE NEW COMPONENT
import Stackie from "@/components/stack"
import OceanChatbot from "@/components/oceanchat"

// --- Helper Functions ---
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Number.parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`
}

// --- Type Definitions ---
type RepoKey = "ocean" | "taxonomy" | "edna"
type FileRecord = {
  id: string; name: string; category: RepoKey;
  type: "CSV" | "NetCDF" | "DNA" | "Other";
  sizeBytes: number; status: "done" | "pending";
  obisCompliant: boolean; uploadedAt: string;
}

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

// --- Main Dashboard Component ---
export default function OceanDataManagementPlatform() {
  const { data } = useSWR<{ files: FileRecord[] }>("/api/files", fetcher, { refreshInterval: 4000 })
  const files = data?.files ?? []
  const repoMetrics = useMemo(() => {
    const base = {
      files: { ocean: 0, taxonomy: 0, edna: 0 } as Record<RepoKey, number>,
      sizeBytes: { ocean: 0, taxonomy: 0, edna: 0 } as Record<RepoKey, number>,
      obisScore: { ocean: null, taxonomy: null, edna: null } as Record<RepoKey, number | null>,
    }
    const counts = { ocean: 0, taxonomy: 0, edna: 0 } as Record<RepoKey, number>
    const compliant = { ocean: 0, taxonomy: 0, edna: 0 } as Record<RepoKey, number>

    for (const f of files) {
      base.files[f.category] += 1
      base.sizeBytes[f.category] += f.sizeBytes || 0
      counts[f.category] += 1
      if (f.obisCompliant) compliant[f.category] += 1
    }
    ;(["ocean", "taxonomy", "edna"] as RepoKey[]).forEach((k) => {
      base.obisScore[k] = counts[k] === 0 ? null : Math.round((compliant[k] / counts[k]) * 100)
    })

    return base
  }, [files])

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#020412] text-cyan-50 font-sans">
      <div className="absolute inset-0 z-0 opacity-20 animate-pulse-slow">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 to-transparent"></div>
        <div className="absolute inset-0 bg-[url('/ocean-pattern-subtle.svg')] bg-repeat opacity-50 mix-blend-screen animate-pan-background"></div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#020412] via-[#020412]/80 to-[#020412]/50 z-10"></div>

      <header className="relative z-50 border-b border-cyan-900/50 bg-[#080c24]/50 backdrop-blur-sm sticky top-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <MarineScopeLogo className="h-10 w-10" />
              <div>
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 tracking-wider">
                  MarineScope AI
                </h1>
                <p className="text-sm text-blue-300/70">Oceanographic Data Intelligence Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/database">
                <Button variant="outline" size="sm" className="gap-2 bg-transparent text-cyan-300 border-cyan-700 hover:bg-cyan-900/50 hover:text-cyan-100">
                  <Database className="h-4 w-4" />
                  Database
                </Button>
              </Link>
              <Link href="/ocean-map">
                <Button variant="outline" size="sm" className="gap-2 bg-transparent text-cyan-300 border-cyan-700 hover:bg-cyan-900/50 hover:text-cyan-100">
                  <Map className="h-4 w-4" />
                  Live Data Map
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-20 container mx-auto px-4 py-8 space-y-10">
        {/* DATA PIPELINE SECTION */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cyan-200 tracking-wide flex items-center gap-2"><Cpu size={24} /> Real-Time Data Pipeline</h2>
          
          {/* 👇 2. PLACE THE NEW COMPONENT HERE */}
          
          <Card className="bg-[#0A102A]/80 border-cyan-800/60 shadow-[0_0_15px_rgba(0,255,255,0.1)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-blue-300/80">Latest files and preprocessing status</CardTitle>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <UploadCloud className="h-10 w-10 text-cyan-600 mb-3" />
                  <p className="text-sm text-blue-300/70">
                    No uploads yet. Pipeline is active and awaiting new data streams.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-cyan-800/50 hover:bg-transparent">
                        <TableHead className="text-cyan-300">File</TableHead>
                        <TableHead className="text-cyan-300">Category</TableHead>
                        <TableHead className="text-cyan-300">Size</TableHead>
                        <TableHead className="text-cyan-300">Uploaded</TableHead>
                        <TableHead className="text-right text-cyan-300">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((u) => (
                        <TableRow key={u.id} className="border-cyan-900/50 hover:bg-cyan-900/20">
                          <TableCell className="font-mono text-cyan-100">{u.name}</TableCell>
                          <TableCell className="capitalize text-blue-200">{u.category}</TableCell>
                          <TableCell className="font-mono text-blue-200">{formatBytes(u.sizeBytes)}</TableCell>
                          <TableCell className="text-blue-300/80">
                            {new Date(u.uploadedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                             <Badge className={`capitalize ${u.status === "done" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse"}`}>
                               {u.status}
                             </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
<DataPipelineAnimation />

        <section>
          <OceanAnalyticsDashboard />
        </section>

        <Separator className="bg-cyan-800/50" />

        {/* Clustered Ocean Repository */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-cyan-200 tracking-wide flex items-center gap-2"><Layers size={24}/> Clustered Data Repositories</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(["ocean", "taxonomy", "edna"] as RepoKey[]).map(key => {
              const titles = { ocean: "Oceanographic Data", taxonomy: "Taxonomy Data", edna: "eDNA Sequences" };
              const descriptions = {
                ocean: "CTD, buoy, time-series observations",
                taxonomy: "Species lists, occurrence mappings",
                edna: "Sequence reads, metabarcoding",
              };

              return (
                <Card key={key} className="bg-gradient-to-br from-[#0A102A]/80 to-[#0c1a4f]/60 border-cyan-800/60 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-cyan-200">{titles[key]}</CardTitle>
                    <p className="text-sm text-blue-300/70">{descriptions[key]}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-blue-300/80">Files</p>
                        <p className="text-lg font-semibold text-cyan-300">{repoMetrics.files[key]}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-300/80">Size</p>
                        <p className="text-lg font-semibold text-cyan-300">{formatBytes(repoMetrics.sizeBytes[key])}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-blue-300/80">IndOBIS Standardization</p>
                        <span className="text-xs font-mono text-cyan-300">
                          {repoMetrics.obisScore[key] === null ? "N/A" : `${repoMetrics.obisScore[key]}%`}
                        </span>
                      </div>
                      <Progress value={repoMetrics.obisScore[key] ?? 0} className="[&>*]:bg-cyan-400 bg-cyan-900/50 h-2" />
                    </div>
                    <Link href="/database">
                        <Button variant="outline" size="sm" className="w-full bg-transparent text-cyan-300 border-cyan-700 hover:bg-cyan-900/50 hover:text-cyan-100">
                         View Repository
                       </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
<section>
  <Stackie></Stackie>
</section>
        {/* Live Cast Records from MongoDB */}
        <section className="space-y-4">
            <h2 className="text-xl font-semibold text-cyan-200 tracking-wide flex items-center gap-2"><FileText size={24} /> Live Cast Records</h2>
          <CastRecordsPanel />
        </section>
        <section>

        </section>
      </main>
    </div>
  )
}