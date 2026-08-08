import express from "express";
import { protectFacility } from "../middlewares/facilityMiddleware.js";
import {
  hospitalRequestBlood,
  getHospitalRequests,
  getHospitalDashboard,
  getHospitalStock,
  getHospitalHistory,
  getAllDonors,
  logContactAttempt
} from "../controllers/hospitalController.js";

const router = express.Router();

router.post("/blood/request", protectFacility, hospitalRequestBlood);
router.get("/blood/requests", protectFacility, getHospitalRequests);

router.get("/dashboard", protectFacility, getHospitalDashboard);
router.get("/blood/stock", protectFacility, getHospitalStock);
router.get("/history", protectFacility, getHospitalHistory);

router.get("/donors", protectFacility, getAllDonors);
router.post("/donors/:id/contact", protectFacility, logContactAttempt);

export default router;