const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const prices = require("./config.json");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = express();
app.use(cors());

// ---- Razorpay webhook (raw body BEFORE express.json) ----
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const webhookSecret = "kundantiwari0502";
  const receivedSignature = req.headers["x-razorpay-signature"];

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(req.body)
    .digest("hex");

  if (receivedSignature === expectedSignature) {
    const event = JSON.parse(req.body.toString());
    const payment = event.payload.payment.entity;

    if (event.event === "payment.captured") {
      const phone   = payment.contact;     // --> phone number from Razorpay
      const orderId = payment.order_id;
      await unlockUserAccess(phone, orderId);
      return res.status(200).json({ status: "success" });
    }
    return res.status(200).json({ status: "ignored" });
  }

  res.status(400).json({ status: "invalid signature" });
});

// JSON parser for all remaining routes
app.use(express.json());

const razorpay = new Razorpay({
  key_id: "rzp_live_WcDsrduUyVLGWQ",
  key_secret: "NiX5haoQcs25BIISm5OXJtx3"
});

// Root
app.get("/", (req, res) => {
  res.send("Razorpay backend is running");
});

// ---- Create order (frontend calls this) ----
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
      notes: { product_name: prices[productId].name, user_phone: userPhone }
    });
    res.json({ id: order.id, currency: order.currency, amount: order.amount });
  } catch (err) {
    res.status(500).json({ error: "Order creation failed", details: err.message });
  }
});

// ---- Unlock logic (called from webhook) ----
async function unlockUserAccess(phone, orderId) {
  console.log(`✅ Access unlocked for phone: ${phone}, order: ${orderId}`);
  // insert a new row so users can buy multiple products with same phone
  await supabase
    .from("payments")
    .insert({
      phone: phone,
      order_id: orderId,
      unlocked: true
    });
}


// ---- Verify endpoint (used by thank-you page) ----
app.get("/verify-payment", async (req, res) => {
  const phone = req.query.phone;

  if (!phone) {
    return res.status(400).json({ unlocked: false, error: "Phone number required" });
  }

  const { data, error } = await supabase
    .from("payments")
    .select("unlocked")
    .eq("phone", phone)
    .single();

  if (error) {
    return res.status(500).json({ unlocked: false, error: "Supabase query failed" });
  }

  if (data && data.unlocked === true) {
    return res.json({ unlocked: true });
  }
  return res.json({ unlocked: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
