import multer from 'multer';

const storage = multer.memoryStorage();

// Seller verification documents (GST certificate, PAN card, address proof)
// are commonly scanned as PDFs, not just photos — unlike product/avatar
// images, this accepts both.
const uploadDocument = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      return cb(new Error('Only image or PDF files are allowed'));
    }
    cb(null, true);
  },
});

export default uploadDocument;
