import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'your-mongodb-uri-here';

async function run() {
  console.log('Testing connection...');
  await mongoose.connect(uri);
  console.log('SUCCESS - Connected to MongoDB!');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});