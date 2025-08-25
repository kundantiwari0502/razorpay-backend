const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const prices = require("./config.json");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Debug: Confirm Supabase env
console.log("Supabase URL:", process.env.SUPABASE_URL);
console.log("Supabase KEY exists:", !!process.env.SUPABASE_KEY);

const app = express();
app.use(cors());

// ---- Razorpay webhook (raw body BEFORE express.json) ----
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  console.log("Webhook body:", req.body.toString());

  const webhookSecret = "kundantiwari0502";
  const receivedSignature = req.headers["x-razorpay-signature"];
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(req.body)
    .digest("hex");

  if (receivedSignature !== expectedSignature) {
    return res.status(400).json({ status: "invalid signature" });
  }

  const event = JSON.parse(req.body.toString());
  const payment = event.payload.payment.entity;

  if (event.event === "payment.captured") {
    let phone = payment.contact;
    if (phone.startsWith("+91")) {
      phone = phone.substring(3); // Strip country code
    }

    const orderId = payment.order_id;

// Prefer payment.notes if present, else fallback to order.entity.notes
let productId =
  (payment.notes && payment.notes.product_id) ||
  (event?.payload?.order?.entity?.notes && event.payload.order.entity.notes.product_id);

// As a last resort, fetch order from Razorpay
if (!productId) {
  try {
    const order = await razorpay.orders.fetch(orderId);
    productId = order?.notes?.product_id || null;
  } catch (e) {
    console.error("Failed to fetch order for notes:", e);
  }
}

await unlockUserAccess(phone, orderId, productId);


    return res.status(200).json({ status: "success" });
  }

  return res.status(200).json({ status: "ignored" });
});

// Parse JSON after webhook
app.use(express.json());

const razorpay = new Razorpay({
  key_id: "rzp_live_WcDsrduUyVLGWQ",
  key_secret: "NiX5haoQcs25BIISm5OXJtx3"
});

app.get("/", (req, res) => {
  res.send("Razorpay backend is running");
});

app.post("/create-order", async (req, res) => {
  const { productId, userPhone } = req.body;

  if (!prices[productId]) {
    return res.status(400).json({ error: "Invalid product ID" });
  }
  if (!userPhone) {
    return res.status(400).json({ error: "Phone number required" });
  }

  try {
    const order = await razorpay.orders.create({
      amount: prices[productId].price * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { 
  product_id: productId,   // add this line
  product_name: prices[productId].name, 
  user_phone: userPhone 
}

    });
    res.json({ id: order.id, currency: order.currency, amount: order.amount });
  } catch (err) {
    res.status(500).json({ error: "Order creation failed", details: err.message });
  }
});

// ---- Unlock logic (called from webhook) ----
async function unlockUserAccess(phone, orderId, productId) {
  // Strip +91 if Razorpay/some client sends it with country code
  if (phone && phone.startsWith("+91")) {
    phone = phone.substring(3);
  }
// ✅ Guard against missing productId
  if (!productId) {
    console.error("❌ Missing productId; skipping insert", { phone, orderId });
    return;
  }
  console.log(`✅ Access unlocked for phone: ${phone}, order: ${orderId}, product: ${productId}`);

  // Insert payment record into Supabase
  const { data, error } = await supabase
    .from("payments")
    .insert({
      phone,
      order_id: orderId,
      product: productId,
      unlocked: true
    });

  if (error) {
    console.error("❌ Supabase insert failed:", error);
  } else {
    console.log("✅ Supabase insert success:", data);
  }
}

// ---- Verify endpoint (used by thank-you page / dashboard) ----
app.get("/verify-payment", async (req, res) => {
  let phone = req.query.phone;
  const productId = req.query.productId;

  if (!phone || !productId) {
    return res.status(400).json({ unlocked: false, error: "Phone and productId required" });
  }

  // Strip +91 if user typed it
  if (phone.startsWith("+91")) {
    phone = phone.substring(3);
  }

  try {
    // Look up payments for this phone + product
    const { data, error } = await supabase
      .from("payments")
      .select("unlocked")
      .eq("phone", phone)
      .eq("product", productId);

    if (error) {
      console.error("❌ Supabase query failed:", error);
      return res.status(500).json({ unlocked: false, error: "Supabase query failed" });
    }

    const hasUnlocked = Array.isArray(data) && data.some(row => row.unlocked === true);
return res.json({ unlocked: hasUnlocked });


  } catch (err) {
    console.error("❌ Unexpected error in verify-payment:", err);
    return res.status(500).json({ unlocked: false, error: "Internal server error" });
  }
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
