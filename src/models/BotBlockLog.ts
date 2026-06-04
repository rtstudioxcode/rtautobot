import mongoose from 'mongoose';
export const BotBlockLog: any = mongoose.models.BotBlockLog || mongoose.model('BotBlockLog', new mongoose.Schema({}, { strict: false }));
export default BotBlockLog;
