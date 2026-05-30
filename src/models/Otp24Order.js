import mongoose from 'mongoose';

const Otp24OrderSchema = new mongoose.Schema({
  provider:   { type:String, default:'otp24', index:true },
  productKind:{ type:String, enum:['otp','pack'], default:'otp', index:true },
  user:       { type: mongoose.Schema.Types.ObjectId, ref:'User', index:true },

  productId:  { type: mongoose.Schema.Types.ObjectId, ref:'Otp24Product' },
  appName:    { type:String },
  serviceCode:{ type:String },        // OTP: type, Pack: type_code
  countryId:  { type:Number, index:true },
  quantity:   { type:Number, default:1 },

  // ต้นทุน / ราคาขาย / กำไร เก็บแยกกันเพื่อรายงานกำไรภายหลัง
  providerPrice: { type:Number, default:0 },
  salePrice:     { type:Number, default:0 },
  profit:        { type:Number, default:0 },
  markupPercent: { type:Number, default:0 },

  orderId:    { type:String, index:true, unique:true, sparse:true },
  phone:      { type:String },

  // สำหรับ action=buypack/logpack
  accountText:{ type:String },
  linkText:   { type:String },
  providerRaw:{ type: mongoose.Schema.Types.Mixed },

  // สถานะหลัก
  status:     { 
    type:String, 
    enum: ['processing','pending','purchased','success','timeout','failed','refunded','canceled'],
    default:'processing',
    index:true
  },
  otp:        { type:String },
  message:    { type:String },

  // เส้นตาย & การคืนเงิน
  createdAt:  { type: Date, index:true },
  expiresAt:  { type: Date, index:true },
  refundApplied: { type: Boolean, default: false, index: true },
  refundAmount:  { type: Number, default: 0 },
  refundedAt:    { type: Date },
  refundNote:    { type: String },

  // นับยอดใช้จ่ายรวม
  otpSpentAccounted: { type:Number, default:0 },
  otpSpentAccountedAt: { type: Date },
}, { timestamps:true, collection:'otp24orders' });

function scheduleOtp24SpendRecalc(doc) {
  const st = String(doc?.status || '').toLowerCase();
  if (st !== 'success') return;
  setImmediate(async () => {
    try {
      const { reconcileOtp24OrderSpend, recalcUserTotals } = await import('../services/spend.js');
      await reconcileOtp24OrderSpend(doc._id);
      const uid = doc.userId || doc.user;
      if (uid) await recalcUserTotals(uid, { force:true, reason:'otp24_order_success' });
    } catch (e) {
      console.warn('[Otp24Order] spend reconcile failed:', e?.message || e);
    }
  });
}

Otp24OrderSchema.post('save', function (doc) {
  scheduleOtp24SpendRecalc(doc);
});

export const Otp24Order =
  mongoose.models.Otp24Order || mongoose.model('Otp24Order', Otp24OrderSchema);
