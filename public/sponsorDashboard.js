/**
 * ============================================================================
 * File Name: sponsorDashboard.js
 * Purpose: Client-side controller for sponsorDashboard.html. Verifies sponsor
 *          session access (permission === 3), updates the live banner preview,
 *          validates destination URLs and rotation duration (5-30s), and submits
 *          banners for admin moderation.
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    const sponsorNameEl = document.getElementById("sponsor-name");
    const sponsorCodeEl = document.getElementById("sponsor-code");

    const form = document.getElementById("sponsor-banner-form");
    const headlineInput = document.getElementById("banner-headline");
    const subtextInput = document.getElementById("banner-subtext");
    const urlInput = document.getElementById("banner-url");
    const themeSelect = document.getElementById("banner-theme");
    const durationInput = document.getElementById("banner-duration");
    const activeCheckbox = document.getElementById("banner-active");
    const feedbackEl = document.getElementById("sponsor-form-feedback");

    const previewBox = document.getElementById("banner-preview");
    const previewHeadline = document.getElementById("preview-headline");
    const previewSubtext = document.getElementById("preview-subtext");
    const previewLink = document.getElementById("preview-link");
    const approvalStatusEl = document.getElementById("banner-approval-status");
    const bannerListEl = document.getElementById("sponsor-banner-list");

    let submittedBanners = [];

    function sanitizeHttpUrl(rawUrl) {
        const trimmed = typeof rawUrl === "string" ? rawUrl.trim() : "";
        if (!trimmed) return "";
        try {
            const parsed = new URL(trimmed);
            if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                return parsed.href;
            }
        } catch {
            return "";
        }
        return "";
    }

    function clampDuration(rawSeconds) {
        const num = Number(rawSeconds);
        if (!Number.isFinite(num)) return 20;
        return Math.max(5, Math.min(30, Math.round(num)));
    }

    function setFeedback(message, isError = false) {
        if (!feedbackEl) return;
        feedbackEl.textContent = message;
        feedbackEl.style.color = isError ? "#ff8a80" : "var(--secondary-text)";
    }

    function updatePreview() {
        const headline = (headlineInput?.value || "").trim() || "Your banner headline appears here";
        const subtext = (subtextInput?.value || "").trim() || "Add a short message or link for players.";
        const safeUrl = sanitizeHttpUrl(urlInput?.value || "");
        const theme = themeSelect?.value || "midnight";

        if (previewHeadline) previewHeadline.textContent = headline;
        if (previewSubtext) previewSubtext.textContent = subtext;

        if (previewBox) {
            previewBox.classList.remove("theme-gold", "theme-emerald");
            if (theme === "gold") previewBox.classList.add("theme-gold");
            if (theme === "emerald") previewBox.classList.add("theme-emerald");
        }

        if (previewLink) {
            if (safeUrl) {
                previewLink.href = safeUrl;
                previewLink.style.display = "inline-block";
            } else {
                previewLink.removeAttribute("href");
                previewLink.style.display = "none";
            }
        }
    }

    function renderSubmittedBanners(banners) {
        if (!bannerListEl) return;
        if (!Array.isArray(banners) || banners.length === 0) {
            bannerListEl.textContent = "No banners submitted yet in this session.";
            return;
        }

        bannerListEl.innerHTML = "";
        banners.forEach((item) => {
            const card = document.createElement("div");
            card.style.padding = "10px 12px";
            card.style.marginBottom = "10px";
            card.style.borderRadius = "8px";
            card.style.border = "1px solid var(--border-blue)";
            card.style.background = "var(--page-background)";

            const title = document.createElement("div");
            title.style.fontWeight = "700";
            title.style.color = "var(--main-text)";
            title.textContent = item.headline;

            const meta = document.createElement("div");
            meta.style.fontSize = "11px";
            meta.style.marginTop = "4px";
            meta.style.color = "var(--secondary-text)";
            const statusLabel = (item.status || "pending").toUpperCase();
            const dur = clampDuration(item.durationSec);
            const activeLabel = item.isActive !== false ? "Active" : "Paused";
            meta.textContent = `Status: ${statusLabel} · ${dur}s · ${activeLabel}`;

            card.appendChild(title);
            card.appendChild(meta);

            if (item.moderationNote) {
                const note = document.createElement("div");
                note.style.fontSize = "11px";
                note.style.marginTop = "4px";
                note.style.color = "#f1c40f";
                note.textContent = `Admin Note: ${item.moderationNote}`;
                card.appendChild(note);
            }

            bannerListEl.appendChild(card);
        });
    }

    async function loadSponsorSessionAndBanners() {
        try {
            const res = await fetch("/loggedUser", { credentials: "same-origin" });
            const user = res.ok ? await res.json() : null;

            if (!user) {
                window.location.href = "/login.html";
                return;
            }

            if (Number(user.permission) !== 3) {
                window.location.href = Number(user.permission) === 1 ? "/admin.html" : "/index.html";
                return;
            }

            if (sponsorNameEl) {
                sponsorNameEl.textContent = user.sponsorName || user.username || "Sponsor";
            }
            if (sponsorCodeEl) {
                sponsorCodeEl.textContent = user.sponsorCode || "--";
            }
        } catch (err) {
            console.error("Failed to verify sponsor session:", err);
            setFeedback("Could not verify sponsor session.", true);
        }

        try {
            const listRes = await fetch("/api/sponsors/my-banners", { credentials: "same-origin" });
            if (listRes.ok) {
                const data = await listRes.json();
                submittedBanners = Array.isArray(data.banners) ? data.banners : [];
                renderSubmittedBanners(submittedBanners);
            }
        } catch {
            // Backend endpoint can be added in the next step
        }
    }

    [headlineInput, subtextInput, urlInput, themeSelect].forEach((el) => {
        if (el) {
            el.addEventListener("input", updatePreview);
            el.addEventListener("change", updatePreview);
        }
    });

    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const headline = (headlineInput?.value || "").trim();
            const subtext = (subtextInput?.value || "").trim();
            const rawUrl = (urlInput?.value || "").trim();
            const safeUrl = sanitizeHttpUrl(rawUrl);
            const theme = themeSelect?.value || "midnight";
            const durationSec = clampDuration(durationInput?.value);
            const isActive = Boolean(activeCheckbox?.checked);

            if (!headline) {
                setFeedback("Please enter a banner headline.", true);
                return;
            }

            if (rawUrl && !safeUrl) {
                setFeedback("Destination link must start with http:// or https://.", true);
                return;
            }

            if (durationInput) {
                durationInput.value = String(durationSec);
            }

            const payload = {
                headline,
                subtext,
                linkUrl: safeUrl,
                theme,
                durationSec,
                isActive
            };

            try {
                const response = await fetch("/api/sponsors/banner", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const result = await response.json();
                    const savedBanner = result.banner || { ...payload, status: "pending" };
                    if (approvalStatusEl) {
                        approvalStatusEl.textContent = (savedBanner.status || "pending").toUpperCase();
                    }
                    submittedBanners = [savedBanner, ...submittedBanners.filter((b) => b._id && b._id !== savedBanner._id)];
                    renderSubmittedBanners(submittedBanners);
                    setFeedback("Banner submitted for admin approval.");
                    return;
                }

                if (response.status === 404) {
                    const localDraft = { ...payload, status: "pending", _localId: Date.now() };
                    submittedBanners = [localDraft, ...submittedBanners];
                    renderSubmittedBanners(submittedBanners);
                    if (approvalStatusEl) approvalStatusEl.textContent = "PENDING";
                    setFeedback("Saved locally in preview (wire /api/sponsors/banner next to persist).");
                    return;
                }

                const errData = await response.json().catch(() => ({}));
                setFeedback(errData.error || "Could not submit banner.", true);
            } catch (err) {
                console.error("Error submitting sponsor banner:", err);
                setFeedback("Network error while submitting banner.", true);
            }
        });
    }

    updatePreview();
    loadSponsorSessionAndBanners();
});