// src/db/mongoBonustime.js
import mongoose from "mongoose";
import { config, resolveBonustimeDbName, resolveBonustimeUri } from "../config";

let bonustimeConn = null;

// ───────── GLOBAL LOG ─────────
const isGlobalLogEnabled = () => {
  return config?.system?.globalLogEnabled === true;
};

const glog = {
  log: (...args) => {
    if (isGlobalLogEnabled()) console.log(...args);
  },
  info: (...args) => {
    if (isGlobalLogEnabled()) console.info(...args);
  },
  warn: (...args) => {
    if (isGlobalLogEnabled()) console.warn(...args);
  },
  error: (...args) => {
    if (isGlobalLogEnabled()) console.error(...args);
  },
};

export function getBonustimeDb() {
  if (bonustimeConn) return bonustimeConn;

  const uri = resolveBonustimeUri();
  const dbName = resolveBonustimeDbName();

  if (!uri) {
    glog.error("❌ Bonustime Mongo URI missing in config.js");
    throw new Error("Bonustime Mongo URI missing");
  }

  // ใช้ Railway Private URL เดียวกับ Mongo หลักได้ แล้วแยก DB ด้วย BONUSTIME_DBNAME
  const opts = dbName ? { dbName } : {};

  bonustimeConn = mongoose.createConnection(uri, opts);

  bonustimeConn.on("connected", () => {
    glog.log(`🔥 Bonustime DB connected${dbName ? ` / DB: ${dbName}` : ""}`);
  });

  bonustimeConn.on("error", (err) => {
    glog.error("❌ Bonustime DB error:", err);
  });

  return bonustimeConn;
}

// เก่าไม่ใช้แล้วแต่เก็บไว้ก่อน
// src/db/mongoBonustime.js
// import mongoose from "mongoose";
// import { config, resolveBonustimeDbName, resolveBonustimeUri } from "../config";

// let bonustimeConn = null;

// export function getBonustimeDb() {
//   if (bonustimeConn) return bonustimeConn;

//   const uri = config?.bonustime?.mongoUri;
//   // const dbName = config?.bonustime?.dbName || "rtautobot";

//   if (!uri) {
//     glog.error("❌ Bonustime Mongo URI missing in config.js");
//     throw new Error("Bonustime Mongo URI missing");
//   }

//   bonustimeConn = mongoose.createConnection(uri, {
//     // dbName,
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   });

//   // bonustimeConn.on("connected", () => {
//   //   glog.log("🔥 Bonustime DB connected:", dbName);
//   // });

//   bonustimeConn.on("error", (err) => {
//     glog.error("❌ Bonustime DB error:", err);
//   });

//   return bonustimeConn;
// }