import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  accountName:   { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  accountCode:   { type: String, default: '' },
  type:          { type: String, enum: ['DEPOSIT', 'WITHDRAW'], default: 'DEPOSIT' },
  isActive:      { type: Boolean, default: true },
  isSMS:         { type: Boolean, default: false },
  isAuto:        { type: Boolean, default: true },
  secret:        { type: String, default: '' },
}, { timestamps: true });

export const Wallet: any =
  mongoose.models.Wallet || mongoose.model('Wallet', schema);
