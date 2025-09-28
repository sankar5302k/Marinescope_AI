import { NextResponse } from "next/server"
import { getCollections } from "@/lib/mongo"

export async function GET(req: Request) {
  const { castRecords } = await getCollections()

  const url = new URL(req.url)
  const limitParam = url.searchParams.get("limit")
  const pageParam = url.searchParams.get("page")
  const searchParam = url.searchParams.get("search")

  // Default limit is 10 (updated from 50)
  const limit = Math.max(1, Math.min(200, Number.parseInt(limitParam || "10", 10) || 10))
  const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1)
  const skip = (page - 1) * limit;

  let query: any = {};
  if (searchParam) {
    // Implement simple text search on common string fields (case-insensitive regex)
    // Searches 'country', 'Recorder', and 'dataset' fields inside 'cast_data'
    const regex = new RegExp(searchParam, 'i');
    query = {
        $or: [
            { "cast_data.country": { $regex: regex } },
            { "cast_data.Recorder": { $regex: regex } },
            { "cast_data.dataset": { $regex: regex } },
        ]
    };
  }

  // Fetch filtered/paginated docs from cast_records
  // Uses skip() for pagination and limit() for page size
  const cursor = castRecords.find(query).sort({ _id: -1 }).skip(skip).limit(limit)
  const list = await cursor.toArray()

  // Get total count for pagination (apply same query for filtered count)
  let total: number | undefined = undefined
  let filteredCount: number | undefined = undefined;

  try {
    // Total count of all documents (regardless of search)
    total = await castRecords.estimatedDocumentCount();
    // Count of documents matching the search query
    filteredCount = await castRecords.countDocuments(query);
  } catch {
    // ignore errors during counting
  }

  // Normalize data for consumption by the frontend.
  const items = list.map((d: any) => ({
    id: d?._id?.toString?.() ?? null,
    metadataId: d?.metadata_id?.toString?.() ?? d?.metadataId ?? null,
    // Pass through common fields for convenience
    time: d?.time ?? d?.timestamp ?? d?.date ?? null,
    lat: d?.lat ?? d?.latitude ?? d?.position?.lat ?? d?.geo?.lat ?? null,
    lon: d?.lon ?? d?.longitude ?? d?.position?.lon ?? d?.geo?.lon ?? null,
    depth: d?.depth ?? d?.maxDepth ?? d?.minDepth ?? null,
    size: d?.approxSize ?? d?.size ?? d?.payloadSize ?? null,
    cast: d?.cast_data ?? d?.cast ?? null,
    raw: d, // Crucially, include the raw document for detailed data access
  }))

  return NextResponse.json({
    items,
    count: items.length,
    total: total,
    filteredCount: filteredCount, // Used by frontend for pagination logic
    limit,
    page,
  })
}
