import { NextResponse } from "next/server"
import { getCollections } from "@/lib/mongo"

export async function GET() {
  const { uploads } = await getCollections()
  const list = await uploads
    .find({})
    .sort({ uploadedAt: -1 })
    .project({
      _id: 1,
      name: 1,
      category: 1,
      type: 1,
      sizeBytes: 1,
      status: 1,
      obisCompliant: 1,
      uploadedAt: 1,
      gridFsId: 1,
    }) // include GridFS id
    .toArray()

  const files = list.map((d: any) => ({
    id: d._id?.toString?.() ?? "",
    name: d.name,
    category: d.category,
    type: d.type,
    sizeBytes: d.sizeBytes || 0,
    status: d.status,
    obisCompliant: !!d.obisCompliant,
    uploadedAt: d.uploadedAt,
    fileId: d.gridFsId ? d.gridFsId.toString?.() : null, // expose fileId
  }))

  return NextResponse.json(
    { files },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    },
  )
}
