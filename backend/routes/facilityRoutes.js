import express from "express";
import {
  getAllLabs,
  getFacilityDashboard,
  getProfile,
  updateProfile,
} from "../controllers/facilityController.js";
import { protectFacility } from "../middlewares/facilityMiddleware.js";


const router = express.Router();

router.get("/dashboard", protectFacility, getFacilityDashboard);

router.get("/profile", protectFacility, getProfile);

router.put("/profile", protectFacility, updateProfile);

router.get("/labs", protectFacility , getAllLabs);

export default router;
