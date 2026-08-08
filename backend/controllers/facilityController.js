import Facility from "../models/facilityModel.js";
import bcrypt from "bcryptjs";

export const getProfile = async (req, res) => {
  try {
    const facility = await Facility.findById(req.user.id)
      .select("-password -__v")
      .lean();

    if (!facility) {
      return res.status(404).json({
        success: false,
        message: "Facility not found"
      });
    }

    res.status(200).json({
      success: true,
      facility
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching profile"
    });
  }
};

export const updateProfile = async (req, res) => {
  const session = await Facility.startSession();
  session.startTransaction();

  try {
    console.log("Facility profile update request:", {
      userId: req.user._id,
      updates: Object.keys(req.body)
    });

    const updates = { ...req.body };
    
    const facilityId = req.user._id;

    const existingFacility = await Facility.findById(facilityId).session(session);
    if (!existingFacility) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Facility not found"
      });
    }

    const allowedFields = [
      "name", "phone", "emergencyContact", "operatingHours",
      "services", "description", "website", "contactPerson",
      "password" 
    ];

    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && key !== "password") {
        filteredUpdates[key] = updates[key];
      }
    });

    
    if (updates.address && typeof updates.address === 'object') {
      
      filteredUpdates.address = {
        ...existingFacility.address.toObject(), 
        ...updates.address
      };
    }

    if (updates.password) {
      if (updates.password.length < 6) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long"
        });
      }
      const salt = await bcrypt.genSalt(12);
      filteredUpdates.password = await bcrypt.hash(updates.password, salt);
    }

    const updatedFacility = await Facility.findByIdAndUpdate(
      facilityId,
      {
        ...filteredUpdates,
        $push: {
          history: {
            eventType: "Profile Update",
            description: "Facility profile updated by user",
            date: new Date(),
          }
        }
      },
      {
        new: true,
        runValidators: true,
        session,
        select: "-password -__v"
      }
    );

    if (updatedFacility.history.length > 50) {
      updatedFacility.history = updatedFacility.history.slice(-50);
      await updatedFacility.save({ session });
    }

    await session.commitTransaction();

    console.log(" Facility profile updated successfully:", updatedFacility._id);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      facility: updatedFacility
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Update Facility Profile Error:", error);

    let errorMessage = "Failed to update profile";
    let validationErrors = {};

    if (error.name === 'ValidationError') {
      for (let field in error.errors) {
        validationErrors[field] = error.errors[field].message;
      }
      errorMessage = "Validation failed: Please check your input.";
    }

    res.status(400).json({
      success: false,
      message: errorMessage,
      errors: validationErrors, 
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
};

export const getFacilityDashboard = async (req, res) => {
  try {
    const facility = await Facility.findById(req.user._id)
      .select("name history facilityType")
      .lean();

    if (!facility) {
      return res.status(404).json({
        success: false,
        message: "Facility not found"
      });
    }

    
    const totalCamps = facility.history.filter(h => h.eventType === "Blood Camp").length;
    const recentHistory = facility.history
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    const dashboardData = {
      totalCamps,
      upcomingCamps: 2, 
      bloodSlots: 10, 
      activeRequests: 4, 
      totalHistory: facility.history.length,
      recentHistory,
    };

    res.status(200).json({
      success: true,
      facility: facility.name,
      facilityType: facility.facilityType,
      stats: dashboardData,
    });
  } catch (error) {
    console.error("Facility Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard data"
    });
  }
};

export const getAllLabs = async (req, res) => {
  try {
    const labs = await Facility.find({ 
      facilityType: "blood-lab", 
      status: "approved" 
    }).select("name email phone address operatingHours");

    res.status(200).json({ 
      success: true, 
      labs 
    });
  } catch (error) {
    console.error("Get Labs Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching blood labs" 
    });
  }
}