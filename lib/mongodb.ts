import mongoose from 'mongoose';

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | undefined;
}

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in .env.local');
  }

  console.log('[MongoDB] Connecting to:', uri.substring(0, 40) + '...');

  if (global.mongooseCache?.conn) {
    console.log('[MongoDB] Using cached connection');
    return global.mongooseCache.conn;
  }

  if (!global.mongooseCache) {
    global.mongooseCache = { conn: null, promise: null };
  }

  if (!global.mongooseCache.promise) {
    global.mongooseCache.promise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }

  global.mongooseCache.conn = await global.mongooseCache.promise;
  console.log('[MongoDB] Connected successfully');
  return global.mongooseCache.conn;
}
