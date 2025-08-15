const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const prices = require("./config.json");

// <--- Supabase client
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// Razorpay instance
const razorpay = new Razorpay({
  key_id: "rzp_live_WcDsrduUyVLGWQ",
  key_secret: "NiX5haoQcs25BIISm5OXJtx3"
});

// Root route
app.get("/", (req, res) => {
  res.send("Razorpay backend is running");
});

// Create order
app.post("/create-order", async (req, res) => {
  try {
    const { productId, userEmail } = req.body;

    if (!prices[productId]) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const order = await razorpay.orders.create({
      amount: prices[productId].price * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { product_name: prices[productId].name, user_email: userEmail }
    });

    res.json({ id: order.id, currency: order.currency, amount: order.amount });
  } catch (err) {
    res.status(500).json({ error: "Order creation failed", details: err.message });
  }
});

// ✅ Unlock logic: save to Supabase when webhook confirms payment
async function unlockUserAccess(userEmail, orderId) {
  console.log(`✅ User access unlocked for email: ${userEmail}, order: ${orderId}`);

  try {
    const { data, error } = await supabase
      .from("payments")
      .upsert({
        email: userEmail,
        order_id: orderId,
        unlocked: true
      });

    if (error) {
      console.error("❌ Failed to update Supabase:", error);
    } else {
      console.log("✅ Supabase updated:", data);
    }
  } catch (err) {
    console.error("❌ Supabase error:", err);
  }
}

// Webhook route
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
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
      const userEmail = payment.notes.user_email;
      const orderId = payment.order_id;
      unlockUserAccess(userEmail, orderId);
      res.status(200).json({ status: "success" });
    } else {
      res.status(200).json({ status: "ignored" });
    }
  } else {
    res.status(400).json({ status: "invalid signature" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
