import { NextResponse } from "next/server"
import { getCollections, getUploadsBucket } from "@/lib/mongo"

type RepoKey = "ocean" | "taxonomy" | "edna"
type PreprocessStatus = "done" | "pending"

function asCategory(val: any): RepoKey {
  const v = String(val || "").toLowerCase()
  if (v === "ocean" || v === "taxonomy" || v === "edna") return v
  return "ocean"
}

function inferType(name?: string | null): "CSV" | "NetCDF" | "DNA" | "Other" {
  const n = (name || "").toLowerCase()
  if (n.endsWith(".csv")) return "CSV"
  if (n.endsWith(".netcdf") || n.endsWith(".nc") || n.endsWith(".cdf")) return "NetCDF"
  if (n.endsWith(".fasta") || n.endsWith(".fa") || n.endsWith(".fastq")) return "DNA"
  return "Other"
}

function asStatus(val: any): PreprocessStatus {
  const v = String(val || "").toLowerCase()
  return v === "done" ? "done" : "pending"
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  })
}

export async function POST(req: Request) {
  const form = await req.formData()

  const file = form.get("file") as File | null
  const name = (form.get("name") as string) || file?.name || "untitled"
  const category = asCategory(form.get("category"))
  const reqType = (form.get("type") as string) || ""
  const type =
    reqType.toUpperCase() === "CSV"
      ? "CSV"
      : reqType.toUpperCase() === "NETCDF"
        ? "NetCDF"
        : reqType.toUpperCase() === "DNA"
          ? "DNA"
          : inferType(name)

  const status = asStatus(form.get("status"))
  const obisCompliant = ["true", "1", "on", "yes"].includes(
    String(form.get("obisCompliant") || "").toLowerCase()
  )
  const sizeFromForm = Number(form.get("sizeBytes") || 0)
  const sizeBytes =
    Number.isFinite(sizeFromForm) && sizeFromForm > 0
      ? sizeFromForm
      : file?.size ?? 0

  let fileId: string | null = null
  if (file) {
    try {
      const bucket = await getUploadsBucket()
      const uploadStream = bucket.openUploadStream(name, {
        metadata: { category, type, status, obisCompliant, sizeBytes },
      })

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // ✅ Proper promise wrapping
      await new Promise<void>((resolve, reject) => {
        uploadStream.on("error", reject)
        uploadStream.on("finish", resolve)
        uploadStream.end(buffer)
      })

      fileId = uploadStream.id?.toString?.() ?? null
    } catch (err) {
      console.error("[v0] GridFS store error:", (err as Error).message)
    }
  }

  const doc = {
    name,
    category,
    type,
    sizeBytes,
    status,
    obisCompliant,
    uploadedAt: new Date(),
    gridFsId: fileId,
  }

  const { uploads } = await getCollections()
  const result = await uploads.insertOne(doc as any)

  let forwardOk = false
  let forwardStatus = 0
  try {
    if (file) {
      const fwd = new FormData()
      fwd.append("file", file, name)
      fwd.append("name", name)
      fwd.append("category", category)
      fwd.append("type", type)
      fwd.append("status", status)
      fwd.append("obisCompliant", String(obisCompliant))

      const res = await fetch("http://127.0.0.1:5000/original", {
        method: "POST",
        body: fwd,
      })
      forwardOk = res.ok
      forwardStatus = res.status
    }
  } catch (err) {
    console.error("[v0] Forward to Python failed:", (err as Error).message)
  }

  // ✅ Update DB if preprocessing succeeded
  if (forwardOk) {
    try {
      await uploads.updateOne(
        { _id: result.insertedId },
        { $set: { status: "done", processedAt: new Date() } }
      )
    } catch (err) {
      console.error("[v0] Failed to update status to done:", (err as Error).message)
    }
  }

  const finalStatus = forwardOk ? "done" : status

  const body = {
    file: {
      id: result.insertedId?.toString?.() ?? "",
      fileId,
      name,
      category,
      type,
      sizeBytes,
      status: finalStatus,
      obisCompliant,
      uploadedAt: doc.uploadedAt,
      gridFsId: fileId,
    },
    forwarded: forwardOk,
    forwardStatus,
  }

  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  })
}
