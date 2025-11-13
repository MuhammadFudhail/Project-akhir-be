const multer = require("multer");

// Konfigurasi penyimpanan file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // folder penyimpanan
  },
  filename: (req, file, cb) => {
    // tambahkan timestamp agar nama file unik
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Filter file agar hanya menerima gambar
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only .jpeg, .jpg, and .png formats are allowed"), false);
  }
};

// Buat instance multer dengan konfigurasi di atas
const upload = multer({ storage, fileFilter });

module.exports = upload;
