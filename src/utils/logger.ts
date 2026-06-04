// src/utils/logger.js
import { config } from "../config";

function isEnabled() {
  return config?.system?.globalLogEnabled === true;
}

function ts() {
  return new Date().toISOString();
}

function format(level, args) {
  return [`[${ts()}]`, `[${level}]`, ...args];
}

export function log(...args) {
  if (!isEnabled()) return;
  console.log(...format("INFO", args));
}

export function warn(...args) {
  if (!isEnabled()) return;
  console.warn(...format("WARN", args));
}

export function errlog(...args) {
  // error ต้องออกเสมอ
  console.error(...format("ERROR", args));
}