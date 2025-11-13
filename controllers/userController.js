const Task = require("../models/Task")
const User = require("../models/User")
const bcrypt = require("bcryptjs")

//desc get all user (admin only)
//desc get/api/users/
//acces private (admin)
const getUsers = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";

    // Admin hanya bisa melihat user di dalam divisinya sendiri
    const filter = isAdmin
      ? { role: "member", division: req.user.division }
      : { _id: req.user._id }; // kalau bukan admin, hanya bisa lihat dirinya sendiri

    const users = await User.find(filter).select("-password");

    // Tambahkan task count untuk setiap user
    const usersWithTaskCounts = await Promise.all(
      users.map(async (user) => {
        const pendingTasks = await Task.countDocuments({
          assignedTo: user._id,
          status: "Pending", // perhatikan: "Pending" huruf besar P-nya
        });
        const inProgressTasks = await Task.countDocuments({
          assignedTo: user._id,
          status: "In Progress",
        });
        const completedTasks = await Task.countDocuments({
          assignedTo: user._id,
          status: "Completed",
        });

        return {
          ...user._doc,
          pending: pendingTasks,
          inProgress: inProgressTasks,
          completed: completedTasks,
        };
      })
    );

    res.json(usersWithTaskCounts);
  } catch (error) {
    console.error("Error in getUsers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

//desc get user by id (admin only)
//desc get/api/users/:id
//acces private (admin)
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "server error", error: error.message });
    }
};

//desc get user by id (admin only)
//desc get/api/users/:id
//acces private (admin)
// const deleteUser = async (req, res) => {
//    try {
//         const user = await User.findByIdAndDelete(req.params.id);
//         if (!user) {
//             return res.status(404).json({ message: "User not found" });
//         }
//         res.json({ message: "User deleted successfully" });
//     } catch (error) {
//         res.status(500).json({ message: "server error", error: error.message });
//     }
// };

module.exports = { getUsers, getUserById };