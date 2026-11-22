/**
 * ============================================================================
 * File Name: SponsorBanner.js
 * Purpose: Mongoose schema for sponsor-designed advertisement banners,
 *          admin approval status, safe destination links, and rotation timing.
 * ============================================================================
 */

const mongoose = require('mongoose');

const SponsorBannerSchema = new mongoose.Schema({
    sponsorUsername: {
        type: String,
        required: true,
        trim: true
    },
    sponsorCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    sponsorName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    headline: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    subtext: {
        type: String,
        default: '',
        trim: true,
        maxlength: 160
    },
    linkUrl: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500
    },
    theme: {
        type: String,
        enum: ['midnight', 'gold', 'emerald'],
        default: 'midnight'
    },
    durationSec: {
        type: Number,
        min: 5,
        max: 30,
        default: 20
    },
    isActive: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    moderationNote: {
        type: String,
        default: '',
        trim: true,
        maxlength: 240
    },
    reviewedBy: {
        type: String,
        default: ''
    },
    reviewedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('SponsorBanner', SponsorBannerSchema);