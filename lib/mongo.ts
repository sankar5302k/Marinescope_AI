import { MongoClient, GridFSBucket } from "mongodb"

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017"
const DB_NAME = process.env.MONGODB_DB || "wod_data_db"

let clientPromise: Promise<MongoClient>

if (!global.__mongoClientPromise) {
  const client = new MongoClient(MONGODB_URI)
  global.__mongoClientPromise = client.connect()
}
clientPromise = global.__mongoClientPromise

export async function getDb() {
  const client = await clientPromise
  return client.db(DB_NAME)
}

export async function getCollections() {
  const db = await getDb()
  // uploads: our app’s intake metadata
  // cast_records: written by the Python preprocessor (from your attachment)
  return {
    uploads: db.collection("uploads"),
    castRecords: db.collection("cast_records"),
  }
}

export async function getUploadsBucket() {
  const db = await getDb()
  return new GridFSBucket(db, { bucketName: "uploads" })
}
