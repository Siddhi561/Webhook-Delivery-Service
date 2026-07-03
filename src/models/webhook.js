import mongoose from 'mongoose';

const webhookSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    secret: { type: String, required: true },
    events: { type: [String], required: true },
    isActive: { type: Boolean, default: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.models.Webhook || mongoose.model('Webhook', webhookSchema);