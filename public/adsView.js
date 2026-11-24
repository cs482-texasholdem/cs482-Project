async function loadSponsorBanners() {
    const bannerContainers = document.querySelectorAll(".sponsor-banner");

    if (bannerContainers.length === 0) {
        return;
    }

    try {
        const response = await fetch("/api/sponsors/active", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Failed to load sponsor banners.");
        }

        const data = await response.json();
        const banners = data.banners || [];

        bannerContainers.forEach((container) => {
            if (banners.length === 0) {
                container.style.display = "none";
                return;
            }

            const banner = banners[0];

            const headline = container.querySelector(".sponsor-headline");
            const subtext = container.querySelector(".sponsor-subtext");
            const link = container.querySelector(".sponsor-link");

            if (headline) {
                headline.textContent = banner.headline || "";
            }

            if (subtext) {
                subtext.textContent = banner.subtext || "";
            }

            if (link) {
                if (banner.linkUrl) {
                    link.href = banner.linkUrl;
                    link.style.display = "inline";
                } else {
                    link.style.display = "none";
                }
            }

            container.style.display = "block";
        });

    } catch (error) {
        console.error("Error loading sponsor banners:", error);

        bannerContainers.forEach((container) => {
            container.style.display = "none";
        });
    }
}
