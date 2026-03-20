const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalOCR: {
    type: String,
    required: true
  },
  correctedData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  extractedFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  accuracyScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  languageDetected: {
    type: String,
    default: 'en'
  },
  fileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  processingTime: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  metadata: {
    ocrEngine: { type: String, default: 'deepseek' },
    llmModel: { type: String, default: 'deepseek' },
    version: { type: String, default: '1.0' }
  }
}, {
  timestamps: true
});

// Index for better query performance
invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ accuracyScore: 1 });

// Calculate accuracy method
invoiceSchema.methods.calculateAccuracy = function(originalText, correctedData) {
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

// Static method for analytics
invoiceSchema.statics.getAnalytics = async function(userId = null) {
  const matchCondition = userId ? { userId } : {};
  
  const stats = await this.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        completedInvoices: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        averageAccuracy: { $avg: '$accuracyScore' },
        totalAmount: { $sum: '$correctedData.totalAmount' },
        averageProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);
  
  return stats[0] || {
    totalInvoices: 0,
    completedInvoices: 0,
    averageAccuracy: 0,
    totalAmount: 0,
    averageProcessingTime: 0
  };
};

module.exports = mongoose.model('Invoice', invoiceSchema);
