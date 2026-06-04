import mongoose from 'mongoose';
export const BotBlockedIp: any = mongoose.models.BotBlockedIp || mongoose.model('BotBlockedIp', new mongoose.Schema({}, { strict: false }));
export default BotBlockedIp;
