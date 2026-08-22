import mongoose from "mongoose";

export async function generateUniqueFamilyId(): Promise<string> {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const UserModel =
    mongoose.models.User ||
    mongoose.model(
      "User",
      new mongoose.Schema({
        familyId: String,
      })
    );

  for (
    let attempt = 0;
    attempt < 10;
    attempt++
  ) {
    let id = "FM-";

    for (
      let index = 0;
      index < 6;
      index++
    ) {
      id += characters.charAt(
        Math.floor(
          Math.random() *
            characters.length
        )
      );
    }

    const existing =
      await UserModel.findOne({
        familyId: id,
      })
        .select("_id")
        .lean();

    if (!existing) {
      return id;
    }
  }

  throw new Error(
    "Failed to generate unique Family ID after 10 attempts"
  );
}