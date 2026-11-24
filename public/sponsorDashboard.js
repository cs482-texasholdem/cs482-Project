/**
 * Interactive Sponsor Dashboard controller for sponsorDashboard.html.
 * Handles live banner previewing, form submission states, status feedback,
 * and submitted banner list updates.
 */

const SPONSOR_BANNERS_API = "/api/sponsors/banners"; // Adjust if your backend route path differs
const SPONSOR_SESSION_API = "/loggeduser";        // Adjust if your session endpoint differs

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("sponsor-banner-form");
    const submitBtn = form?.querySelector('button[type="submit"]');
    const feedbackEl = document.getElementById("sponsor-form-feedback");
    const statusPillEl = document.getElementById("banner-approval-status");
    const bannerListEl = document.getElementById("sponsor-banner-list");

    const headlineInput = document.getElementById("banner-headline");
    const subtextInput = document.getElementById("banner-subtext");
    const urlInput = document.getElementById("banner-url");
    const themeSelect = document.getElementById("banner-theme");
    const durationInput = document.getElementById("banner-duration");
    const activeCheckbox = document.getElementById("banner-active");

    const previewBox = document.getElementById("banner-preview");
    const previewHeadline = document.getElementById("preview-headline");
    const previewSubtext = document.getElementById("preview-subtext");
    const previewLink = document.getElementById("preview-link");

    const sponsorNameEl = document.getElementById("sponsor-name");
    const sponsorCodeEl = document.getElementById("sponsor-code");

    let submittedBanners = [];
    let currentSponsor = { sponsorName: "Sponsor Account", sponsorCode: "--" };

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function setFeedback(message, type = "info") {
        if (!feedbackEl) return;
        const colorMap = {
            info: "var(--secondary-text)",
            success: "#2ecc71",
            error: "#ff6b6b",
            warning: "#f1c40f"
        };
        feedbackEl.style.color = colorMap[type] || colorMap.info;
        feedbackEl.innerHTML = message;
    }

    function setStatusPill(text, tone = "pending") {
        if (!statusPillEl) return;
        statusPillEl.textContent = text;
        statusPillEl.dataset.status = tone;
    }

    function normalizeSafeUrl(rawUrl) {
        const trimmed = (rawUrl || "").trim();
        if (!trimmed) return "";
        try {
            const parsed = new URL(trimmed);
            if (parsed.protocol === "https:" || parsed.protocol === "http:") {
                return parsed.href;
            }
            return "";
        } catch {
            return "";
        }
    }

    function applyThemeToPreview(themeValue) {
        if (!previewBox) return;
        previewBox.dataset.theme = themeValue || "midnight";

        const themeStyles = {
            midnight: {
                background: "linear-gradient(135deg, #0b132b 0%, #1c2541 100%)",
                borderColor: "#3a506b"
            },
            gold: {
                background: "linear-gradient(135deg, #231903 0%, #4a3508 100%)",
                borderColor: "#f1c40f"
            },
            emerald: {
                background: "linear-gradient(135deg, #062118 0%, #0e4734 100%)",
                borderColor: "#2ecc71"
            }
        };

        const chosen = themeStyles[themeValue] || themeStyles.midnight;
        previewBox.style.background = chosen.background;
        previewBox.style.borderColor = chosen.borderColor;
    }

    function updateLivePreview() {
        const headlineText = (headlineInput?.value || "").trim();
        const subtextText = (subtextInput?.value || "").trim();
        const safeUrl = normalizeSafeUrl(urlInput?.value || "");
        const themeValue = themeSelect?.value || "midnight";

        if (previewHeadline) {
            previewHeadline.textContent = headlineText || "Your banner headline appears here";
        }
        if (previewSubtext) {
            previewSubtext.textContent = subtextText || "Add a short message or link for players.";
        }
        if (previewLink) {
            if (safeUrl) {
                previewLink.href = safeUrl;
                previewLink.style.display = "inline-block";
            } else {
                previewLink.href = "#";
                previewLink.style.display = "none";
            }
        }
        applyThemeToPreview(themeValue);
    }

    function loadBannerIntoForm(banner) {
        if (!banner) return;
        if (headlineInput) headlineInput.value = banner.headline || "";
        if (subtextInput) subtextInput.value = banner.subtext || "";
        if (urlInput) urlInput.value = banner.linkUrl || "";
        if (themeSelect) themeSelect.value = banner.theme || "midnight";
        if (durationInput) durationInput.value = Number(banner.durationSec) || 20;
        if (activeCheckbox) activeCheckbox.checked = banner.isActive !== false;

        updateLivePreview();
        const statusUpper = String(banner.status || "pending").toUpperCase();
        setStatusPill(statusUpper, statusUpper.toLowerCase());
        setFeedback(`Loaded "<strong>${escapeHtml(banner.headline)}</strong>" into preview &amp; editor.`, "info");
    }

    function renderSubmittedBanners() {
        if (!bannerListEl) return;

        if (!Array.isArray(submittedBanners) || submittedBanners.length === 0) {
            bannerListEl.innerHTML = `<p style="margin: 0;">No banners submitted yet in this session.</p>`;
            return;
        }

        bannerListEl.innerHTML = "";
        submittedBanners.forEach((banner, idx) => {
            const item = document.createElement("div");
            item.className = "sponsor-submitted-item";
            item.style.cssText = [
                "padding: 10px 12px",
                "border-radius: 8px",
                "border: 1px solid rgba(255,255,255,0.14)",
                "background: rgba(255,255,255,0.03)",
                "margin-bottom: 10px",
                "display: flex",
                "justify-content: space-between",
                "align-items: center",
                "gap: 10px",
                "cursor: pointer"
            ].join("; ");

            const statusLabel = String(banner.status || "pending").toUpperCase();
            const durationSec = Number(banner.durationSec) || 20;

            item.innerHTML = `
                <div style="min-width: 0;">
                    <div style="font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${escapeHtml(banner.headline || "Untitled Banner")}
                    </div>
                    <div style="font-size: 11px; color: var(--secondary-text);">
                        Status: <strong>${escapeHtml(statusLabel)}</strong> &bull; ${durationSec}s &bull; ${escapeHtml(banner.theme || "midnight")}
                    </div>
                </div>
                <button type="button" class="sponsor-preview-btn" data-index="${idx}" style="padding: 4px 10px; font-size: 12px; cursor: pointer;">
                    Preview
                </button>
            `;

            item.addEventListener("click", () => loadBannerIntoForm(banner));
            bannerListEl.appendChild(item);
        });
    }

    async function hydrateSponsorIdentity() {
        try {
            const res = await fetch(SPONSOR_SESSION_API, { cache: "no-store" });
            if (!res.ok) return;
            const user = await res.json();
            if (!user) return;

            currentSponsor = {
                sponsorName: user.sponsorName || user.username || "Sponsor",
                sponsorCode: user.sponsorCode || "--"
            };

            if (sponsorNameEl) sponsorNameEl.textContent = currentSponsor.sponsorName;
            if (sponsorCodeEl) sponsorCodeEl.textContent = currentSponsor.sponsorCode;
        } catch (err) {
            console.warn("Could not hydrate sponsor session details:", err);
        }
    }

    async function fetchExistingBanners() {
    try {
        const res = await fetch('/api/sponsors/my-banners', { cache: 'no-store' }); // Matches SponsorBannerController.getMyBanners[cite: 5]
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.banners || []);
        if (list.length > 0) {
            submittedBanners = list;
            renderSubmittedBanners();
        }
    } catch (err) {
        console.warn('Could not load existing sponsor banners:', err);
    }
}

    // Bind live preview listeners
    [headlineInput, subtextInput, urlInput, themeSelect].forEach((el) => {
        el?.addEventListener("input", updateLivePreview);
        el?.addEventListener("change", updateLivePreview);
    });

    // Bind form submission with clear interactive feedback
    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const headline = (headlineInput?.value || "").trim();
        const subtext = (subtextInput?.value || "").trim();
        const rawUrl = (urlInput?.value || "").trim();
        const safeUrl = normalizeSafeUrl(rawUrl);
        const theme = themeSelect?.value || "midnight";
        const durationSec = Math.min(30, Math.max(5, Number(durationInput?.value) || 20));
        const isActive = Boolean(activeCheckbox?.checked);

        if (!headline) {
            setFeedback('<i class="bi bi-exclamation-triangle-fill"></i> Please enter a banner headline.', "warning");
            headlineInput?.focus();
            return;
        }

        if (rawUrl && !safeUrl) {
            setFeedback('<i class="bi bi-exclamation-triangle-fill"></i> Destination link must start with https:// or http://.', "warning");
            urlInput?.focus();
            return;
        }

        const payload = {
            headline,
            subtext,
            linkUrl: safeUrl,
            theme,
            durationSec,
            isActive,
            sponsorName: currentSponsor.sponsorName,
            sponsorCode: currentSponsor.sponsorCode !== "--" ? currentSponsor.sponsorCode : undefined
        };

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Submitting...';
        }
        setStatusPill("Submitting...", "submitting");
        setFeedback('<i class="bi bi-arrow-repeat"></i> Sending banner to server...', "info");

        try {
            const response = await fetch(SPONSOR_BANNERS_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                const errMsg = result.error || result.message || `Submission failed (HTTP ${response.status}).`;
                setStatusPill("Submission Failed", "error");
                setFeedback(`<i class="bi bi-x-circle-fill"></i> ${escapeHtml(errMsg)}`, "error");
                return;
            }

            const savedBanner = result.banner || result._id ? (result.banner || result) : {
                ...payload,
                status: result.status || "pending",
                createdAt: new Date().toISOString()
            };

            submittedBanners.unshift(savedBanner);
            renderSubmittedBanners();
            setStatusPill(String(savedBanner.status || "pending").toUpperCase(), "pending");
            setFeedback(
                `<i class="bi bi-check-circle-fill"></i> Submitted "<strong>${escapeHtml(payload.headline)}</strong>" for admin approval!`,
                "success"
            );

            form.reset();
            if (durationInput) durationInput.value = "20";
            if (activeCheckbox) activeCheckbox.checked = true;
            updateLivePreview();
        } catch (error) {
            console.error("Error submitting sponsor banner:", error);
            setStatusPill("Network Error", "error");
            setFeedback(
                '<i class="bi bi-wifi-off"></i> Could not reach the banner server. Check your connection or route path.',
                "error"
            );
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtn.dataset.originalHtml || '<i class="bi bi-send-check-fill"></i> Submit Banner for Approval';
            }
        }
    });

    form?.addEventListener("reset", () => {
        requestAnimationFrame(() => {
            if (durationInput) durationInput.value = "20";
            if (activeCheckbox) activeCheckbox.checked = true;
            setStatusPill("Draft / Pending", "pending");
            setFeedback("Form cleared.", "info");
            updateLivePreview();
        });
    });

    updateLivePreview();
    hydrateSponsorIdentity();
    fetchExistingBanners();
});