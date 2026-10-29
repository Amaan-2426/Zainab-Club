
document.addEventListener("DOMContentLoaded", async function () {
    const loading = document.getElementById("product-loading");
    const productSection = document.getElementById("dynamic-product");
    const mediaContainer = document.getElementById("dynamic-product-media");
    const categoryElement = document.getElementById("dynamic-product-category");
    const nameElement = document.getElementById("dynamic-product-name");
    const priceElement = document.getElementById("dynamic-product-price");
    const descriptionElement = document.getElementById("dynamic-product-description");
    const variantSelect = document.getElementById("product-variant");
    const quantityInput = document.getElementById("product-quantity");
    const stockElement = document.getElementById("product-stock");
    const addButton = document.getElementById("dynamic-add-to-cart");
    const message = document.getElementById("dynamic-product-message");

    const params = new URLSearchParams(window.location.search);
    const productId = params.get("id");

    function showError(text) {
        loading.textContent = text;
        addButton.disabled = true;
    }

    function formatPrice(price) {
        return "₹" + Number(price).toLocaleString("en-IN");
    }

    function variantLabel(variant) {
        return [
            variant.size,
            variant.colour
        ].filter(Boolean).join(" / ") || "Standard";
    }

    if (!productId) {
        showError("No product was selected. Return to the home page and choose a product.");
        return;
    }

    if (typeof window.apiRequest !== "function") {
        showError("Product service is unavailable. Please try again later.");
        return;
    }

    let product;

    try {
        const data = await window.apiRequest(
            "/products/" + encodeURIComponent(productId)
        );

        product = data.product;

        if (!product) {
            throw new Error("Product was not found.");
        }
    } catch (error) {
        showError(error.message || "Could not load this product.");
        return;
    }

    loading.hidden = true;
    productSection.hidden = false;
    document.title = product.name + " | ZAINAB CLUB";

    nameElement.textContent = product.name;
    categoryElement.textContent =
        product.category === "womens_jewellery"
            ? "WOMEN'S JEWELLERY"
            : "MEN'S CLOTHING";

    priceElement.textContent = formatPrice(product.priceRupees);
    descriptionElement.textContent =
        product.description || "A ZAINAB CLUB everyday essential.";

    if (product.mediaPath) {
        if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(product.mediaPath)) {
            const video = document.createElement("video");
            video.src = product.mediaPath;
            video.autoplay = true;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.controls = true;
            mediaContainer.appendChild(video);
        } else {
            const image = document.createElement("img");
            image.src = product.mediaPath;
            image.alt = product.name;
            image.onerror = function () {
                mediaContainer.textContent = "Product image unavailable.";
            };
            mediaContainer.appendChild(image);
        }
    } else {
        mediaContainer.textContent = "Product image coming soon.";
    }

    const variants = Array.isArray(product.variants)
        ? product.variants
        : [];

    const availableVariants = variants.filter(function (variant) {
        return variant.inStock;
    });

    variantSelect.replaceChildren();

    if (variants.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No variants available";
        variantSelect.appendChild(option);
        variantSelect.disabled = true;
        addButton.disabled = true;
        stockElement.textContent = "This product is currently unavailable.";
        return;
    }

    variants.forEach(function (variant) {
        const option = document.createElement("option");
        option.value = variant.id;
        option.textContent = variantLabel(variant) +
            (variant.inStock ? "" : " — Out of stock");
        option.disabled = !variant.inStock;
        variantSelect.appendChild(option);
    });

    function updateStock() {
        const selected = variants.find(function (variant) {
            return variant.id === variantSelect.value;
        });

        if (!selected) {
            stockElement.textContent = "Please choose an available variant.";
            addButton.disabled = true;
            return;
        }

        if (!selected.inStock) {
            stockElement.textContent = "Out of stock.";
            addButton.disabled = true;
            return;
        }

        if (selected.stockTracked) {
            stockElement.textContent =
                selected.quantityAvailable + " item(s) in stock.";

            quantityInput.max = String(selected.quantityAvailable);

            if (Number(quantityInput.value) > selected.quantityAvailable) {
                quantityInput.value = String(
                    Math.max(1, selected.quantityAvailable)
                );
            }
        } else {
            stockElement.textContent = "Available.";
            quantityInput.removeAttribute("max");
        }

        addButton.disabled = false;
    }

    if (availableVariants.length === 0) {
        stockElement.textContent = "All variants are currently out of stock.";
        addButton.disabled = true;
    }

    variantSelect.addEventListener("change", updateStock);
    quantityInput.addEventListener("input", updateStock);
    updateStock();

    addButton.addEventListener("click", function () {
        const selected = variants.find(function (variant) {
            return variant.id === variantSelect.value;
        });

        const quantity = Number(quantityInput.value);

        if (!selected || !selected.inStock) {
            message.textContent = "Please choose an available variant.";
            return;
        }

        if (!Number.isSafeInteger(quantity) || quantity < 1) {
            message.textContent = "Enter a valid quantity.";
            return;
        }

        if (
            selected.stockTracked &&
            quantity > selected.quantityAvailable
        ) {
            message.textContent = "There is not enough stock for that quantity.";
            return;
        }

        // Temporary cart integration using localStorage.
        // The checkout process must still validate stock on the server.
       
        // Add the selected product to the shared ZAINAB CLUB cart.
        const cart = JSON.parse(
            localStorage.getItem("zainabCart") || "[]"
        );

        const existing = cart.find(function (item) {
            return item.productId === product.id &&
                item.variantId === selected.id;
        });

        const newQuantity = (existing ? existing.quantity : 0) + quantity;

        if (
            selected.stockTracked &&
            newQuantity > selected.quantityAvailable
        ) {
            message.textContent =
                "Your cart quantity would exceed available stock.";
            return;
        }

        if (typeof addToZainabCart === "function") {
            addToZainabCart({
                productId: product.id,
                variantId: selected.id,
                name: product.name,
                priceRupees: product.priceRupees,
                size: selected.size,
                colour: selected.colour,
                variant: selected,
                quantity: quantity,
                mediaPath: product.mediaPath || null
            });

            message.textContent = "Added to cart successfully!";
        } else {
            message.textContent =
                "Cart service unavailable. Please refresh and try again.";
        }
    });
});
