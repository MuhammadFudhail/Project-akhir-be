const express = require("express");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const {
  getDashboardData,
  getUserDashboardData,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskCheckList,
  getPrioritizedTasks,
  getEfficiencyReport ,
} = require("../controllers/taskController");

const router = express.Router();

/**
 * Semua route memakai `protect` agar hanya user login yang bisa akses.
 * Admin divisi bisa buat & hapus task.
 * Karyawan hanya bisa melihat dan update task di divisinya sendiri.
 */

// Dashboard data per divisi
router.get("/dashboard-data", protect, adminOnly, getDashboardData);

// Dashboard data untuk user biasa (filtered by assignedTo)
router.get("/user-dashboard-data", protect, getUserDashboardData);

// Task prioritas (Low, Medium, High)
router.get("/prioritized", protect, getPrioritizedTasks);

// Semua task dalam divisi
router.get("/", protect, getTasks);

router.get("/efficiency", protect, adminOnly, getEfficiencyReport);


// Detail task by ID (cek divisi dalam controller)
router.get("/:id", protect, getTaskById);

// Hanya admin divisi bisa buat task
router.post("/", protect, adminOnly, createTask);

// Update task — boleh admin atau user yg ditugaskan
router.put("/:id", protect, updateTask);

// Hanya admin divisi bisa hapus task
router.delete("/:id", protect, adminOnly, deleteTask);

// Update status task (misalnya "In Progress", "Completed")
router.put("/:id/status", protect, updateTaskStatus);

// Update checklist task (progress item)
router.put("/:id/todo", protect, updateTaskCheckList);

module.exports = router;
