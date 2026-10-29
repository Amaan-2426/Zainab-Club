
const cartItemsContainer = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const clearCartButton = document.getElementById("clear-cart");

function getCart() {
    return JSON.parse(localStorage.getItem("zainabCart")) || [];
}

function saveCart(cart) {
    localStorage.setItem("zainabCart", JSON.stringify(cart));
}

// Support both the older cart format and the new dynamic-product format.
function getItemPrice(item) {
    return Number(item.priceRupees ?? item.price ?? 0);
}

function getItemSize(item) {
    return item.size ?? item.variant?.size ?? null;
}

function getItemColour(item) {
    return item.colour ?? item.variant?.colour ?? null;
}

function getVariantText(item) {
    const size = getItemSize(item);
    const colour = getItemColour(item);

    return "Size: " + (size || "Not applicable") +
        " | Colour: " + (colour || "Not applicable");
}

function displayCart() {
    const cart = getCart();

    cartItemsContainer.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML =
            "<p class='empty-cart'>Your cart is empty.</p>";
    }

    cart.forEach(function (item, index) {
        if (!item.quantity || item.quantity < 1) {
            item.quantity = 1;
        }

        const priceValue = getItemPrice(item);
        total += priceValue * item.quantity;

        const product = document.createElement("div");
        product.className = "cart-item";

        const details = document.createElement("div");

        const name = document.createElement("h3");
        name.textContent = item.name || "Product";

        const options = document.createElement("p");
        options.textContent = getVariantText(item);

        const price = document.createElement("p");
        price.textContent = "₹" + priceValue + " each";

        const quantityControls = document.createElement("div");
        quantityControls.className = "quantity-controls";

        const minusButton = document.createElement("button");
        minusButton.type = "button";
        minusButton.textContent = "−";
        minusButton.setAttribute("aria-label", "Decrease quantity");

        const quantityText = document.createElement("span");
        quantityText.textContent = item.quantity;

        const plusButton = document.createElement("button");
        plusButton.type = "button";
        plusButton.textContent = "+";
        plusButton.setAttribute("aria-label", "Increase quantity");

        minusButton.addEventListener("click", function () {
            const updatedCart = getCart();

            if (updatedCart[index].quantity > 1) {
                updatedCart[index].quantity--;
                saveCart(updatedCart);
                displayCart();
            }
        });

        plusButton.addEventListener("click", function () {
            const updatedCart = getCart();

            updatedCart[index].quantity =
                (updatedCart[index].quantity || 1) + 1;

            saveCart(updatedCart);
            displayCart();
        });

        quantityControls.append(
            minusButton,
            quantityText,
            plusButton
        );

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", function () {
            const updatedCart = getCart();
            updatedCart.splice(index, 1);
            saveCart(updatedCart);
            displayCart();
        });

        details.append(name, options, price, quantityControls);
        product.append(details, removeButton);
        cartItemsContainer.appendChild(product);
    });

    saveCart(cart);
    cartTotal.textContent = "₹" + total;
}

clearCartButton.addEventListener("click", function () {
    localStorage.removeItem("zainabCart");
    displayCart();
});

displayCart();
