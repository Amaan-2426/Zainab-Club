const API_BASE = "http://localhost:3000/api";

// =========================================
// LOGIN ELEMENTS
// =========================================
const loginForm = document.getElementById("admin-login-form");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-password");
const message = document.getElementById("admin-message");

// =========================================
// ORDER DASHBOARD ELEMENTS
// =========================================
const tableBody = document.getElementById("orders-table-body");
const totalOrders = document.getElementById("total-orders");
const pendingOrders = document.getElementById("pending-orders");
const paidOrders = document.getElementById("paid-orders");
const refreshButton = document.getElementById("refresh-orders");

// =========================================
// PRODUCT MANAGEMENT ELEMENTS
// =========================================
const productForm = document.getElementById("product-form");
const productIdInput = document.getElementById("product-id");
const productNameInput = document.getElementById("product-name");
const productSlugInput = document.getElementById("product-slug");
const productCategoryInput = document.getElementById("product-category");
const productPriceInput = document.getElementById("product-price");
const productDescriptionInput = document.getElementById("product-description");
const productImageInput = document.getElementById("product-image");
const productSizeInput = document.getElementById("product-size");
const productColourInput = document.getElementById("product-colour");
const productSkuInput = document.getElementById("product-sku");
const productQuantityInput = document.getElementById("product-quantity");
const productMessage = document.getElementById("product-message");
const productsTableBody = document.getElementById("products-table-body");
const refreshProductsButton = document.getElementById("refresh-products");
const cancelProductEditButton = document.getElementById("cancel-product-edit");
const saveProductButton = document.getElementById("save-product-button");

// =========================================
// INVENTORY DASHBOARD ELEMENTS
// These elements must exist in admin.html.
// =========================================
const inventoryTableBody = document.getElementById("inventory-table-body");
const inventoryMessage = document.getElementById("inventory-message");
const inventoryFilter = document.getElementById("inventory-filter");
const refreshInventoryButton = document.getElementById("refresh-inventory");

let inventoryVariants = [];
let isLoggedIn = false;

// =========================================
// SHARED HELPERS
// =========================================
function showMessage(text) {
    message.textContent = text;
}

function showProductMessage(text) {
    productMessage.textContent = text;
}

function showInventoryMessage(text) {
    if (inventoryMessage) {
        inventoryMessage.textContent = text;
    }
}

function makeCell(value) {
    const cell = document.createElement("td");
    cell.textContent =
        value == null || value === "" ? "—" : String(value);
    return cell;
}

function formatStatus(status) {
    return String(status || "unknown").replaceAll("_", " ");
}

function formatMoney(amount) {
    const value = Number(amount);

    return Number.isFinite(value)
        ? `₹${value.toFixed(2)}`
        : "—";
}

function makeActionButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
}

// =========================================
// AUTHENTICATED API REQUEST
// =========================================
async function adminRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload || payload.ok === false) {
        if (response.status === 401) {
            isLoggedIn = false;
        }

        throw new Error(
            payload?.error?.message ||
            (response.status === 401
                ? "Please sign in again. Your admin session may have expired."
                : "The request failed. Please try again.")
        );
    }

    return payload.data;
}

// =========================================
// ORDER STATUS CONTROL
// =========================================
function addStatusSelect(order) {
    const cell = document.createElement("td");
    const select = document.createElement("select");

    const statuses = [
        "pending_payment",
        "confirmed",
        "processing",
        "fulfilled",
        "cancelled"
    ];

    statuses.forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = formatStatus(status);
        option.selected = status === order.status;
        select.appendChild(option);
    });

    select.addEventListener("change", async () => {
        const newStatus = select.value;
        select.disabled = true;
        showMessage(`Updating order ${order.id}...`);

        try {
            await adminRequest(
                `/admin/orders/${encodeURIComponent(order.id)}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ status: newStatus })
                }
            );

            showMessage("Order status updated successfully.");
        } catch (error) {
            showMessage(error.message);
        }

        await loadOrders();
    });

    cell.appendChild(select);
    return cell;
}

// =========================================
// ORDER DETAILS DIALOG
// =========================================
function showOrderDetails(order) {
    const dialog = document.createElement("dialog");
    dialog.className = "order-details-dialog";

    const heading = document.createElement("h2");
    heading.textContent = "Order Details";
    dialog.appendChild(heading);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => dialog.close());
    dialog.appendChild(closeButton);

    function addSection(title, value) {
        const section = document.createElement("p");
        const strong = document.createElement("strong");

        strong.textContent = `${title}: `;
        section.appendChild(strong);
        section.appendChild(
            document.createTextNode(
                value == null || value === "" ? "—" : String(value)
            )
        );

        dialog.appendChild(section);
    }

    addSection("Order ID", order.id);
    addSection("Customer", order.customer_name);
    addSection("Email", order.customer_email);
    addSection("Phone", order.customer_phone);

    const address = order.address || {};

    const addressParts = [
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postal_code,
        address.country
    ].filter(Boolean);

    addSection("Delivery Address", addressParts.join(", "));
    addSection("Order Notes", order.notes);
    addSection("Order Status", formatStatus(order.status));
    addSection("Payment Status", formatStatus(order.payment_status));
    addSection("Total", formatMoney(order.total_amount));

    addSection(
        "Order Date",
        order.created_at
            ? new Date(order.created_at).toLocaleString()
            : "—"
    );

    const itemsHeading = document.createElement("h3");
    itemsHeading.textContent = "Products Ordered";
    dialog.appendChild(itemsHeading);

    if (!Array.isArray(order.items) || order.items.length === 0) {
        const noItems = document.createElement("p");
        noItems.textContent =
            "No product items were returned for this order.";
        dialog.appendChild(noItems);
    } else {
        const list = document.createElement("ul");

        order.items.forEach((item) => {
            const li = document.createElement("li");

            const details = [
                item.product_name || "Product",
                item.size ? `Size: ${item.size}` : null,
                item.colour ? `Colour: ${item.colour}` : null,
                `Quantity: ${item.quantity ?? "—"}`,
                `Unit price: ${formatMoney(item.unit_price_rupees)}`,
                `Line total: ${formatMoney(item.line_total_rupees)}`
            ].filter(Boolean);

            li.textContent = details.join(" | ");
            list.appendChild(li);
        });

        dialog.appendChild(list);
    }

    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            dialog.close();
        }
    });

    dialog.addEventListener("close", () => dialog.remove());

    document.body.appendChild(dialog);
    dialog.showModal();
}

async function viewOrderDetails(orderId, button) {
    button.disabled = true;
    showMessage("Loading order details...");

    try {
        const data = await adminRequest(
            `/admin/orders/${encodeURIComponent(orderId)}`
        );

        if (!data.order) {
            throw new Error(
                "Order details were not returned by the server."
            );
        }

        showOrderDetails(data.order);
        showMessage("Order details loaded.");
    } catch (error) {
        showMessage(error.message);
    } finally {
        button.disabled = false;
    }
}

function addDetailsButton(order) {
    const cell = document.createElement("td");
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = "View Details";

    button.addEventListener("click", () => {
        viewOrderDetails(order.id, button);
    });

    cell.appendChild(button);
    return cell;
}

// =========================================
// LOAD ORDERS
// =========================================
async function loadOrders() {
    if (!isLoggedIn) {
        showMessage("Please sign in before loading orders.");
        return;
    }

    refreshButton.disabled = true;
    showMessage("Loading orders...");

    try {
        const data = await adminRequest("/admin/orders");
        const orders = Array.isArray(data.orders) ? data.orders : [];

        totalOrders.textContent = String(orders.length);

        pendingOrders.textContent = String(
            orders.filter(
                (order) => order.payment_status !== "paid"
            ).length
        );

        paidOrders.textContent = String(
            orders.filter(
                (order) => order.payment_status === "paid"
            ).length
        );

        tableBody.replaceChildren();

        if (orders.length === 0) {
            const row = document.createElement("tr");
            const cell = makeCell("No orders found.");
            cell.colSpan = 8;
            row.appendChild(cell);
            tableBody.appendChild(row);
        }

        orders.forEach((order) => {
            const row = document.createElement("tr");

            row.appendChild(makeCell(order.id));
            row.appendChild(makeCell(order.customer_name));

            row.appendChild(
                makeCell(
                    order.created_at
                        ? new Date(order.created_at).toLocaleString()
                        : "—"
                )
            );

            row.appendChild(makeCell(formatMoney(order.total_amount)));
            row.appendChild(makeCell(order.payment_status));
            row.appendChild(makeCell(order.status));
            row.appendChild(addStatusSelect(order));
            row.appendChild(addDetailsButton(order));

            tableBody.appendChild(row);
        });

        showMessage("Orders loaded successfully.");
    } catch (error) {
        showMessage(error.message);
    } finally {
        refreshButton.disabled = false;
    }
}

// =========================================
// PRODUCT MANAGEMENT
// =========================================
async function loadProducts() {
    if (!isLoggedIn) {
        showProductMessage("Please sign in before loading products.");
        return;
    }

    refreshProductsButton.disabled = true;
    showProductMessage("Loading products...");

    try {
        const data = await adminRequest("/admin/products");
        const products = Array.isArray(data.products)
            ? data.products
            : [];

        productsTableBody.replaceChildren();

        if (products.length === 0) {
            const row = document.createElement("tr");
            const cell = makeCell("No products found.");
            cell.colSpan = 5;
            row.appendChild(cell);
            productsTableBody.appendChild(row);
        }

        products.forEach((product) => {
            const row = document.createElement("tr");

            row.appendChild(makeCell(product.name));
            row.appendChild(makeCell(product.category));
            row.appendChild(makeCell(formatMoney(product.price_rupees)));
            row.appendChild(
                makeCell(product.is_active ? "Active" : "Inactive")
            );

            const actionsCell = document.createElement("td");

            actionsCell.appendChild(
                makeActionButton("Edit", () => editProduct(product))
            );

            actionsCell.appendChild(
                makeActionButton(
                    product.is_active ? "Deactivate" : "Activate",
                    () => changeProductStatus(product)
                )
            );

            row.appendChild(actionsCell);
            productsTableBody.appendChild(row);
        });

        showProductMessage(`${products.length} product(s) loaded.`);
    } catch (error) {
        showProductMessage(error.message);
    } finally {
        refreshProductsButton.disabled = false;
    }
}

function editProduct(product) {
    productIdInput.value = product.id;
    productNameInput.value = product.name || "";
    productSlugInput.value = product.slug || "";
    productCategoryInput.value =
        product.category || "mens_clothing";
    productPriceInput.value = product.price_rupees ?? "";
    productDescriptionInput.value = product.description || "";
    productImageInput.value = product.media_path || "";

    const variants = Array.isArray(product.product_variants)
        ? product.product_variants.filter(
            (variant) => variant.is_active
        )
        : [];

    const firstVariant = variants[0] || {};

    productSizeInput.value = firstVariant.size || "";
    productColourInput.value = firstVariant.colour || "";
    productSkuInput.value = firstVariant.sku || "";

    const inventory = firstVariant.inventory;
    const stock = Array.isArray(inventory)
        ? inventory[0]
        : inventory;

    // Preserve unknown stock as blank instead of converting it to zero.
    productQuantityInput.value = stock?.quantity ?? "";

    document.getElementById("product-form-heading").textContent =
        "Edit Product";

    saveProductButton.textContent = "Update Product";
    cancelProductEditButton.hidden = false;

    document.getElementById("products-section").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    showProductMessage(
        `Editing "${product.name}". Use Inventory Management to change stock.`
    );
}

function resetProductForm() {
    productForm.reset();
    productIdInput.value = "";
    productQuantityInput.value = "0";

    document.getElementById("product-form-heading").textContent =
        "Add New Product";

    saveProductButton.textContent = "Save Product";
    cancelProductEditButton.hidden = true;
}

async function changeProductStatus(product) {
    const nextStatus = !product.is_active;
    const action = nextStatus ? "activate" : "deactivate";

    if (
        !confirm(
            `Are you sure you want to ${action} "${product.name}"?`
        )
    ) {
        return;
    }

    try {
        await adminRequest(
            `/admin/products/${encodeURIComponent(product.id)}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({ isActive: nextStatus })
            }
        );

        showProductMessage(
            `Product ${nextStatus ? "activated" : "deactivated"} successfully.`
        );

        await loadProducts();
        await loadInventory();
    } catch (error) {
        showProductMessage(error.message);
    }
}

// Add a product or update its basic details.
productForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isLoggedIn) {
        showProductMessage("Please sign in first.");
        return;
    }

    const id = productIdInput.value.trim();

    const product = {
        name: productNameInput.value.trim(),
        slug: productSlugInput.value.trim().toLowerCase(),
        category: productCategoryInput.value,
        priceRupees: Number(productPriceInput.value),
        description: productDescriptionInput.value.trim(),
        mediaPath: productImageInput.value.trim() || null
    };

    if (
        !product.name ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) ||
        !Number.isSafeInteger(product.priceRupees) ||
        product.priceRupees <= 0
    ) {
        showProductMessage(
            "Enter a valid name, lowercase hyphen-separated slug, and positive whole-number price."
        );
        return;
    }

    const variant = {
        size: productSizeInput.value.trim() || null,
        colour: productColourInput.value.trim() || null,
        sku: productSkuInput.value.trim() || null,
        quantity: Number(productQuantityInput.value)
    };

    if (
        !Number.isSafeInteger(variant.quantity) ||
        variant.quantity < 0
    ) {
        showProductMessage(
            "Stock must be a non-negative whole number."
        );
        return;
    }

    saveProductButton.disabled = true;

    try {
        if (id) {
            // Editing a product does not change its variant stock.
            await adminRequest(
                `/admin/products/${encodeURIComponent(id)}`,
                {
                    method: "PATCH",
                    body: JSON.stringify(product)
                }
            );

            showProductMessage(
                "Product details updated. Use Inventory Management to change stock."
            );
        } else {
            await adminRequest("/admin/products", {
                method: "POST",
                body: JSON.stringify({
                    ...product,
                    variants: [variant]
                })
            });

            showProductMessage("Product created successfully.");
            resetProductForm();
        }

        await Promise.all([loadProducts(), loadInventory()]);
    } catch (error) {
        showProductMessage(error.message);
    } finally {
        saveProductButton.disabled = false;
    }
});

// =========================================
// INVENTORY DASHBOARD
// =========================================
function getStockStatus(quantity) {
    if (quantity == null) return "unconfirmed";
    if (quantity === 0) return "out-of-stock";
    return "in-stock";
}

async function loadInventory() {
    if (!inventoryTableBody || !inventoryFilter || !refreshInventoryButton) {
        showInventoryMessage(
            "Inventory elements are missing. Check the inventory section in admin.html."
        );
        return;
    }

    if (!isLoggedIn) {
        showInventoryMessage("Please sign in before loading inventory.");
        return;
    }

    refreshInventoryButton.disabled = true;
    showInventoryMessage("Loading inventory...");

    try {
        const data = await adminRequest("/admin/products");
        const products = Array.isArray(data.products) ? data.products : [];

        inventoryVariants = [];

        products.forEach((product) => {
            const variants = Array.isArray(product.product_variants)
                ? product.product_variants
                : [];

            variants.forEach((variant) => {
                const inventory = variant.inventory;
                const stock = Array.isArray(inventory)
                    ? inventory[0]
                    : inventory;

                inventoryVariants.push({
                    productId: product.id,
                    productName: product.name,
                    productActive: product.is_active,
                    price: product.price_rupees,
                    variantId: variant.id,
                    size: variant.size,
                    colour: variant.colour,
                    sku: variant.sku,
                    variantActive: variant.is_active,
                    quantity: stock?.quantity ?? null
                });
            });
        });

        renderInventory();
        showInventoryMessage(
            `${inventoryVariants.length} variant(s) loaded.`
        );
    } catch (error) {
        showInventoryMessage(error.message);
    } finally {
        refreshInventoryButton.disabled = false;
    }
}

function renderInventory() {
    if (!inventoryTableBody || !inventoryFilter) return;

    inventoryTableBody.replaceChildren();

    const filter = inventoryFilter.value;

    const filtered = inventoryVariants.filter((variant) => {
        const status = getStockStatus(variant.quantity);

        if (filter === "all") return true;
        return status === filter;
    });

    if (filtered.length === 0) {
        const row = document.createElement("tr");
        const cell = makeCell("No variants match this filter.");
        cell.colSpan = 8;
        row.appendChild(cell);
        inventoryTableBody.appendChild(row);
        return;
    }

    filtered.forEach((variant) => {
        const row = document.createElement("tr");

        row.appendChild(makeCell(variant.productName));
        row.appendChild(makeCell(variant.size));
        row.appendChild(makeCell(variant.colour));
        row.appendChild(makeCell(variant.sku));
        row.appendChild(makeCell(formatMoney(variant.price)));

        const status = getStockStatus(variant.quantity);
        let statusLabel = "Unconfirmed";

        if (status === "in-stock") statusLabel = "In Stock";
        if (status === "out-of-stock") statusLabel = "Out of Stock";

        const statusCell = makeCell(statusLabel);

        if (!variant.productActive || !variant.variantActive) {
            statusCell.textContent += " (Inactive)";
        }

        row.appendChild(statusCell);

        const quantityCell = document.createElement("td");
        const quantityInput = document.createElement("input");

        quantityInput.type = "number";
        quantityInput.min = "0";
        quantityInput.step = "1";
        quantityInput.inputMode = "numeric";
        quantityInput.placeholder = "Enter stock";
        quantityInput.setAttribute(
            "aria-label",
            `Stock quantity for ${variant.productName}`
        );

        // Unconfirmed stock stays blank until a verified quantity is entered.
        quantityInput.value = variant.quantity == null
            ? ""
            : String(variant.quantity);

        quantityInput.style.width = "110px";
        quantityInput.style.minHeight = "42px";
        quantityInput.style.padding = "8px";
        quantityInput.style.border = "1px solid #d9d0c4";

        quantityCell.appendChild(quantityInput);
        row.appendChild(quantityCell);

        const actionCell = document.createElement("td");

        const saveButton = makeActionButton("Save Stock", async () => {
            const rawValue = quantityInput.value.trim();
            const quantity = Number(rawValue);

            if (
                rawValue === "" ||
                !Number.isSafeInteger(quantity) ||
                quantity < 0
            ) {
                showInventoryMessage(
                    "Enter a verified, non-negative whole-number stock quantity."
                );
                quantityInput.focus();
                return;
            }

            saveButton.disabled = true;
            showInventoryMessage(
                `Saving stock for ${variant.productName}...`
            );

            try {
                await adminRequest(
                    `/admin/inventory/${encodeURIComponent(variant.variantId)}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({ quantity })
                    }
                );

                variant.quantity = quantity;
                renderInventory();

                showInventoryMessage(
                    `Stock saved for ${variant.productName}.`
                );
            } catch (error) {
                showInventoryMessage(error.message);
                saveButton.disabled = false;
            }
        });

        actionCell.appendChild(saveButton);
        row.appendChild(actionCell);

        inventoryTableBody.appendChild(row);
    });
}

// =========================================
// BUTTON EVENTS
// =========================================
refreshButton.addEventListener("click", loadOrders);
refreshProductsButton.addEventListener("click", loadProducts);

if (refreshInventoryButton) {
    refreshInventoryButton.addEventListener("click", loadInventory);
}

if (inventoryFilter) {
    inventoryFilter.addEventListener("change", renderInventory);
}

cancelProductEditButton.addEventListener("click", () => {
    resetProductForm();
    showProductMessage("Edit cancelled.");
});

// =========================================
// ADMIN LOGIN
// =========================================
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage("Please enter your admin email and password.");
        return;
    }

    const submitButton = loginForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    showMessage("Signing in...");

    try {
        await adminRequest("/admin/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        isLoggedIn = true;
        passwordInput.value = "";

        showMessage("Login successful. Loading your dashboard...");

        await Promise.all([
            loadOrders(),
            loadProducts(),
            loadInventory()
        ]);
    } catch (error) {
        isLoggedIn = false;
        showMessage(error.message);
        showProductMessage("Sign in to manage products.");
        showInventoryMessage("Sign in to view inventory.");
    } finally {
        submitButton.disabled = false;
    }
});