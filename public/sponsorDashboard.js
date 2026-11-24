/**
 * Interactive Sponsor Dashboard controller for sponsorDashboard.html.
 * Handles live banner previewing, form submission states, status feedback,
 * and submitted banner list updates.
 */

const SPONSOR_BANNERS_API = "/api/sponsors/banner"; // Adjust if your backend route path differs
const SPONSOR_SESSION_API = "/loggeduser";        // Adjust if your session endpoint differs

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("sponsor-banner-form");
    const submitBtn = form?.querySelector('button[type="submit"]');
    const cancelEditBtn = document.createElement("button");
    cancelEditBtn.type = "button";
    cancelEditBtn.textContent = "Cancel Edit";
    cancelEditBtn.className = "sponsor-delete-btn";
    cancelEditBtn.style.display = "none";
    cancelEditBtn.style.marginLeft = "8px";

    submitBtn?.insertAdjacentElement("afterend", cancelEditBtn);
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

    const sponsorNameEl = document.getElementById("sponsor-name");
    const sponsorCodeEl = document.getElementById("sponsor-code");

    let submittedBanners = [];
    let currentSponsor = { sponsorName: "Sponsor Account", sponsorCode: "--" };
    let editingBannerId = null;

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
    
    function showSponsorNotification(title, message, type = "success") {
        const notification = document.createElement("div");

        notification.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            z-index: 9999;
            width: 320px;
            padding: 16px;
            border-radius: 10px;
            background: #1B3260;
            border: 1px solid ${type === "success" ? "#2ecc71" : "#ff6b6b"};
            color: #ffffff;
            box-shadow: 0 4px 15px rgba(0,0,0,0.35);
        `;

        const heading = document.createElement("div");
        heading.style.cssText = "font-weight: 700; margin-bottom: 5px;";
        heading.textContent = title;

        const messageText = document.createElement("div");
        messageText.style.cssText = "font-size: 13px; color: #dce6f5;";
        messageText.textContent = message;

        notification.appendChild(heading);
        notification.appendChild(messageText);
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
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

    function updateLivePreview() {
        if (!previewBox) {
            return;
        }

        const headlineText = (headlineInput?.value || "").trim();
        const subtextText = (subtextInput?.value || "").trim();
        const safeUrl = normalizeSafeUrl(urlInput?.value || "");

        const allowedThemes = ["midnight", "gold", "emerald"];
        let themeValue = themeSelect?.value || "midnight";

        if (!allowedThemes.includes(themeValue)) {
            themeValue = "midnight";
        }

        const sponsorName = escapeHtml(
            currentSponsor.sponsorName || "Our Valued Sponsor"
        );

        const headline = escapeHtml(
            headlineText || "Your Next Big Win Starts Here."
        );

        const subtext = escapeHtml(
            subtextText || "Add a short message or details for players."
        );

        previewBox.className =
            `ads-banner-card sponsor-dashboard-preview theme-${themeValue}`;

        previewBox.innerHTML = `
            <div class="ads-suit-decoration" aria-hidden="true">
                ♠ ♥ ♦ ♣
            </div>

            <div class="ads-banner-content">

                <div class="ads-banner-top">
                    <div class="ads-sponsor-brand">
                        <span class="ads-crown-icon">♛</span>

                        <div class="ads-sponsor-info">
                            <span class="ads-featured-label">
                                FEATURED SPONSOR
                            </span>

                            <h3 class="ads-sponsor-name">
                                ${sponsorName}
                            </h3>
                        </div>
                    </div>

                    <span class="ads-partner-badge">
                        PARTNER
                    </span>
                </div>

                <div class="ads-banner-message">
                    <h2 class="ads-banner-headline">
                        ${headline}
                    </h2>

                    <p class="ads-banner-subtext">
                        ${subtext}
                    </p>
                </div>

                <div class="ads-banner-footer">
                    ${
                        safeUrl
                            ? `<a
                                class="ads-cta-link"
                                href="${escapeHtml(safeUrl)}"
                                target="_blank"
                                rel="noopener noreferrer">
                                VISIT SPONSOR ↗
                            </a>`
                            : `<span class="ads-cta-link ads-preview-no-link">
                                VISIT SPONSOR
                            </span>`
                    }

                    <span class="ads-powered-by">
                        POWERED BY OUR PARTNERS
                    </span>
                </div>

            </div>
        `;
    }

    function loadBannerIntoForm(banner) {
        if (!banner) return;

        editingBannerId = String(banner._id);

        if (headlineInput) headlineInput.value = banner.headline || "";
        if (subtextInput) subtextInput.value = banner.subtext || "";
        if (urlInput) urlInput.value = banner.linkUrl || "";
        if (themeSelect) themeSelect.value = banner.theme || "midnight";
        if (durationInput) durationInput.value = Number(banner.durationSec) || 20;
        if (activeCheckbox) activeCheckbox.checked = banner.isActive !== false;

        if (submitBtn) {
            submitBtn.innerHTML = '<i class="bi bi-pencil-square"></i> Save Changes';
        }

        if (cancelEditBtn) {
            cancelEditBtn.style.display = "inline-block";
        }

        updateLivePreview();

        const statusUpper = String(banner.status || "pending").toUpperCase();
        setStatusPill(statusUpper, statusUpper.toLowerCase());

        setFeedback(
            `Editing "<strong>${escapeHtml(banner.headline)}</strong>". Changes will require admin approval.`,
            "info"
        );

        form.scrollIntoView({ behavior: "smooth", block: "start" });
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
                <div style="display: flex; gap: 6px; flex-shrink: 0;">
                    <button
                        type="button"
                        class="sponsor-preview-btn"
                        data-index="${idx}">
                        <i class="bi bi-eye-fill"></i>
                        Preview
                    </button>

                    <button
                        type="button"
                        class="sponsor-edit-btn"
                        data-index="${idx}">
                        <i class="bi bi-pencil-square"></i>
                        Edit
                    </button>

                    <button
                        type="button"
                        class="sponsor-delete-btn"
                        data-id="${escapeHtml(banner._id)}">
                        <i class="bi bi-trash-fill"></i>
                        Delete
                    </button>
                </div>
            `;

            item.addEventListener("click", () => loadBannerIntoForm(banner));
            
            const editBtn = item.querySelector(".sponsor-edit-btn");
            editBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                loadBannerIntoForm(banner);
            });

            const deleteBtn = item.querySelector(".sponsor-delete-btn");

            deleteBtn.addEventListener("click", async (event) => {
                event.stopPropagation();

                const bannerId = deleteBtn.dataset.id;

                if (!confirm("Are you sure you want to delete this banner?")) {
                    return;
                }

                try {
                    const response = await fetch(
                        `${SPONSOR_BANNERS_API}/${encodeURIComponent(bannerId)}`,
                        { method: "DELETE" }
                    );

                    const result = await response.json().catch(() => ({}));

                    if (!response.ok) {
                        alert(result.error || "Failed to delete banner.");
                        return;
                    }

                    submittedBanners = submittedBanners.filter(
                        (b) => String(b._id) !== String(bannerId)
                    );

                    renderSubmittedBanners();
                    setFeedback("Banner deleted successfully.", "success");

                } catch (error) {
                    console.error("Error deleting sponsor banner:", error);
                    alert("Network error while deleting banner.");
                }
            });

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

            if (sponsorNameEl) {
                sponsorNameEl.textContent = currentSponsor.sponsorName;
            }

            if (sponsorCodeEl) {
                sponsorCodeEl.textContent = currentSponsor.sponsorCode;
            }

            updateLivePreview();
        } catch (err) {
            console.warn("Could not hydrate sponsor session details:", err);
        }
    }

        async function fetchExistingBanners() {
        try {
            const res = await fetch('/api/sponsors/my-banners', {
                method: 'GET',
                cache: 'no-store'
            });

            const data = await res.json();

            if (!res.ok) {
                console.warn('Could not load existing banners:', data);
                return;
            }

            const updatedBanners = data.banners || [];

            // Compare previous banner statuses with the updated statuses.
            updatedBanners.forEach((updatedBanner) => {
                const previousBanner = submittedBanners.find(
                    (banner) => String(banner._id) === String(updatedBanner._id)
                );

                if (!previousBanner) return;

                const previousStatus = String(previousBanner.status || "pending").toLowerCase();
                const newStatus = String(updatedBanner.status || "pending").toLowerCase();

                // Only notify when an admin changes a pending banner's status.
                if (previousStatus === "pending" && newStatus === "approved") {
                    showSponsorNotification(
                        "Banner Approved!",
                        `"${updatedBanner.headline}" has been approved and can appear in the live rotation.`,
                        "success"
                    );
                } else if (previousStatus === "pending" && newStatus === "rejected") {
                    const rejectionReason = updatedBanner.moderationNote
                        ? ` Reason: ${updatedBanner.moderationNote}`
                        : "";

                    showSponsorNotification(
                        "Banner Rejected",
                        `"${updatedBanner.headline}" was rejected.${rejectionReason}`,
                        "error"
                    );
                }
            });

            submittedBanners = updatedBanners;
            renderSubmittedBanners();

        } catch (err) {
            console.warn('Could not load existing sponsor banners:', err);
        }
    }

    // Connect to Socket.IO for live sponsor banner updates.
    const socket = io();

    socket.on("SPONSOR_BANNERS_UPDATED", () => {
        console.log("Sponsor banner update received. Refreshing submitted banners...");

        fetchExistingBanners();
    });

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

        // Include the existing banner ID when editing.
        if (editingBannerId) {
            payload.bannerId = editingBannerId;
        }

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

            if (editingBannerId) {
                // Replace the existing banner in the list.
                submittedBanners = submittedBanners.map((banner) =>
                    String(banner._id) === String(editingBannerId)
                        ? savedBanner
                        : banner
                );
            } else {
                // Add a new banner to the list.
                submittedBanners.unshift(savedBanner);
            }

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
                submitBtn.innerHTML = editingBannerId
                    ? '<i class="bi bi-pencil-square"></i> Save Changes'
                    : '<i class="bi bi-send-check-fill"></i> Submit Banner for Approval';
            }
        }
    });

    cancelEditBtn.addEventListener("click", () => {
        editingBannerId = null;
        form.reset();

        if (submitBtn) {
            submitBtn.innerHTML = '<i class="bi bi-send-check-fill"></i> Submit Banner for Approval';
        }

        cancelEditBtn.style.display = "none";

        setFeedback("Editing cancelled. Your existing banner was not changed.", "info");
    });

    form?.addEventListener("reset", () => {
        editingBannerId = null;

        if (submitBtn) {
            submitBtn.innerHTML = '<i class="bi bi-send-check-fill"></i> Submit Banner for Approval';
        }

        if (cancelEditBtn) {
            cancelEditBtn.style.display = "none";
        }

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