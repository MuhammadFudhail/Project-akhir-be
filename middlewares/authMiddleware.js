const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware untuk proteksi route (akses harus login)
const protect = async (req, res, next) => {
  try {
    let token = req.headers.authorization;

    // Pastikan token ada dan diawali dengan 'Bearer ' (dengan spasi)
    if (token && token.startsWith("Bearer ")) {
      // Ambil token dari header (split spasi)
      token = token.split(" ")[1];

      // Verifikasi token dengan secret dari .env
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Cari user berdasarkan ID dari token, exclude password
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }
  // Pastikan user memiliki division (penting untuk filter per divisi)
      if (!req.user.division) {
        return res.status(400).json({ message: "User division not assigned" });
      }

      next();
     } else {
      return res.status(401).json({ message: "Not authorized, no token provided" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Invalid or expired token", error: error.message });
  }
};

// Middleware: hanya admin yang bisa mengakses route tertentu
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({ message: "Access denied, admin only" });
  }
};

// Middleware opsional: cek apakah user berasal dari divisi yang sama
const sameDivisionOnly = (req, res, next) => {
  const userDivision = req.user.division;
  const targetDivision = req.params.division || req.body.division || userDivision;

  if (targetDivision === userDivision) {
    return next();
  } else {
    return res.status(403).json({ message: "Access denied, different division" });
  }
};


module.exports = { protect, adminOnly, sameDivisionOnly };
