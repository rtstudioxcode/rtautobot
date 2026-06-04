import mongoose from 'mongoose';
export const Otp24Product: any = mongoose.models.Otp24Product || mongoose.model('Otp24Product', new mongoose.Schema({}, { strict: false }));
export default Otp24Product;
