const Task = require("../models/Task");
const User = require("../models/User");

const divisionFilter = (req) => {
    return req.user.role === "admin"
    ? { division: req.user.division} : { assignedTo: { $in: [req.user._id]}, division: req.user.division}
};

const validateAssignedUsers = async (assignedTo = [], division) => {
    if (!Array.isArray(assignedTo)) return { ok: false, message: "assigned to harus array" };
    if (assignedTo.length === 0) return { ok: false, message: "assignedto tidak boleh kosong" };


    const users = await User.find({ _id: { $in: assignedTo } }).select("division");
    if (users.length !== assignedTo.length) {
        return { ok: false, message: "beberapa assignedto user tidak ditemukan"};
    }

    const invalid = users.find((u) => u.division !== division);
    if(invalid) {
        return { ok: false, message: "assigned ti user harus berada di divisi yang sama" };
    }

    return { ok: true };
}


// Prioritize tasks with Greedy Algorithm
const getPrioritizedTasks = async (req, res) => {
    try {

        const baseFilter = divisionFilter(req);
        // const isAdmin = req.user.role === "admin";
        // const roleFilter = isAdmin ? {} : { assignedTo: { $in: [req.user._id] } };

        let tasks = await Task.find(baseFilter).populate("assignedTo", "name email profileImageUrl");

        const today = new Date();

        // Konversi priority ke angka
        const priorityScore = { Low: 1, Medium: 2, High: 3 };

        const scoredTasks = tasks.map(task => {
            const dueDate = new Date(task.dueDate);
            const daysLeft = Math.max(1, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));

            const score = (priorityScore[task.priority] || 0) * 7 + (10 / daysLeft);

            const taskObj = task.toObject();
            taskObj.priorityScore = score;
            return taskObj;
        });

        // Urutkan berdasarkan skor (desc)
        scoredTasks.sort((a, b) => b.priorityScore - a.priorityScore);
        console.log("Scored tasks:", scoredTasks);

        res.status(200).json(scoredTasks);
    } catch (error) {
        console.error("Error in getPrioritizedTasks:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get all tasks with optional status filter
const getTasks = async (req, res) => {
  try {
    const { status } = req.query;
    const baseFilter = divisionFilter(req); // hanya data di divisinya
    const statusFilter = status ? { status } : {};
    const filter = { ...baseFilter, ...statusFilter };

    let tasks = await Task.find(filter).populate("assignedTo", "name email profileImageUrl");

    // Tambahkan completedTodoCount
    tasks = tasks.map(task => {
      const completedCount = task.todoCheckList.filter(item => item.completed).length;
      const taskObj = task.toObject();
      taskObj.completedTodoCount = completedCount;
      return taskObj;
    });

    // Summary by status (pakai baseFilter, bukan roleFilter)
    const [all, pendingTasks, inProgressTasks, completedTasks] = await Promise.all([
      Task.countDocuments(baseFilter),
      Task.countDocuments({ ...baseFilter, status: "Pending" }),
      Task.countDocuments({ ...baseFilter, status: "In Progress" }),
      Task.countDocuments({ ...baseFilter, status: "Completed" }),
    ]);

    res.status(200).json({
      tasks,
      statusSummary: { all, pendingTasks, inProgressTasks, completedTasks },
    });
  } catch (error) {
    console.error("Error in getTasks:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get task by ID
const getTaskById = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === "admin";

        //filter pembatas berdarkan role divis
        const filter = isAdmin
        ? { _id: id, division: req.user.division } //admin hanya bisa melihat divisnnya
        : { _id: id, assignedTo: { $in: [req.user._id] }, division: req.user.division }; // user hanya lihat tugasnya sendiri di divisinya
       
        const task = await Task.findOne(filter).populate("assignedTo", "name email profileImageUrl");

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const completedCount = task.todoCheckList.filter(item => item.completed).length;
        const taskObj = task.toObject();
        taskObj.completedTodoCount = completedCount;

        res.status(200).json(taskObj);
    } catch (error) {
        console.error("Error in getTaskById:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Create new task
const createTask = async (req, res) => {
    try {
        const {
            title,
            description,
            priority,
            dueDate,
            assignedTo,
            // attachments,
            todoCheckList,
        } = req.body;

        // Validasi wajib
        if (!title || !dueDate || !assignedTo) {
            return res.status(400).json({ message: "Title, dueDate, and assignedTo are required" });
        }

        if (!Array.isArray(assignedTo) || assignedTo.length === 0) {
            return res.status(400).json({ message: "assignedTo must be a non-empty array of user IDs" });
        }

        // Validasi date format
        if (isNaN(Date.parse(dueDate))) {
            return res.status(400).json({ message: "Invalid dueDate format" });
        }

        // Validasi priority (opsional karena schema akan reject juga)
        const allowedPriorities = ["Low", "Medium", "High"];
        if (priority && !allowedPriorities.includes(priority)) {
            return res.status(400).json({ message: "Invalid priority value" });
        }

        // Optional: validasi todoCheckList isiannya benar
        if (todoCheckList && !Array.isArray(todoCheckList)) {
            return res.status(400).json({ message: "todoCheckList must be an array" });
        }

        const task = await Task.create({
            title,
            description,
            priority,
            dueDate,
            assignedTo,
            createdBy: req.user._id,
            division: req.user.division,
            todoCheckList,
         
        });

        res.status(201).json({ message: "Task created successfully", task });
    } catch (error) {
        console.error("Error in createTask:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


// Update task
const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === "admin";

        // Filter berdasarkan role dan divisi
        const filter = isAdmin
            ? { _id: id, division: req.user.division } // admin hanya ubah task divisinya
            : { _id: id, assignedTo: { $in: [req.user._id] }, division: req.user.division }; // user hanya ubah task miliknya di divisinya

        const task = await Task.findOne(filter);
        if (!task) return res.status(404).json({ message: "Task not found or access denied" });

        const {
            title,
            description,
            priority,
            dueDate,
            todoCheckList,
            status,
            assignedTo
        } = req.body;

        // Validasi nilai status & priority
        const allowedStatus = ["Pending", "In Progress", "Completed"];
        const allowedPriorities = ["Low", "Medium", "High"];

        if (status && !allowedStatus.includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        if (priority && !allowedPriorities.includes(priority)) {
            return res.status(400).json({ message: "Invalid priority value" });
        }

        if (assignedTo !== undefined && !Array.isArray(assignedTo)) {
            return res.status(400).json({ message: "assignedTo must be an array of user IDs" });
        }

        // Assign field jika ada
        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (priority !== undefined) task.priority = priority;
        if (dueDate !== undefined) task.dueDate = dueDate;
        if (assignedTo !== undefined) task.assignedTo = assignedTo;

        // 🧩 Logika untuk todo checklist + auto update status
        if (todoCheckList !== undefined && Array.isArray(todoCheckList)) {
            const prevTodos = task.todoCheckList || [];
            const prevLength = prevTodos.length;
            const newLength = todoCheckList.length;

            // Update todo list
            task.todoCheckList = todoCheckList;

            // Hitung progress
            if (newLength > 0) {
                const doneCount = todoCheckList.filter((t) => t.completed).length;
                task.progress = Math.round((doneCount / newLength) * 100);
            } else {
                task.progress = 0;
            }

            // ⚙️ Logika otomatis ubah status
            if (newLength === 0) {
                // Tidak ada to-do sama sekali
                task.status = "Pending";
            } else {
                const allCompleted = todoCheckList.every((t) => t.completed);
                const isAddedNewTodo = newLength > prevLength;
                const isDeletedTodo = newLength < prevLength;

                if (isAddedNewTodo) {
                    // Kalau admin nambah todo baru
                    task.status = "In Progress";
                } else if (isDeletedTodo && allCompleted) {
                    // Kalau admin hapus to-do dan sisa semua completed
                    task.status = "Completed";
                } else if (!allCompleted) {
                    // Kalau belum semua selesai
                    task.status = "In Progress";
                }
            }
        }

        // Kalau user ubah status manual, tetap diperbolehkan
        if (status !== undefined && !todoCheckList) {
            task.status = status;
        }

        const updatedTask = await task.save();
        res.json({ message: "Task updated successfully", updatedTask });
    } catch (error) {
        console.error("Error in updateTask:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


// Delete task

const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === "admin";

        const filter = isAdmin
        ? { _id: id, division: req.user.division }
        : { _id: id, assignedTo: { $in: [req.user._id] }, division: req.user.division}
        
        const task = await Task.findOne(filter);
        if (!task) return res.status(404).json({ message: "Task not found" });

        await task.deleteOne(); // atau: await Task.findByIdAndDelete(req.params.id);
        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        console.error("Error in deleteTask:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};



const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === "admin";

        const filter = isAdmin
            ? { _id: id, division: req.user.division }
            : { _id: id, assignedTo: { $in: [req.user._id] }, division: req.user.division };
        
        const task = await Task.findOne(filter);
        if (!task) return res.status(404).json({ message: "Task not found or access denied" });


        // Update status
        const newStatus = req.body.status;
        if (newStatus) {
            task.status = newStatus;
        }

        if (task.status === "Completed") {
            task.completedAt = new Date();
            task.todoCheckList.forEach(item => item.completed = true);
            task.progress = 100;
        }

        await task.save();
        res.json({ message: "Task status updated", task });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update checklist
const updateTaskCheckList = async (req, res) => {
    try {
        const { todoCheckList } = req.body;
        const { id } = req.params;
        const userId = req.user._id;
        const isAdmin = req.user.role === "admin";

        const task = await Task.findById(id);
        if (!task) return res.status(404).json({ message: "Task not found" });

       
        const isAssigned = task.assignedTo.includes(userId);
        if (!isAssigned && !isAdmin) {
            return res.status(403).json({ message: "Not authorized to update checklist" });
        }


        task.todoCheckList = todoCheckList;

        const completedCount = todoCheckList.filter(item => item.completed).length;
        const totalItems = todoCheckList.length;
        task.progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

        if (task.progress === 100) {
            task.status = "Completed";
            task.completedAt = new Date();
        } else if (task.progress > 0) {
            task.status = "In Progress";
        } else {
            task.status = "Pending";
        }

        await task.save();

        const updatedTask = await Task.findById(req.params.id).populate("assignedTo", "name email profileImageUrl");
        res.json({ message: "Task checklist updated", task: updatedTask });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Dashboard data
// Dashboard data (fixed)
const getDashboardData = async (req, res) => {
  try {
    // Debug: pastikan user dan filter benar
    console.log("getDashboardData - user:", req.user);
    const filter = divisionFilter(req);
    console.log("getDashboardData - filter:", JSON.stringify(filter));

    // Statistik utama — PASTIKAN pakai filter
    const totalTasks = await Task.countDocuments(filter);
    const pendingTasks = await Task.countDocuments({ ...filter, status: "Pending" });
    const completedTasks = await Task.countDocuments({ ...filter, status: "Completed" });
    const overDueTasks = await Task.countDocuments({
      ...filter,
      status: { $ne: "Completed" },
      dueDate: { $lt: new Date() },
    });

    // Distribusi status — agregasi dengan $match filter
    const taskStatuses = ["Pending", "In Progress", "Completed"];
    const taskDistributeRaw = await Task.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const taskDistribution = taskStatuses.reduce((acc, status) => {
      const formattedKey = status.replace(/\s+/g, "");
      acc[formattedKey] = taskDistributeRaw.find(item => item._id === status)?.count || 0;
      return acc;
    }, {});
    taskDistribution["All"] = totalTasks;

    // Distribusi priority (sudah pakai match)
    const taskPriorities = ["Low", "Medium", "High"];
    const taskPrioritiesRaw = await Task.aggregate([
      { $match: filter },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    const taskPrioritiesLevels = taskPriorities.reduce((acc, priority) => {
      acc[priority] = taskPrioritiesRaw.find(item => item._id === priority)?.count || 0;
      return acc;
    }, {});

    // Recent tasks — pastikan pakai filter (hanya divisi atau assigned sesuai filter)
    const recentTasks = await Task.find(filter)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title status priority dueDate createdAt division");

    res.status(200).json({
      statistics: {
        totalTasks,
        pendingTasks,
        completedTasks,
        overDueTasks,
      },
      charts: {
        taskDistribution,
        taskPrioritiesLevels,
      },
      recentTasks,
    });
  } catch (error) {
    console.error("Error in getDashboardData:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// User-specific dashboard
const getUserDashboardData = async (req, res) => {
    try {
        const isAdmin = req.user.role === "admin";
        const userId = req.user._id;
        
    // Filter otomatis berdasarkan role
        const filter = isAdmin
            ? { division: req.user.division } // admin lihat semua task di divisinya
            : { assignedTo: userId }; // user hanya lihat task miliknya sendiri

    
        const totalTasks = await Task.countDocuments(filter);
        const pendingTasks = await Task.countDocuments({ ...filter, status: "Pending" });
        const completedTasks = await Task.countDocuments({ ...filter, status: "Completed" });
        const overDueTasks = await Task.countDocuments({
        ...filter,
        status: { $ne: "Completed" },
        dueDate: { $lt: new Date() },
        });


       
        const taskStatuses = ["Pending", "In Progress", "Completed"];
        const taskDistributeRaw = await Task.aggregate([
            { $match: filter },
            { $group: { _id: "$status", count: { $sum: 1 } } },
            ]);


        const taskDistribution = taskStatuses.reduce((acc, status) => {
            const formattedKey = status.replace(/\s+/g, "");
            acc[formattedKey] = taskDistributeRaw.find(item => item._id === status)?.count || 0;
            return acc;
        }, {});
        taskDistribution["All"] = totalTasks;

        const taskPriorities = ["Low", "Medium", "High"];
        const taskPrioritiesLevelsRaw = await Task.aggregate([
       
            { $match: filter },
            { $group: { _id: "$priority", count: { $sum: 1 } } },
        ]);

        const taskPrioritiesLevels = taskPriorities.reduce((acc, priority) => {
            acc[priority] =
                taskPrioritiesLevelsRaw.find((item) => item._id === priority)?.count || 0;
            return acc;
        }, {});

        const recentTasks = await Task.find(filter)
            .sort({ createdAt: -1 })
            .limit(10)
            .select("title status priority dueDate createdAt");

        res.status(200).json({
            statistics: {
                totalTasks,
                pendingTasks,
                completedTasks,
                overDueTasks,
            },
            charts: {
                taskDistribution,
                taskPrioritiesLevels,
            },
            recentTasks,
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


const getEfficiencyReport = async (req, res) => {
  try {
    const { type } = req.query; // weekly | monthly
    const filter = divisionFilter(req);

    const now = new Date();
    let startDate;

    if (type === "weekly") {
      startDate = new Date();
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const tasks = await Task.find({
      ...filter,
      status: "Completed",
      completedAt: { $gte: startDate, $lte: now }
    });

    let onTime = 0;
    let late = 0;

    tasks.forEach(task => {
      if (task.completedAt <= task.dueDate) {
        onTime++;
      } else {
        late++;
      }
    });

    const total = tasks.length;
    const efficiency = total === 0 ? 0 : Math.round((onTime / total) * 100);

    res.json({
      period: type,
      totalCompleted: total,
      onTime,
      late,
      efficiency
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    updateTaskCheckList,
    getDashboardData,
    getUserDashboardData,
    getPrioritizedTasks,
    getEfficiencyReport,
};
