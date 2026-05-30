// src/models/Otp24AppsOrder.js
import mongoose from 'mongoose';

const Otp24AppsOrderSchema = new mongoose.Schema({
  provider: { type: String, default: 'otp24', index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  // product จาก action=getpack เท่านั้น แยกจาก OTP เช่าเบอร์เดิม
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Otp24Product', index: true },
  appName: { type: String, index: true },
  serviceCode: { type: String, index: true }, // type_code ที่ส่งไป buypack
  quantity: { type: Number, default: 1 },

  // เก็บต้นทุนและราคาขายแยกกัน เพื่อ report กำไร/ต้นทุน
  providerPrice: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  markupPercent: { type: Number, default: 35 },

  orderId: { type: String, index: true, unique: true, sparse: true },

  status: {
    type: String,
    enum: ['processing', 'success', 'failed', 'refunded', 'canceled'],
    default: 'success',
    index: true,
  },

  // ข้อมูลที่ผู้ใช้ได้รับจาก buypack/logpack
  accountText: { type: String },
  linkText: { type: String },
  message: { type: String },
  providerRaw: { type: mongoose.Schema.Types.Mixed },

  refundApplied: { type: Boolean, default: false, index: true },
  refundAmount: { type: Number, default: 0 },
  refundedAt: { type: Date },
  refundNote: { type: String },

  // สำหรับนับยอดใช้จ่าย ไม่ปนกับ otp24orders
  appsSpentAccounted: { type: Number, default: 0 },
  appsSpentAccountedAt: { type: Date },

  // Auto refresh รายการ getpack ที่ต้นทางยังส่ง placeholder รอเจ้าหน้าที่
  appsAutoRefreshLastAt: { type: Date, index: true },
  appsAutoRefreshLastResult: { type: String, default: '' },
  appsAutoRefreshCount: { type: Number, default: 0 },

  createdAt: { type: Date, index: true },
}, { timestamps: true, collection: 'otp24appsorders' });

Otp24AppsOrderSchema.index({ user: 1, createdAt: -1 });
Otp24AppsOrderSchema.index({ provider: 1, status: 1, createdAt: -1 });

function scheduleAppsSpendRecalc(doc) {
  const st = String(doc?.status || '').toLowerCase();
  if (st !== 'success') return;
  setImmediate(async () => {
    try {
      const { reconcileAppsOrderSpend, recalcUserTotals } = await import('../services/spend.js');
      await reconcileAppsOrderSpend(doc._id);
      if (doc.user) await recalcUserTotals(doc.user, { force:true, reason:'apps_order_success' });
    } catch (e) {
      console.warn('[Otp24AppsOrder] spend reconcile failed:', e?.message || e);
    }
  });
}

Otp24AppsOrderSchema.post('save', function (doc) {
  scheduleAppsSpendRecalc(doc);
});

export const Otp24AppsOrder =
  mongoose.models.Otp24AppsOrder || mongoose.model('Otp24AppsOrder', Otp24AppsOrderSchema);
