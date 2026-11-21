const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { adminMiddleware } = require("../middleware/authMiddleware");

const {
  getLocalEvents,
  getLocalEventById,
  saveLocalEvent,
  updateLocalEvent,
  getLocalTeam,
  getLocalTeamMemberById,
  saveLocalTeamMember,
  updateLocalTeamMember
} = require("../controllers/localDataController");

// Public read endpoints.
router.get("/events", getLocalEvents);
router.get("/events/:id", getLocalEventById);
router.get("/team", getLocalTeam);
router.get("/team/:id", getLocalTeamMemberById);

// Every JSON write is restricted to a currently verified admin account.
router.post("/events", authMiddleware, adminMiddleware, saveLocalEvent);
router.put("/events/:id", authMiddleware, adminMiddleware, updateLocalEvent);
router.post("/team", authMiddleware, adminMiddleware, saveLocalTeamMember);
router.put("/team/:id", authMiddleware, adminMiddleware, updateLocalTeamMember);

module.exports = router;
