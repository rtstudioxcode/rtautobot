// src/routes/support.js
import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.render("support", {
    layout: true,
    title: "ติดต่อทีมงาน | RTSMM-TH.COM",
    pageTitle: "ติดต่อทีมงาน | RTSMM-TH.COM",
    metaDescription:
      "ติดต่อทีมงาน RTSMM-TH ผ่าน Line OA, Telegram สำรอง และติดตามข่าวสารอัปเดตผ่าน Telegram Channel",
    bodyClass: "page-support",
  });
});

export default router;
