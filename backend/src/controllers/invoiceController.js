const Invoice = require('../models/Invoice');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, PNG, and PDF files are allowed'));
    }
  }
});

// Generate response helper
const generateResponse = (success, message, data = null) => {
  return { success, message, data };
};

const OUTPUT_DIR = process.env.OCR_OUTPUT_DIR || path.join(process.cwd(), '..', 'output');
const OCR_STRICT_DEEP = true;

// Upload and process invoice
const uploadInvoice = async (req, res) => {
  try {
    const uploadSingle = upload.single('invoice');
    
    uploadSingle(req, res, async (err) => {
      if (err) {
        return res.status(400).json(generateResponse(false, err.message));
      }

      if (!req.file) {
        return res.status(400).json(generateResponse(false, 'No file uploaded'));
      }

      const startTime = Date.now();
      const userId = req.user._id;
      const uploadOutputDir = path.join(OUTPUT_DIR, 'runs', path.parse(req.file.filename).name);

      if (!fs.existsSync(uploadOutputDir)) {
        fs.mkdirSync(uploadOutputDir, { recursive: true });
      }

      try {
        // Step 1: Run OCR
        const ocrResult = await runOCR(req.file.path, uploadOutputDir);

        // Step 2: Require JSON exported by deep.py (validated_clean.json).
        const validatedOutput = readValidatedCleanOutput(uploadOutputDir);
        if (!validatedOutput) {
          throw new Error('DeepSeek OCR JSON output not found for uploaded image');
        }

        const correctedResult = mapValidatedCleanToFrontend(validatedOutput);

        const originalOcrText = ocrResult.text || JSON.stringify(ocrResult);
        
        // Step 3: Calculate accuracy
        const accuracy = calculateAccuracy(originalOcrText, correctedResult);

        // Step 4: Save invoice
        const invoice = new Invoice({
          userId,
          originalOCR: originalOcrText,
          correctedData: correctedResult,
          extractedFields: correctedResult,
          accuracyScore: accuracy,
          languageDetected: ocrResult.language || 'en',
          fileName: req.file.originalname,
          filePath: req.file.path,
          fileSize: req.file.size,
          processingTime: Date.now() - startTime,
          status: 'completed'
        });

        await invoice.save();

        res.json(generateResponse(true, 'Invoice processed successfully', {
          invoice,
          correctedData: correctedResult,
          validatedOutput,
          accuracy
        }));

      } catch (processingError) {
        console.error('Processing error:', processingError);

        const fallbackCorrectedData = {
          invoiceNumber: 'N/A',
          vendorName: 'N/A',
          vendorTaxId: '',
          customerName: 'N/A',
          customerTaxId: '',
          invoiceDate: null,
          subtotal: 0,
          taxTotal: 0,
          totalAmount: 0,
          currency: 'INR',
          items: []
        };
        
        // Save failed invoice
        const invoice = new Invoice({
          userId,
          originalOCR: processingError.message || 'OCR processing failed',
          correctedData: fallbackCorrectedData,
          extractedFields: fallbackCorrectedData,
          fileName: req.file.originalname,
          filePath: req.file.path,
          fileSize: req.file.size,
          processingTime: Date.now() - startTime,
          status: 'failed'
        });

        try {
          await invoice.save();
        } catch (saveError) {
          console.error('Failed to persist failed invoice record:', saveError);
        }

        res.status(500).json(generateResponse(false, 'DeepSeek OCR2 processing failed for uploaded image', {
          invoice,
          correctedData: fallbackCorrectedData,
          accuracy: 0
        }));
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json(generateResponse(false, 'Server error during upload'));
  }
};

// Save edited invoice
const saveInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { correctedData, extractedFields } = req.body;

    const invoice = await Invoice.findOne({ _id: id, userId: req.user._id });
    
    if (!invoice) {
      return res.status(404).json(generateResponse(false, 'Invoice not found'));
    }

    // Update invoice
    invoice.correctedData = correctedData;
    invoice.extractedFields = extractedFields || correctedData;
    invoice.isEdited = true;
    invoice.editedAt = new Date();
    
    // Recalculate accuracy
    invoice.accuracyScore = calculateAccuracy(invoice.originalOCR, correctedData);

    await invoice.save();

    res.json(generateResponse(true, 'Invoice saved successfully', { invoice }));
  } catch (error) {
    console.error('Save invoice error:', error);
    res.status(500).json(generateResponse(false, 'Server error saving invoice'));
  }
};

// Get user's invoices
const getMyInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const invoices = await Invoice.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Invoice.countDocuments({ userId: req.user._id });

    res.json(generateResponse(true, 'Invoices retrieved successfully', {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json(generateResponse(false, 'Server error retrieving invoices'));
  }
};

// Get invoice by ID
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({ _id: id, userId: req.user._id });
    
    if (!invoice) {
      return res.status(404).json(generateResponse(false, 'Invoice not found'));
    }

    res.json(generateResponse(true, 'Invoice retrieved successfully', { invoice }));
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json(generateResponse(false, 'Server error retrieving invoice'));
  }
};

// Delete invoice
const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({ _id: id, userId: req.user._id });
    
    if (!invoice) {
      return res.status(404).json(generateResponse(false, 'Invoice not found'));
    }

    // Delete file
    if (fs.existsSync(invoice.filePath)) {
      fs.unlinkSync(invoice.filePath);
    }

    await Invoice.findByIdAndDelete(id);

    res.json(generateResponse(true, 'Invoice deleted successfully'));
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json(generateResponse(false, 'Server error deleting invoice'));
  }
};

// Get user analytics
const getMyAnalytics = async (req, res) => {
  try {
    const analytics = await Invoice.getAnalytics(req.user._id);
    
    res.json(generateResponse(true, 'Analytics retrieved successfully', { analytics }));
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json(generateResponse(false, 'Server error retrieving analytics'));
  }
};

// Helper functions
const runOCR = (imagePath, outputDir = OUTPUT_DIR) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), '..', 'python', 'deep.py');
    const python = spawn(process.env.PYTHON_PATH || 'python', [pythonScript, imagePath, outputDir]);
    
    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`OCR script failed: ${error}`));
        return;
      }

      try {
        const result = extractJsonFromOutput(output);
        resolve(result);
      } catch (parseError) {
        // Fallback for non-JSON output
        resolve({ text: output, language: 'en' });
      }
    });
  });
};

const readValidatedCleanOutput = (outputDir) => {
  try {
    const validatedCleanPath = path.join(outputDir, 'validated_clean.json');

    if (!fs.existsSync(validatedCleanPath)) {
      return null;
    }

    const raw = fs.readFileSync(validatedCleanPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to read validated_clean.json:', error.message);
    return null;
  }
};

const normalizeDateToISO = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const m = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;

  if (!day || !month || !year) return null;
  return `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const mapValidatedCleanToFrontend = (validated) => {
  const products = Array.isArray(validated?.Products) ? validated.Products : [];

  const items = products.map((item) => ({
    description: item.Name_of_Product || '',
    quantity: toNumber(item.Qty, 1),
    unitPrice: toNumber(item.Rate, 0),
    totalPrice: toNumber(item.Amount, 0),
    cgstPercent: toNumber(item.CGST_Percent, 0),
    sgstPercent: toNumber(item.SGST_Percent, 0),
    igstPercent: toNumber(item.IGST_Percent, 0),
    taxRate:
      toNumber(item.CGST_Percent, 0) +
      toNumber(item.SGST_Percent, 0) +
      toNumber(item.IGST_Percent, 0),
    taxAmount: 0
  }));

  const subtotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const totalAmount = toNumber(validated?.Grand_Total, subtotal);

  return {
    invoiceNumber: validated?.Invoice_No || 'N/A',
    vendorName: validated?.Seller_Name || 'N/A',
    vendorTaxId: validated?.Seller_GSTIN || '',
    customerName: validated?.Buyer_Name || 'N/A',
    customerTaxId: validated?.Buyer_GSTIN || '',
    invoiceDate: normalizeDateToISO(validated?.Invoice_Date),
    subtotal,
    taxTotal: Math.max(totalAmount - subtotal, 0),
    totalAmount,
    currency: 'INR',
    items,
    notes: ''
  };
};

const extractJsonFromOutput = (rawOutput) => {
  const trimmed = String(rawOutput || '').trim();
  if (!trimmed) {
    throw new Error('Empty OCR output');
  }

  try {
    return JSON.parse(trimmed);
  } catch (_directParseError) {
    // Try progressively from the last JSON object marker.
    let idx = trimmed.lastIndexOf('{');
    while (idx !== -1) {
      const candidate = trimmed.slice(idx).trim();
      try {
        return JSON.parse(candidate);
      } catch (_candidateParseError) {
        idx = trimmed.lastIndexOf('{', idx - 1);
      }
    }
  }

  throw new Error('No JSON object found in OCR output');
};

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeGstinCandidate = (raw) => {
  const value = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (value.length < 15) return null;

  const digitMap = { O: '0', I: '1', L: '1', S: '5', Z: '2', B: '8', G: '6', Q: '0' };
  const alphaMap = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G' };

  for (let start = 0; start <= value.length - 15; start++) {
    const chars = value.slice(start, start + 15).split('');

    // 1-2 digits (state code)
    for (let i = 0; i <= 1; i++) chars[i] = digitMap[chars[i]] || chars[i];
    // 3-7 letters (PAN alpha part)
    for (let i = 2; i <= 6; i++) chars[i] = alphaMap[chars[i]] || chars[i];
    // 8-11 digits (PAN numeric part)
    for (let i = 7; i <= 10; i++) chars[i] = digitMap[chars[i]] || chars[i];
    // 12 letter (PAN check)
    chars[11] = alphaMap[chars[11]] || chars[11];
    // 13 digit (entity)
    chars[12] = digitMap[chars[12]] || chars[12];
    // 14 fixed Z
    if (chars[13] !== 'Z') {
      if (chars[13] === '2') chars[13] = 'Z';
    }

    const candidate = chars.join('');
    if (/^\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z0-9]$/.test(candidate)) {
      return candidate;
    }
  }

  return null;
};

const extractGstinsFromText = (text) => {
  const tokens = String(text || '').toUpperCase().match(/[A-Z0-9]{14,20}/g) || [];
  const normalized = [];

  for (const token of tokens) {
    const gst = normalizeGstinCandidate(token);
    if (gst && !normalized.includes(gst)) normalized.push(gst);
  }

  return normalized;
};

// DeepSeek OCR2-only flow: no alternate OCR/heuristic fallback mappers.

const runLLMCorrection = (ocrText) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), '..', 'python', 'llm_correct.py');
    const python = spawn(process.env.PYTHON_PATH || 'python', [pythonScript, ocrText]);
    
    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`LLM correction script failed: ${error}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        resolve(result);
      } catch (parseError) {
        // Fallback for non-JSON output
        resolve({ invoiceNumber: 'N/A', vendorName: 'N/A', totalAmount: 0 });
      }
    });
  });
};

const calculateAccuracy = (originalText, correctedData) => {
  const original = originalText.toLowerCase().replace(/\s+/g, '');
  const corrected = JSON.stringify(correctedData).toLowerCase().replace(/\s+/g, '');
  
  if (original.length === 0) return 0;
  
  let matches = 0;
  const minLength = Math.min(original.length, corrected.length);
  
  for (let i = 0; i < minLength; i++) {
    if (original[i] === corrected[i]) {
      matches++;
    }
  }
  
  return Math.round((matches / original.length) * 100);
};

module.exports = {
  uploadInvoice,
  saveInvoice,
  getMyInvoices,
  getInvoiceById,
  deleteInvoice,
  getMyAnalytics
};
