const ALLOWED_THEMES = new Set(['midnight', 'gold', 'emerald']);

let banners = [];
let activeIndex = 0;
let isPaused = false;
let elapsedMs = 0;
let durationMs = 20000;
let lastTick = Date.now();
let socketInitialized = false;

const bannerContainer = document.getElementById('bannerContainer');
const dotsContainer = document.getElementById('dotsContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const togglePauseBtn = document.getElementById('togglePauseBtn');

function safeUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return '';
    try {
        const parsed = new URL(rawUrl.trim());
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : '';
    } catch {
        return '';
    }
}

function clampDurationSec(sec) {
    const num = Number(sec);
    if (!Number.isFinite(num)) return 20;
    return Math.max(5, Math.min(30, Math.round(num)));
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderEmptyState(message = 'No active sponsor banners available right now.') {
    if (!bannerContainer) return;
    bannerContainer.innerHTML = `
        <section class="ads-empty-state">
            <h2>No Active Banners</h2>
            <p>${escapeHtml(message)}</p>
        </section>
    `;
    if (dotsContainer) dotsContainer.innerHTML = '';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (togglePauseBtn) togglePauseBtn.disabled = true;
}


function renderBanner() {
    if (!bannerContainer) {
        return;
    }

    if (!banners.length) {
        renderEmptyState();
        return;
    }

    if (activeIndex >= banners.length) {
        activeIndex = 0;
    }

    const banner = banners[activeIndex];
    const theme = ALLOWED_THEMES.has(banner.theme) ? banner.theme : 'midnight';
    const href = safeUrl(banner.linkUrl);
    const sec = clampDurationSec(banner.durationSec);

    durationMs = sec * 1000;
    elapsedMs = 0;
    lastTick = Date.now();

    const hasMultiple = banners.length > 1;

    if (prevBtn) {
        prevBtn.disabled = !hasMultiple;
    }

    if (nextBtn) {
        nextBtn.disabled = !hasMultiple;
    }

    if (togglePauseBtn) {
        togglePauseBtn.disabled = !hasMultiple;
    }

    bannerContainer.innerHTML = `
        <article class="ads-banner-card theme-${theme}">

            <div class="ads-suit-decoration" aria-hidden="true">
                <span class="suit-spade">♠</span>
                <span class="suit-heart">♥</span>
                <span class="suit-diamond">♦</span>
                <span class="suit-club">♣</span>
            </div>

            <div class="ads-banner-content">

                <div class="ads-banner-top">

                    <div class="ads-sponsor-brand">
                        <span class="ads-crown-icon">♛</span>

                        <div class="ads-sponsor-info">
                            <span class="ads-featured-label">FEATURED SPONSOR</span>
                            <h2 class="ads-sponsor-name">
                                ${escapeHtml(banner.sponsorName || 'Our Valued Sponsor')}
                            </h2>
                        </div>
                    </div>

                    <span class="ads-partner-badge">PARTNER</span>

                </div>

                <div class="ads-banner-message">
                    <h1 class="ads-banner-headline">
                        ${escapeHtml(banner.headline || 'An Experience Worth Playing For.')}
                    </h1>

                    ${banner.subtext
                        ? `<p class="ads-banner-subtext">${escapeHtml(banner.subtext)}</p>`
                        : ''}
                </div>

                <div class="ads-banner-footer">

                    ${href
                        ? `<a class="ads-cta-link"
                               href="${escapeHtml(href)}"
                               target="_blank"
                               rel="noopener noreferrer">
                               VISIT SPONSOR <span>↗</span>
                           </a>`
                        : '<span></span>'}

                    <span class="ads-powered-by">POWERED BY OUR PARTNERS</span>

                </div>

            </div>

            <div class="ads-banner-counter">
                ${activeIndex + 1} / ${banners.length}
            </div>

            <div class="ads-progress-track">
                <div id="progressBar" class="ads-progress-bar"></div>
            </div>

        </article>
    `;

    if (dotsContainer) {
        dotsContainer.innerHTML = banners.map((_, idx) => `
            <button
                type="button"
                class="ads-dot ${idx === activeIndex ? 'active' : ''}"
                aria-label="Show banner ${idx + 1}"
                data-index="${idx}"
            ></button>
        `).join('');

        dotsContainer.querySelectorAll('.ads-dot').forEach((dot) => {
            dot.addEventListener('click', () => {
                activeIndex = Number(dot.dataset.index);
                renderBanner();
            });
        });
    }
}


function goToNext() {
    if (!banners.length) return;
    activeIndex = (activeIndex + 1) % banners.length;
    renderBanner();
}

function goToPrev() {
    if (!banners.length) return;
    activeIndex = (activeIndex - 1 + banners.length) % banners.length;
    renderBanner();
}

function renderEmbeddedBanners(activeBanners) {
    const embeddedContainers = document.querySelectorAll('.sponsor-banner');

    if (embeddedContainers.length === 0) {
        return;
    }

    embeddedContainers.forEach((container) => {
        if (!activeBanners.length) {
            container.style.display = 'none';
            return;
        }

        const banner = activeBanners[0];
        const theme = ALLOWED_THEMES.has(banner.theme)
            ? banner.theme
            : 'midnight';

        const href = safeUrl(banner.linkUrl);

        container.innerHTML = `
            <div class="lobby-sponsor-content">

                <div class="lobby-sponsor-top">
                    <div class="lobby-sponsor-brand">
                        <span class="lobby-sponsor-crown">♛</span>

                        <div>
                            <span class="lobby-featured-label">
                                FEATURED SPONSOR
                            </span>

                            <h3 class="lobby-sponsor-name">
                                ${escapeHtml(banner.sponsorName || 'Our Valued Sponsor')}
                            </h3>
                        </div>
                    </div>

                    <span class="lobby-partner-badge">PARTNER</span>
                </div>

                <div class="lobby-sponsor-message">
                    <h4>
                        ${escapeHtml(banner.headline || 'An Experience Worth Playing For.')}
                    </h4>

                    ${banner.subtext
                        ? `<p>${escapeHtml(banner.subtext)}</p>`
                        : ''}
                </div>

                <div class="lobby-sponsor-footer">
                    ${href
                        ? `<a href="${escapeHtml(href)}"
                              target="_blank"
                              rel="noopener noreferrer">
                              VISIT SPONSOR ↗
                           </a>`
                        : ''}

                    <span>POWERED BY OUR PARTNERS</span>
                </div>

                <div class="lobby-sponsor-suits" aria-hidden="true">
                    ♠ ♥ ♦ ♣
                </div>

            </div>
        `;

        container.classList.remove(
            'theme-midnight',
            'theme-gold',
            'theme-emerald'
        );

        container.classList.add(`theme-${theme}`);
        container.style.display = 'block';
    });
}

async function loadSponsorBanners() {
    const hasRotationView = Boolean(bannerContainer);
    const hasEmbeddedView = document.querySelectorAll('.sponsor-banner').length > 0;

    if (!hasRotationView && !hasEmbeddedView) return;

    try {
        const response = await fetch('/api/sponsors/active', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Failed to load sponsor banners.');
        }

        const data = await response.json();
        const loaded = Array.isArray(data.banners) ? data.banners : [];

        if (hasRotationView) {
            banners = loaded;
            activeIndex = 0;
            renderBanner();
        }

        if (hasEmbeddedView) {
            renderEmbeddedBanners(loaded);
        }
    } catch (error) {
        console.error('Error loading sponsor banners:', error);
        if (hasRotationView) {
            renderEmptyState('Unable to load sponsor banners at the moment.');
        }
        if (hasEmbeddedView) {
            document.querySelectorAll('.sponsor-banner').forEach((container) => {
                container.style.display = 'none';
            });
        }
    }
}

function initAdsView() {
    if (prevBtn) prevBtn.addEventListener('click', goToPrev);
    if (nextBtn) nextBtn.addEventListener('click', goToNext);
    if (togglePauseBtn) {
        togglePauseBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            lastTick = Date.now();
            togglePauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
        });
    }

    if (bannerContainer) {
        setInterval(() => {
            if (!banners.length || banners.length <= 1 || isPaused) {
                lastTick = Date.now();
                return;
            }
            const now = Date.now();
            elapsedMs += now - lastTick;
            lastTick = now;

            const pct = Math.min(100, (elapsedMs / durationMs) * 100);
            const bar = document.getElementById('progressBar');
            if (bar) bar.style.width = `${pct}%`;

            if (elapsedMs >= durationMs) {
                goToNext();
            }
        }, 100);
    }

    if (!socketInitialized && typeof io === 'function') {
        socketInitialized = true;
        const socket = io();
        socket.on('SPONSOR_BANNERS_UPDATED', () => {
            loadSponsorBanners();
        });
    }

    loadSponsorBanners();
}

document.addEventListener('DOMContentLoaded', initAdsView);