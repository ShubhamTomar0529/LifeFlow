import Donor from "../models/donorModel.js";
import Facility from "../models/facilityModel.js";
import BloodCamp from "../models/bloodCampModel.js";
import Blood from "../models/bloodModel.js"; 
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


export const getDonorProfile = async (req, res) => {
  try {
    const donorId = req.donor.id;

    const donor = await Donor.findById(donorId)
      .populate({
        path: "donationHistory.facility",
        select: "facilityName address.city address.state",
      })
      .select("-password -__v");

    if (!donor) {
      return res.status(404).json({ message: "Donor not found" });
    }

    const isEligible = donor.isEligible;
    const totalDonations = donor.donationHistory.length;
    const lastDonation = donor.lastDonationDate || null;

    let nextEligibleDate = null;
    if (lastDonation) {
      const next = new Date(lastDonation);
      next.setDate(next.getDate() + 90);
      nextEligibleDate = next;
    }

    const donorProfile = {
      _id: donor._id,
      fullName: donor.fullName,
      email: donor.email,
      phone: donor.phone,
      bloodGroup: donor.bloodGroup,
      age: donor.age,
      gender: donor.gender,
      weight: donor.weight,
      address: donor.address,
      totalDonations,
      lastDonationDate: lastDonation,
      nextEligibleDate,
      eligibleToDonate: isEligible && donor.eligibleToDonate,
      donationHistory: donor.donationHistory.map((don) => ({
        id: don._id,
        donationDate: don.donationDate,
        facility: don.facility?.facilityName || "N/A",
        city: don.facility?.address?.city,
        state: don.facility?.address?.state,
        bloodGroup: don.bloodGroup,
        quantity: don.quantity,
        remarks: don.remarks,
        verified: don.verified,
      })),
      createdAt: donor.createdAt,
      updatedAt: donor.updatedAt,
    };

    res.status(200).json({ donor: donorProfile });
  } catch (error) {
    console.error("Error fetching donor profile:", error);
    res.status(500).json({ message: "Error fetching donor profile", error: error.message });
  }
};

export const updateDonorProfile = async (req, res) => {
  try {
    const donorId = req.donor._id;
    const { fullName, phone, address, age, gender, weight, password } = req.body;

    const donor = await Donor.findById(donorId).select("+password");
    if (!donor) return res.status(404).json({ message: "Donor not found" });

    donor.fullName = fullName !== undefined ? fullName : donor.fullName;
    donor.phone = phone !== undefined ? phone : donor.phone;

    if (address) {
      donor.address.street = address.street || donor.address.street;
      donor.address.city = address.city || donor.address.city;
      donor.address.state = address.state || donor.address.state;
      donor.address.pincode = address.pincode || address.pincode;
    }

    donor.age = age !== undefined ? age : donor.age;
    donor.gender = gender !== undefined ? gender : donor.gender;
    donor.weight = weight !== undefined ? weight : donor.weight;

    if (password) {
      const salt = await bcrypt.genSalt(12);
      donor.password = await bcrypt.hash(password, salt);
    }

    const updatedDonor = await donor.save();

    res.status(200).json({
      message: "Profile updated successfully",
      donor: {
        fullName: updatedDonor.fullName,
        email: updatedDonor.email,
        phone: updatedDonor.phone,
        address: updatedDonor.address,
        age: updatedDonor.age,
        gender: updatedDonor.gender,
        weight: updatedDonor.weight,
      },
    });
  } catch (error) {
    console.error("Error updating donor profile:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Validation failed", errors: error.errors });
    }
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
};

export const getDonorCamps = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [camps, total] = await Promise.all([
      BloodCamp.find(filter).sort({ date: 1 }).skip(skip).limit(parseInt(limit)),
      BloodCamp.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        camps,
        pagination: {
          total,
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get Donor Camps Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch blood camps" });
  }
};

export const donateBlood = async (req, res) => {
  try {
    const donorId = req.donor?.id || req.donor?._id;
    const { campId, quantity = 1, remarks = "" } = req.body;

    if (!campId) {
      return res.status(400).json({
        success: false,
        message: "Please select a blood camp to donate at",
      });
    }

    const donor = await Donor.findById(donorId);
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }

    if (donor.lastDonationDate) {
      const lastDonation = new Date(donor.lastDonationDate);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      if (lastDonation > threeMonthsAgo) {
        const nextEligible = new Date(lastDonation);
        nextEligible.setMonth(nextEligible.getMonth() + 3);
        return res.status(400).json({
          success: false,
          message: `You are not eligible to donate yet. Next eligible date: ${nextEligible.toLocaleDateString("en-IN")}`,
        });
      }
    }

    if (donor.age < 18 || donor.age > 65) {
      return res.status(400).json({
        success: false,
        message: "You must be between 18 and 65 years old to donate blood",
      });
    }

    if (donor.weight && donor.weight < 45) {
      return res.status(400).json({
        success: false,
        message: "Minimum weight requirement is 45 kg",
      });
    }

    const camp = await BloodCamp.findById(campId);
    if (!camp) {
      return res.status(404).json({ success: false, message: "Blood camp not found" });
    }
    if (!["Upcoming", "Ongoing"].includes(camp.status)) {
      return res.status(400).json({
        success: false,
        message: `This camp is "${camp.status}" and not currently accepting donations`,
      });
    }

    const facilityId = camp.hospital; 
    const facility = await Facility.findById(facilityId);
    if (!facility) {
      return res.status(404).json({ success: false, message: "Associated facility not found" });
    }

    donor.lastDonationDate = new Date();
    donor.donationHistory.push({
      donationDate: new Date(),
      facility: facilityId,
      bloodGroup: donor.bloodGroup,
      quantity: Number(quantity),
      remarks: remarks || `Donated at blood camp: ${camp.title}`,
      verified: true,
    });
    await donor.save();

    const isLab = facility.facilityType === "blood-lab";
    const stockFilter = isLab
      ? { bloodGroup: donor.bloodGroup, bloodLab: facilityId }
      : { bloodGroup: donor.bloodGroup, hospital: facilityId };

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 42);

    const existingStock = await Blood.findOne(stockFilter);
    if (existingStock) {
      existingStock.quantity += Number(quantity);
      existingStock.expiryDate = expiryDate;
      await existingStock.save();
    } else {
      await Blood.create({
        bloodGroup: donor.bloodGroup,
        quantity: Number(quantity),
        expiryDate,
        ...(isLab ? { bloodLab: facilityId } : { hospital: facilityId }),
      });
    }

    await Facility.findByIdAndUpdate(facilityId, {
      $push: {
        history: {
          eventType: "Donation",
          description: `Donation from ${donor.fullName} (${donor.bloodGroup}) — ${quantity} unit(s) via camp: ${camp.title}`,
          date: new Date(),
          referenceId: donor._id,
        },
      },
    });

    await BloodCamp.findByIdAndUpdate(campId, {
      $inc: { actualDonors: 1 },
    });

    const nextEligibleDate = new Date();
    nextEligibleDate.setMonth(nextEligibleDate.getMonth() + 3);

    res.status(200).json({
      success: true,
      message: "Donation recorded successfully! Thank you for saving lives!",
      data: {
        donorName: donor.fullName,
        bloodGroup: donor.bloodGroup,
        quantity,
        campName: camp.title,
        facilityName: facility.name,
        totalDonations: donor.donationHistory.length,
        nextEligibleDate,
      },
    });
  } catch (error) {
    console.error("Donate blood error:", error);
    res.status(500).json({ success: false, message: "Failed to record donation" });
  }
};

export const getDonorStats = async (req, res) => {
  try {
    const donorId = req.donor?.id || req.donor?._id;

    if (!donorId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Donor ID missing from request." });
    }

    const donorStats = await Donor.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(donorId) } },
      {
        $project: {
          _id: 0,
          totalDonations: { $size: "$donationHistory" },
          lastDonationDate: { $max: "$donationHistory.donationDate" },
          weight: "$weight",
          age: "$age",
        },
      },
    ]);

    if (!donorStats || donorStats.length === 0) {
      return res.status(404).json({ success: false, message: "Donor profile not found." });
    }

    const stats = donorStats[0];
    const totalDonations = stats.totalDonations || 0;
    const lastDonationDate = stats.lastDonationDate || null;

    let nextEligibleDonationDate = null;
    let eligibilityStatus = "Eligible";

    if (lastDonationDate) {
      const lastDate = new Date(lastDonationDate);
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + 90);
      nextEligibleDonationDate = nextDate;

      if (nextEligibleDonationDate > new Date()) {
        const remainingDays = Math.ceil((nextEligibleDonationDate - new Date()) / (1000 * 60 * 60 * 24));
        eligibilityStatus = `Ineligible (Cooldown: ${remainingDays} days remaining)`;
      }
    }

    if (stats.age < 18 || stats.age > 65) {
      eligibilityStatus = "Ineligible (Age constraint)";
    } else if (stats.weight < 45) {
      eligibilityStatus = "Ineligible (Weight constraint)";
    }

    res.json({
      success: true,
      dashboard: {
        totalDonations,
        lastDonationDate,
        nextEligibleDonationDate,
        eligibilityStatus,
      },
    });
  } catch (error) {
    console.error("Get Donor Stats Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch donor statistics." });
  }
};


export const getDonorHistory = async (req, res) => {
  try {
    const donorId = req.donor?.id || req.donor?._id;

    if (!donorId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Donor ID missing from request." });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const aggregationPipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(donorId) } },
      { $addFields: { totalHistoryLength: { $size: "$donationHistory" } } },
      { $unwind: "$donationHistory" },
      { $sort: { "donationHistory.donationDate": -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "facilities",
          localField: "donationHistory.facility",
          foreignField: "_id",
          as: "facilityDetails",
        },
      },
      {
        $project: {
          _id: 0,
          donation: "$donationHistory",
          total: "$totalHistoryLength",
          facility: { $arrayElemAt: ["$facilityDetails", 0] },
        },
      },
    ];

    const result = await Donor.aggregate(aggregationPipeline);

    const total = result.length > 0 ? result[0].total : 0;
    const history = result.map((item) => ({
      id: item.donation._id,
      donationDate: item.donation.donationDate,
      bloodGroup: item.donation.bloodGroup,
      quantity: item.donation.quantity,
      remarks: item.donation.remarks,
      verified: item.donation.verified,
      facility: item.facility?.facilityName || item.facility?.name || "N/A",
      city: item.facility?.address?.city,
      state: item.facility?.address?.state,
    }));

    res.json({
      success: true,
      history,
      pagination: {
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get Donor History Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch donation history." });
  }
};


export const searchDonor = async (req, res) => {
  try {
    const { term } = req.query;

    if (!term) {
      return res.status(400).json({ success: false, message: "Search term required" });
    }

    const donors = await Donor.find({
      $or: [
        { fullName: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { phone: { $regex: term, $options: "i" } },
      ],
    })
      .select("fullName email phone bloodGroup lastDonationDate donationHistory")
      .limit(20)
      .sort({ lastDonationDate: -1 });

    res.status(200).json({ success: true, donors });
  } catch (err) {
    console.error("Search donor error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markDonation = async (req, res) => {
  try {
    const donorId = req.params.id;
    const labId = req.user._id;
    const { quantity = 1, remarks = "", bloodGroup } = req.body;

    const donor = await Donor.findById(donorId);
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }

    if (donor.lastDonationDate) {
      const lastDonation = new Date(donor.lastDonationDate);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      if (lastDonation > threeMonthsAgo) {
        return res.status(400).json({
          success: false,
          message: "Donor cannot donate yet. Minimum 3 months required between donations.",
        });
      }
    }

    donor.lastDonationDate = new Date();
    if (bloodGroup) donor.bloodGroup = bloodGroup;

    donor.donationHistory.push({
      donationDate: new Date(),
      facility: labId,
      bloodGroup: bloodGroup || donor.bloodGroup,
      quantity,
      remarks,
      verified: true,
    });

    await donor.save();

    await Facility.findByIdAndUpdate(labId, {
      $push: {
        history: {
          eventType: "Donation",
          description: `Recorded donation from ${donor.fullName} - ${quantity} unit(s) of ${bloodGroup || donor.bloodGroup}`,
          date: new Date(),
          referenceId: donor._id,
        },
      },
    });

    await addToBloodStock(labId, bloodGroup || donor.bloodGroup, quantity);

    res.status(200).json({ success: true, message: "Donation recorded successfully", donor });
  } catch (err) {
    console.error("Mark donation error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getRecentDonations = async (req, res) => {
  try {
    const labId = req.user._id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [todayDonations, weekDonations, allDonations, recentDonors] = await Promise.all([
      Donor.countDocuments({
        "donationHistory.facility": labId,
        "donationHistory.donationDate": { $gte: today, $lt: tomorrow },
      }),
      Donor.countDocuments({
        "donationHistory.facility": labId,
        "donationHistory.donationDate": { $gte: weekStart },
      }),
      Donor.aggregate([
        { $unwind: "$donationHistory" },
        { $match: { "donationHistory.facility": labId } },
        { $count: "total" },
      ]),
      Donor.find({ "donationHistory.facility": labId })
        .select("fullName bloodGroup donationHistory")
        .sort({ "donationHistory.donationDate": -1 })
        .limit(10),
    ]);

    const recentDonations = recentDonors
      .flatMap((donor) =>
        donor.donationHistory
          .filter((d) => d.facility.equals(labId))
          .slice(0, 3)
          .map((d) => ({
            donorName: donor.fullName,
            bloodGroup: d.bloodGroup,
            quantity: d.quantity,
            date: d.donationDate,
            remarks: d.remarks,
          }))
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    res.json({
      success: true,
      stats: {
        today: todayDonations,
        thisWeek: weekDonations,
        total: allDonations[0]?.total || 0,
      },
      donations: recentDonations,
    });
  } catch (err) {
    console.error("Get recent donations error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch recent donations" });
  }
};

export const getAllDonors = async (req, res) => {
  try {
    const {
      search = "",
      bloodGroup = "all",
      city = "all",
      availability = "all",
      sortBy = "lastDonation",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
      ];
    }

    if (bloodGroup !== "all") filter.bloodGroup = bloodGroup;
    if (city !== "all") filter["address.city"] = { $regex: city, $options: "i" };

    if (availability !== "all") {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      if (availability === "available") {
        filter.$or = [
          { lastDonationDate: { $lt: threeMonthsAgo } },
          { lastDonationDate: { $exists: false } },
        ];
      } else if (availability === "soon") {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        filter.lastDonationDate = { $gte: threeMonthsAgo, $lte: oneWeekAgo };
      }
    }

    const sortOptions = {};
    switch (sortBy) {
      case "name":       sortOptions.fullName = 1; break;
      case "bloodGroup": sortOptions.bloodGroup = 1; break;
      case "city":       sortOptions["address.city"] = 1; break;
      default:           sortOptions.lastDonationDate = -1;
    }

    const skip = (page - 1) * parseInt(limit);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const [donors, total, availableDonors, rareBloodDonors] = await Promise.all([
      Donor.find(filter)
        .select("fullName email phone bloodGroup lastDonationDate donationHistory address")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Donor.countDocuments(filter),
      Donor.countDocuments({
        $or: [
          { lastDonationDate: { $lt: threeMonthsAgo } },
          { lastDonationDate: { $exists: false } },
        ],
      }),
      Donor.countDocuments({ bloodGroup: { $in: ["O-", "AB-", "B-", "A-"] } }),
    ]);

    res.json({
      success: true,
      donors,
      pagination: {
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      stats: { total, available: availableDonors, rareBlood: rareBloodDonors },
    });
  } catch (err) {
    console.error("Get all donors error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch donors" });
  }
};


export const logContactAttempt = async (req, res) => {
  try {
    const donorId = req.params.id;
    const labId = req.user._id;

    const donor = await Donor.findById(donorId);
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }

    await Facility.findByIdAndUpdate(labId, {
      $push: {
        history: {
          eventType: "Contact",
          description: `Contacted donor ${donor.fullName} (${donor.bloodGroup})`,
          date: new Date(),
          referenceId: donor._id,
        },
      },
    });

    donor.contactHistory = donor.contactHistory || [];
    donor.contactHistory.push({
      contactedBy: labId,
      contactDate: new Date(),
      contactType: "hospital",
    });

    await donor.save();

    res.json({ success: true, message: "Contact logged successfully" });
  } catch (err) {
    console.error("Log contact error:", err);
    res.status(500).json({ success: false, message: "Failed to log contact" });
  }
};


const addToBloodStock = async (labId, bloodType, quantity) => {
  try {
    let stock = await Blood.findOne({ bloodGroup: bloodType, bloodLab: labId });

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 42);

    if (stock) {
      stock.quantity += quantity;
      stock.expiryDate = expiryDate;
      await stock.save();
    } else {
      await Blood.create({
        bloodGroup: bloodType,
        quantity,
        expiryDate,
        bloodLab: labId,
      });
    }
  } catch (error) {
    console.error("Error adding to blood stock:", error);
  }
};