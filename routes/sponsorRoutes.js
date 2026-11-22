
const express = require("express");
const router = express.Router();

const sponsorController = require("../controller/SponsorBannerController");

// Sponsor routes
router.post(
    "/api/sponsors/banner",
    sponsorController.submitBanner
);

router.get(
    "/api/sponsors/my-banners",
    sponsorController.getMyBanners
);

// Public route
router.get(
    "/api/sponsors/active",
    sponsorController.getApprovedActiveBanners
);

// Admin moderation routes
router.get(
    "/api/admin/sponsor-banners",
    sponsorController.getModerationQueue
);

router.patch(
    "/api/admin/sponsor-banners/:id/moderate",
    sponsorController.moderateBanner
);

module.exports = router;
