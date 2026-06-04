import mongoose from 'mongoose';
export const Order: any = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
export default Order;
