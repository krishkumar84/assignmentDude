import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please add your MongoDB URI to .env.local");
}

interface MongoConnection {
  client: MongoClient | null;
  db: Db | null;
}

// Extend global interface for MongoDB client caching
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoConnection: MongoConnection | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement)
  if (!global._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise
export const getClient = async (): Promise<MongoClient> => {
  return clientPromise;
};

// Export a function to get the database
export const getDatabase = async (dbName: string = "tutedude"): Promise<Db> => {
  const client = await getClient();
  return client.db(dbName);
};

// For backward compatibility
export const connect = getClient;
