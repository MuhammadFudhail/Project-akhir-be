require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../models/User"); // ✅ dibetulkan
const Task = require("../models/Task"); // ✅ dibetulkan

async function run() {
  try {
    await connectDB();

    console.log("MongoDB connected");
    console.log("Memulai migrasi data division...");

    // 🔹 Update user yang belum punya division
    const userResult = await User.updateMany(
      { division: { $exists: false } },
      { $set: { division: "PRQ" } }
    );

    // 🔹 Update task yang belum punya division
    const taskResult = await Task.updateMany(
      {
        $or: [
          { division: { $exists: false } },
          { division: null },
          { division: "" }
        ]
      },
      { $set: { division: "PRQ" } }
    );
    console.log("user diperbarui:", userResult.modifiedCount);
    console.log("task diperbarui:", taskResult.modifiedCount);

    if (userResult.modifiedCount === 0) {
         console.log("tidak ada user yang perlu diperbarui semua sudah memiliki divisi");
    }
      if (taskResult.modifiedCount === 0) {
         console.log("tidak ada task yang perlu diperbarui semua sudah memiliki divisi");
    }

    console.log("Migrasi selesai tanpa error.");
    process.exit(0);
  } catch (error) {
    console.error("Terjadi error saat migrasi:", error);
    process.exit(1);
  }
}

run();
