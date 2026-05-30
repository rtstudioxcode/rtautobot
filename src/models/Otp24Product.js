import mongoose from 'mongoose';

const Otp24ProductSchema = new mongoose.Schema({
  provider:  { type: String, default: 'otp24', index: true },

  // otp = บริการเช่า OTP เดิม, pack = แอคเคาท์/แอพจาก action=getpack
  productKind: { type: String, enum: ['otp', 'pack'], default: 'otp', index: true },

  // extId = id/code จากผู้ให้บริการ (อย่าเซ็ตเป็น null/'' เด็ดขาด)
  extId:     { type: String },
  itemId:    { type: String },
  code:      { type: String },
  typeCode:  { type: String, index: true },

  app:       { type: String, index: true },
  name:      { type: String, required: true, index: true },

  // ต้นทุนจาก OTP24HR — เก็บแยก ไม่ทับกับราคาขาย
  providerPrice: { type: Number, default: 0 },
  basePrice:     { type: Number, default: 0 },

  // ราคาขายที่ระบบบวกแล้ว เช่น +35%
  salePrice:     { type: Number, default: 0 },
  price:         { type: Number, default: 0 }, // compatibility กับโค้ดเดิม
  markupPercent: { type: Number, default: 35 },

  currency:  { type: String, default: 'THB' },
  country:   { type: String },
  category:  { type: String, index: true },

  img:       { type: String },
  imageSourceUrl: { type: String },
  imageCachedPath: { type: String },
  imageCachedAt: { type: Date },
  imageCacheStatus: { type: String, enum: ['pending','cached','failed'], default: 'pending' },
  imageCacheError: { type: String },
  exp:       { type: String },
  // stock snapshot จาก OTP24HR และ local adjustment หลังซื้อสำเร็จ
  amount:    { type: Number, default: 0, min: 0, index: true },
  sold:      { type: Number, default: 0, min: 0 },
  lastLocalStockUpdateAt: { type: Date },
  lastLocalStockRollbackAt: { type: Date },
  lastProviderStockSyncAt: { type: Date },
  msg:       { type: String },

  raw:       { type: mongoose.Schema.Types.Mixed },
  syncedAt:  { type: Date, default: Date.now },
}, { timestamps: true });

// unique เฉพาะเมื่อมี extId
Otp24ProductSchema.index({ provider: 1, extId: 1 }, { unique: true, sparse: true, name:'extId_1' });
Otp24ProductSchema.index({ provider: 1, productKind: 1, app: 1 });
Otp24ProductSchema.index({ provider: 1, productKind: 1, name: 1 });
Otp24ProductSchema.index({ provider: 1, productKind: 1, amount: 1 });

export const Otp24Product = mongoose.models.Otp24Product || mongoose.model('Otp24Product', Otp24ProductSchema);
