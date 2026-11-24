/**
 * ============================================================================
 * File Name: SponsorBannerController.js
 * Purpose: Backend controller for sponsor banner submission, URL safety
 *          sanitization, admin approval/rejection moderation, and fetching
 *          approved rotation banners.
 * ============================================================================
 */

const SponsorBanner = require('../model/SponsorBanner');
const userController = require('./UserController');

const ALLOWED_THEMES = new Set(['midnight', 'gold', 'emerald']);
const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected']);

function sanitizeHttpUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return { valid: true, value: '' };
    const trimmed = rawUrl.trim();
    if (!trimmed) return { valid: true, value: '' };

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { valid: false, error: 'Destination URL must use http:// or https://.' };
        }
        return { valid: true, value: parsed.href };
    } catch {
        return { valid: false, error: 'Invalid destination URL format.' };
    }
}

function computeReadingDurationSec(headline, subtext, requestedDuration) {
    const wordCount = `${headline || ''} ${subtext || ''}`
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

    // ~3 words per second reading budget, minimum 8s, capped at 30s
    const readEstimate = Math.max(8, Math.min(30, Math.ceil(wordCount / 3) + 4));

    if (requestedDuration !== undefined && requestedDuration !== null && requestedDuration !== '') {
        const parsed = Number(requestedDuration);
        if (Number.isFinite(parsed)) {
            return Math.max(5, Math.min(30, Math.round(parsed)));
        }
    }

    return readEstimate;
}

function getSessionUser(req) {
    return req.session && req.session.user ? req.session.user : null;
}

function getSessionUsername(user) {
    if (!user) return null;
    return typeof user === 'string' ? user : user.username;
}

/**
 * POST /api/sponsors/banner
 * Sponsor (permission === 3) creates or updates a banner and sends it to 'pending' review.
 */
exports.submitBanner = async function(req, res) {
    try {
        if (!userController.sponsorCheck(req)) {
            return res.status(403).json({ error: 'Sponsor access required.' });
        }

        const sessionUser = getSessionUser(req);
        const username = getSessionUsername(sessionUser);
        const sponsorCode = (sessionUser.sponsorCode || '').trim().toUpperCase();
        const sponsorName = (sessionUser.sponsorName || username || 'Sponsor').trim();

        if (!sponsorCode) {
            return res.status(400).json({ error: 'Missing sponsor code on account.' });
        }

        const headline = typeof req.body?.headline === 'string' ? req.body.headline.trim() : '';
        const subtext = typeof req.body?.subtext === 'string' ? req.body.subtext.trim() : '';
        const rawTheme = typeof req.body?.theme === 'string' ? req.body.theme.trim() : 'midnight';
        const theme = ALLOWED_THEMES.has(rawTheme) ? rawTheme : 'midnight';
        const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true;
        const durationSec = computeReadingDurationSec(headline, subtext, req.body?.durationSec);

        if (!headline) {
            return res.status(400).json({ error: 'Headline is required.' });
        }
        if (headline.length > 100) {
            return res.status(400).json({ error: 'Headline must be 100 characters or fewer.' });
        }
        if (subtext.length > 160) {
            return res.status(400).json({ error: 'Supporting copy must be 160 characters or fewer.' });
        }

        const urlCheck = sanitizeHttpUrl(req.body?.linkUrl);
        if (!urlCheck.valid) {
            return res.status(400).json({ error: urlCheck.error });
        }

        let banner;
        if (req.body?.bannerId) {
            banner = await SponsorBanner.findOneAndUpdate(
                { _id: req.body.bannerId, sponsorUsername: username },
                {
                    headline,
                    subtext,
                    linkUrl: urlCheck.value,
                    theme,
                    durationSec,
                    isActive,
                    status: 'pending',
                    moderationNote: '',
                    reviewedBy: '',
                    reviewedAt: null
                },
                { new: true }
            );
            if (!banner) {
                return res.status(404).json({ error: 'Banner not found for this sponsor.' });
            }
        } else {
            banner = await SponsorBanner.create({
                sponsorUsername: username,
                sponsorCode,
                sponsorName,
                headline,
                subtext,
                linkUrl: urlCheck.value,
                theme,
                durationSec,
                isActive,
                status: 'pending'
            });
        }

        const io = req.app?.get?.('io');
        if (io && typeof io.emit === 'function') {
            io.emit('SPONSOR_BANNERS_UPDATED');
        }

        return res.status(201).json({ banner });
    } catch (error) {
        console.error('Error submitting sponsor banner:', error);
        return res.status(500).json({ error: 'Failed to save sponsor banner.' });
    }
};

/**
 * GET /api/sponsors/my-banners
 * Returns banners submitted by the currently logged-in sponsor.
 */
exports.getMyBanners = async function(req, res) {
    try {
        if (!userController.sponsorCheck(req)) {
            return res.status(403).json({ error: 'Sponsor access required.' });
        }

        const username = getSessionUsername(getSessionUser(req));
        const banners = await SponsorBanner.find({ sponsorUsername: username }).sort({ createdAt: -1 });
        return res.status(200).json({ banners });
    } catch (error) {
        console.error('Error fetching sponsor banners:', error);
        return res.status(500).json({ error: 'Failed to load sponsor banners.' });
    }
};

/**
 * DELETE /api/sponsors/banner/:id
 * Allows a sponsor to delete only their own banner.
 */
exports.deleteMyBanner = async function(req, res) {
    try {
        if (!userController.sponsorCheck(req)) {
            return res.status(403).json({ error: 'Sponsor access required.' });
        }

        const username = getSessionUsername(getSessionUser(req));

        const deletedBanner = await SponsorBanner.findOneAndDelete({
            _id: req.params.id,
            sponsorUsername: username
        });

        if (!deletedBanner) {
            return res.status(404).json({
                error: 'Banner not found or you do not have permission to delete it.'
            });
        }

        const io = req.app?.get?.('io');
        if (io && typeof io.emit === 'function') {
            io.emit('SPONSOR_BANNERS_UPDATED');
        }

        return res.status(200).json({
            message: 'Banner deleted successfully.'
        });

    } catch (error) {
        console.error('Error deleting sponsor banner:', error);
        return res.status(500).json({ error: 'Failed to delete banner.' });
    }
};

/**
 * GET /api/sponsors/active
 * Public/gameplay read endpoint returning only approved, active banners with safe URLs.
 */
exports.getApprovedActiveBanners = async function(req, res) {
    try {
        const banners = await SponsorBanner.find({
            status: 'approved',
            isActive: true
        })
            .select('_id sponsorName sponsorCode headline subtext linkUrl theme durationSec updatedAt')
            .sort({ updatedAt: -1 });

        const safeBanners = banners.map((b) => {
            const urlCheck = sanitizeHttpUrl(b.linkUrl || '');
            return {
                id: String(b._id),
                sponsorName: b.sponsorName,
                sponsorCode: b.sponsorCode,
                headline: b.headline,
                subtext: b.subtext,
                linkUrl: urlCheck.valid ? urlCheck.value : '',
                theme: b.theme,
                durationSec: computeReadingDurationSec(b.headline, b.subtext, b.durationSec)
            };
        });

        return res.status(200).json({ banners: safeBanners });
    } catch (error) {
        console.error('Error fetching active sponsor banners:', error);
        return res.status(500).json({ error: 'Failed to load active banners.' });
    }
};

/**
 * GET /api/admin/sponsor-banners
 * Admin (permission === 1) moderation queue across all sponsors and codes.
 */
exports.getModerationQueue = async function(req, res) {
    try {
        if (!userController.adminCheck(req)) {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        const filter = {};
        if (req.query?.status && ALLOWED_STATUSES.has(req.query.status)) {
            filter.status = req.query.status;
        }
        if (req.query?.code && typeof req.query.code === 'string' && req.query.code.trim()) {
            filter.sponsorCode = req.query.code.trim().toUpperCase();
        }

        const banners = await SponsorBanner.find(filter).sort({ createdAt: -1 });
        return res.status(200).json({ banners });
    } catch (error) {
        console.error('Error fetching moderation queue:', error);
        return res.status(500).json({ error: 'Failed to load moderation queue.' });
    }
};

/**
 * PATCH /api/admin/sponsor-banners/:id/moderate
 * Admin approves or rejects a banner and optionally records a moderation note.
 */
exports.moderateBanner = async function(req, res) {
    try {
        if (!userController.adminCheck(req)) {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        const nextStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
        if (nextStatus !== 'approved' && nextStatus !== 'rejected') {
            return res.status(400).json({ error: "Status must be 'approved' or 'rejected'." });
        }

        const moderationNote = typeof req.body?.moderationNote === 'string'
            ? req.body.moderationNote.trim().slice(0, 240)
            : '';
        const adminUsername = getSessionUsername(getSessionUser(req)) || 'admin';

        const updated = await SponsorBanner.findByIdAndUpdate(
            req.params.id,
            {
                status: nextStatus,
                moderationNote,
                reviewedBy: adminUsername,
                reviewedAt: new Date()
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'Banner not found.' });
        }

        const io = req.app?.get?.('io');
        if (io && typeof io.emit === 'function') {
            io.emit('SPONSOR_BANNERS_UPDATED');
        }

        return res.status(200).json({ banner: updated });
    } catch (error) {
        console.error('Error moderating sponsor banner:', error);
        return res.status(500).json({ error: 'Failed to moderate banner.' });
    }
};

/**
 * DELETE /api/admin/sponsor-banners/:id
 * Allows an admin to delete any sponsor banner.
 */
exports.deleteBanner = async function(req, res) {
    try {
        if (!userController.adminCheck(req)) {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        const deletedBanner = await SponsorBanner.findByIdAndDelete(req.params.id);

        if (!deletedBanner) {
            return res.status(404).json({ error: 'Banner not found.' });
        }

        const io = req.app?.get?.('io');
        if (io && typeof io.emit === 'function') {
            io.emit('SPONSOR_BANNERS_UPDATED');
        }

        return res.status(200).json({
            message: 'Banner deleted successfully.'
        });

    } catch (error) {
        console.error('Error deleting banner as admin:', error);
        return res.status(500).json({ error: 'Failed to delete banner.' });
    }
};