import mongoose from 'mongoose';

const uri = 'mongodb+srv://JC:Admin123456@cluster0.eeg1nsx.mongodb.net/med-reminder?retryWrites=true&w=majority&appName=Cluster0';

console.log('Testing connection...');

mongoose.connect(uri)
  .then(() => {
    console.log('SUCCESS - Connected to MongoDB!');
    process.exit(0);
  })
  try {
  await run();
} catch (error) {
  console.error(error);
  process.exit(1);
}