import express from "express";
import {
  createBloodCamp,
  deleteBloodCamp,
  getBloodLabCamps,
  getBloodLabDashboard,
  getBloodLabHistory,
  updateBloodCamp,        
  updateCampStatus,       
  addBloodStock,
  removeBloodStock,
  getBloodStock,
  updateBloodRequestStatus,
  getLabBloodRequests,
  getAllLabs,
} from "../controllers/bloodLabController.js";
import { protectFacility } from "../middlewares/facilityMiddleware.js";
import { getRecentDonations, markDonation, searchDonor } from "../controllers/donorController.js";

const router = express.Router();

router.get("/dashboard", protectFacility, getBloodLabDashboard);
router.get("/history", protectFacility, getBloodLabHistory);

router.post("/camps", protectFacility, createBloodCamp);
router.get("/camps", protectFacility, getBloodLabCamps);
router.put("/camps/:id", protectFacility, updateBloodCamp);        
router.patch("/camps/:id/status", protectFacility, updateCampStatus); 
router.delete("/camps/:id", protectFacility, deleteBloodCamp);

router.post("/blood/add", protectFacility, addBloodStock);
router.post("/blood/remove", protectFacility, removeBloodStock);
router.get("/blood/stock", protectFacility, getBloodStock);

router.get("/blood/requests", protectFacility, getLabBloodRequests);
router.put("/blood/requests/:id", protectFacility, updateBloodRequestStatus);

router.get("/labs", protectFacility, getAllLabs);

router.get("/donors/search", protectFacility, searchDonor);
router.post("/donors/donate/:id", protectFacility, markDonation);
router.get("/donations/recent", protectFacility, getRecentDonations);

export default router;