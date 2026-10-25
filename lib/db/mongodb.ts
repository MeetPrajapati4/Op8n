import mongoose from 'mongoose';

/**
 * Global cached connection to prevent multiple connections in Next.js Turbopack / HMR
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Connects to MongoDB if MONGODB_URI is provided.
 * Gracefully returns null if no URI is configured or if connection cannot be established,
 * ensuring the application continues working offline/locally without crashing.
 */
export async function connectToDatabase(): Promise<typeof mongoose | null> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 2500, // Quick timeout to prevent stalling API requests
    };

    cached.promise = mongoose.connect(uri, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    console.warn('[Op8n MongoDB] Connection notice: Falling back to local/in-memory recommendation engine.', err instanceof Error ? err.message : err);
    return null;
  }
}
