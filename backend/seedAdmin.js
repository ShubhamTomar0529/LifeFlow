import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "./models/adminModel.js";

dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected "))
  .catch(err => console.error(err));

const seedAdmin = async () => {
  try {
    await Admin.deleteMany({ email: "shubham@admin.com" });

    const admin = new Admin({
      name: "Admin",
      email: "shubham@admin.com",
      password: "123456", 
      role: "admin",
    });

    await admin.save();
    console.log("Admin seeded successfully");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedAdmin();
