
document.addEventListener("DOMContentLoaded", async function () {
    const menGrid = document.getElementById("men-products-grid");
    const jewelleryGrid = document.getElementById("jewellery-products-grid");

    if (typeof window.apiRequest !== "function") {
        showError("Product service is unavailable.");
        return;
    }

    function showError(message) {
        [menGrid, jewelleryGrid].forEach(function (grid) {
            if (!grid) return;

            grid.replaceChildren();

            const text = document.createElement("p");
            text.className = "products-loading";
            text.textContent = message;
            grid.appendChild(text);
        });
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;

        return element;
    }

    function getDetailPage(product) {
        const allowedPages = [
            "product.html",
            "graphic-tshirt.html",
            "oversized-tshirt.html",
            "black-jewellery.html",
            "green-jewellery.html"
        ];

        if (
            typeof product.detail_page === "string" &&
            allowedPages.includes(product.detail_page)
        ) {
            return product.detail_page;
        }

        return "product.html";
    }

    function makeProductCard(product) {
        const link = makeElement("a", "product-card product-link");

       link.href = "dynamic-product.html?id=" + encodeURIComponent(product.id);

        const imageContainer = makeElement("div", "product-image");

        if (product.media_path) {
            const mediaPath = product.media_path;

            if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(mediaPath)) {
                const video = document.createElement("video");
                video.autoplay = true;
                video.muted = true;
                video.loop = true;
                video.playsInline = true;

                const source = document.createElement("source");
                source.src = mediaPath;
                source.type = mediaPath.toLowerCase().includes(".webm")
                    ? "video/webm"
                    : "video/mp4";

                video.appendChild(source);
                imageContainer.appendChild(video);
            } else {
                const image = document.createElement("img");
                image.src = mediaPath;
                image.alt = product.name || "ZAINAB CLUB product";
                image.loading = "lazy";
                image.onerror = function () {
                    image.alt = "Product image unavailable";
                };

                imageContainer.appendChild(image);
            }
        } else {
            imageContainer.appendChild(
                makeElement("div", "product-image-placeholder", "Image coming soon")
            );
        }

        const info = makeElement("div", "product-info");

        info.appendChild(
            makeElement("h3", "", product.name || "Unnamed product")
        );

        info.appendChild(
            makeElement(
                "p",
                "product-price",
                "₹" + Number(product.price_rupees).toLocaleString("en-IN")
            )
        );

        const variants = Array.isArray(product.product_variants)
            ? product.product_variants.filter(function (variant) {
                return variant.is_active;
            })
            : [];

        const sizes = [
            ...new Set(
                variants
                    .map(function (variant) {
                        return variant.size;
                    })
                    .filter(Boolean)
            )
        ];

        if (sizes.length > 0) {
            info.appendChild(
                makeElement("p", "product-sizes", "Sizes: " + sizes.join(", "))
            );
        }

        link.appendChild(imageContainer);
        link.appendChild(info);

        return link;
    }

    function renderProducts(products) {
        menGrid.replaceChildren();
        jewelleryGrid.replaceChildren();

        let menCount = 0;
        let jewelleryCount = 0;

        products.forEach(function (product) {
            if (!product.is_active) return;

            const card = makeProductCard(product);

            if (product.category === "mens_clothing") {
                menGrid.appendChild(card);
                menCount++;
            } else if (product.category === "womens_jewellery") {
                jewelleryGrid.appendChild(card);
                jewelleryCount++;
            }
        });

        if (menCount === 0) {
            menGrid.appendChild(
                makeElement("p", "products-loading", "New men's styles coming soon.")
            );
        }

        if (jewelleryCount === 0) {
            jewelleryGrid.appendChild(
                makeElement("p", "products-loading", "New jewellery coming soon.")
            );
        }
    }

    try {
        const data = await window.apiRequest("/products");
        const products = Array.isArray(data.products) ? data.products : [];

        renderProducts(products);
    } catch (error) {
        console.error("Could not load products:", error);

        showError(
            "We couldn't load the collection. Please check that the backend is running."
        );
    }
});
