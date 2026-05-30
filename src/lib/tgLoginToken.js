import jwt from "jsonwebtoken";
import { config } from "../config.js";

function getJwtSecret() {
  const secret = String(
    config?.system?.jwtSecret ||
    config?.jwtSecret ||
    ""
  ).trim();

  if (!secret) {
    throw new Error("JWT secret is not configured in secure_config.system.jwtSecret");
  }

  return secret;
}

export function signPayload(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "15m",
  });
}

export function verifyPayload(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}