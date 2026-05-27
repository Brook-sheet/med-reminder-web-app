import mongoose from 'mongoose';

export async function generateUniquePatientId(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  // Use the already-connected mongoose connection directly
  // to avoid circular import issues with the User model
  const UserModel = mongoose.models.User || mongoose.model(
    'User',
    new mongoose.Schema({ patientId: String })
  );

  for (let attempt = 0; attempt < 10; attempt++) {
    let id = 'PT-';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const existing = await UserModel.findOne({ patientId: id }).select('_id').lean();
    if (!existing) return id;
  }

  throw new Error('Failed to generate unique Patient ID after 10 attempts');
}