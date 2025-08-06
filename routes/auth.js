const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { sendOTP } = require("../utils/emailService");

const router = express.Router();

// Generate OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Request OTP
router.post(
  "/request-otp",
  [body("email").isEmail().withMessage("Please enter a valid email")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      // Check if email is allowed
      const allowedEmails = [
        "yashkharva506@gmail.com",
        "yashkharva22@gmail.com",
      ];
      if (!allowedEmails.includes(email)) {
        return res
          .status(403)
          .json({ message: "Email not authorized for admin access" });
      }

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Find or create user
      let user = await User.findOne({ email });
      if (!user) {
        user = new User({ email });
      }

      user.otp = {
        code: otp,
        expiresAt: otpExpiry,
      };
      await user.save();

      // Send OTP via email
      const emailSent = await sendOTP(email, otp);
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send OTP email" });
      }

      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("OTP request error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Verify OTP and login
router.post(
  "/verify-otp",
  [
    body("email").isEmail().withMessage("Please enter a valid email"),
    body("otp")
      .isLength({ min: 4, max: 4 })
      .withMessage("OTP must be 4 digits"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, otp } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if OTP exists and is not expired
      if (!user.otp || !user.otp.code || user.otp.expiresAt < new Date()) {
        return res.status(400).json({ message: "OTP expired or invalid" });
      }

      // Verify OTP
      if (user.otp.code !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // Clear OTP and update user
      user.otp = undefined;
      user.isVerified = true;
      user.lastLogin = new Date();
      await user.save();

      res.json({
        message: "Login successful",
        user: {
          email: user.email,
          isVerified: user.isVerified,
          lastLogin: user.lastLogin,
        },
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Check session validity
router.get("/check-session", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is verified and session is still valid
    if (!user.isVerified) {
      return res.status(401).json({ message: "Session expired" });
    }

    // Check if last login was within 24 hours (you can adjust this timeout)
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (
      user.lastLogin &&
      Date.now() - user.lastLogin.getTime() > sessionTimeout
    ) {
      user.isVerified = false;
      await user.save();
      return res.status(401).json({ message: "Session expired" });
    }

    res.json({
      valid: true,
      user: {
        email: user.email,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Extend session
router.post("/extend-session", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({ message: "Session expired" });
    }

    // Update last login time to extend session
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: "Session extended successfully",
      user: {
        email: user.email,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("Session extension error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (user) {
      user.isVerified = false;
      await user.save();
    }

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
