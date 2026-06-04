import mongoose from 'mongoose';
export const Service: any = mongoose.models.Service || mongoose.model('Service', new mongoose.Schema({}, { strict: false }));
export default Service;
