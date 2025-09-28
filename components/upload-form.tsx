"use client"

import type React from "react"

import { mutate } from "swr"
import { useState } from "react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<"ocean" | "taxonomy" | "edna">("ocean")
  const [status, setStatus] = useState<"pending" | "done">("pending")
  const [obisScore, setObisScore] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("category", category)
      fd.append("status", status)
      if (obisScore.trim()) fd.append("obisScore", obisScore.trim())

      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        alert(`Upload failed: ${data?.error || res.statusText}`)
      } else {
        // refresh list
        mutate("/api/files")
      }
    } catch (err: any) {
      alert(`Upload error: ${err?.message || "Unknown error"}`)
    } finally {
      setSubmitting(false)
      setFile(null)
      setObisScore("")
      setStatus("pending")
      setCategory("ocean")
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">File (CSV or NetCDF)</label>
          <input
            type="file"
            accept=".csv,.nc"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="ocean">Ocean data</option>
            <option value="taxonomy">Taxonomy data</option>
            <option value="edna">eDNA data</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Preprocessing Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="border rounded-md px-3 py-2 text-sm bg-background"
          >
            <option value="pending">Pending</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">OBIS Score (optional)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={obisScore}
            onChange={(e) => setObisScore(e.target.value)}
            placeholder="0-100"
            className="border rounded-md px-3 py-2 text-sm bg-background"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!file || submitting}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Uploading..." : "Upload"}
        </button>
        <p className="text-xs text-muted-foreground">
          External upload endpoint: <code className="font-mono">POST /api/upload</code>
        </p>
      </div>
    </form>
  )
}
