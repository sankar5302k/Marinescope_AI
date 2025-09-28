export type RepoKey = "ocean" | "taxonomy" | "edna"
export type PreprocessStatus = "done" | "pending"

export interface FileRecord {
  id: string
  name: string
  category: RepoKey
  type: "CSV" | "NetCDF" | "DNA" | "Other"
  sizeBytes: number
  status: PreprocessStatus
  obisCompliant: boolean
  uploadedAt: string // ISO string
}

const store: { files: FileRecord[] } = {
  files: [],
}

export function listFiles(): FileRecord[] {
  // newest first
  return [...store.files].sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
}

export function addFile(input: Omit<FileRecord, "id" | "uploadedAt">): FileRecord {
  const id = crypto.randomUUID()
  const uploadedAt = new Date().toISOString()
  const record: FileRecord = { id, uploadedAt, ...input }
  store.files.push(record)
  return record
}
