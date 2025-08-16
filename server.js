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
    await unlockUserAccess(phone, orderId);
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

  // DEBUG — see what is being inserted
  console.log("Inserting into Supabase:", { phone, order_id: orderId, unlocked: true });

  const { data, error } = await supabase
    .from("payments")
    .insert({
      phone,
      order_id: orderId,
      unlocked: true
    });

  // DEBUG — show result
  console.log("Supabase insert result -> data:", data, "error:", error);
}

// ---- Verify endpoint (used by thank-you page) ----
app.get("/verify-payment", async (req, res) => {
  let phone = req.query.phone;
  if (!phone) return res.status(400).json({ unlocked: false, error: "Phone number required" });

  // Strip +91 if user typed it in the URL
  if (phone.startsWith("+91")) {
    phone = phone.substring(3);
  }

  // Find *all* rows for this phone
  const { data, error } = await supabase
    .from("payments")
    .select("unlocked")
    .eq("phone", phone);

  if (error) {
    return res.status(500).json({ unlocked: false, error: "Supabase query failed" });
  }

  // If ANY row has unlocked=true, grant access
  const hasUnlocked = data.some(row => row.unlocked === true);
  return res.json({ unlocked: hasUnlocked });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
