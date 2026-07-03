import mongoose from 'mongoose';

const deliverySchema = new mongoose.Schema(
  {
    webhookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Webhook', required: true },
    event: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    responseStatus: { type: Number, default: null },
    responseBody: { type: String, default: null },
    errorMessage: { type: String, default: null },
    nextRetryAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Delivery || mongoose.model('Delivery', deliverySchema);