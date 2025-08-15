const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const prices = require("./config.json");
const { createClient } = require("@supabase/supabase-js");

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = express();

/**
 * ✅ CORS (allows requests from http://localhost:3000 or any origin)
 *    this is needed so your local test HTML can access the backend
 */
app.use(
  cors({
    origin: "*",
    methods: ["GET","POST"]
  })
);
app.use(express.json());

// Razorpay instance (LIVE)
const razorpay = new Razorpay({
  key_id: "rzp_live_WcDsrduUyVLGWQ",
  key_secret: "NiX5haoQcs25BIISm5OXJtx3"
});

app.get("/", (req, res) => {
  res.send("Razorpay backend is running");
});

// Create order (uses phone instead of email)
app.post("/create-order", async (req, res) => {
  try {
    const { productId, userPhone } = req.body;

    if (!prices[productId]) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const order = await razorpay.orders.create({
      amount: prices[productId].price * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        product_name: prices[productId].name,
        user_phone: userPhone
      }
    });

    res.json({ id: order.id, currency: order.currency, amount: order.amount });
  } catch (err) {
    res.status(500).json({ error: "Order creation failed", details: err.message });
  }
});

// Save to Supabase on successful webhook
async function unlockUserAccess(userPhone, orderId) {
  console.log(`✅ User access unlocked for phone: ${userPhone}, order: ${orderId}`);

  await supabase.from("payments").upsert({
    phone: userPhone,
    order_id: orderId,
    unlocked: true
  });
}

// Razorpay webhook
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const webhookSecret = "kundantiwari0502";
  const receivedSignature = req.headers["x-razorpay-signature"];
  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(req.body).digest("hex");

  if (receivedSignature === expectedSignature) {
    const event = JSON.parse(req.body.toString());
    const payment = event.payload.payment.entity;

    if (event.event === "payment.captured") {
      await unlockUserAccess(payment.notes.user_phone, payment.order_id);
    }
    return res.status(200).json({ status: "success" });
  }
  return res.status(400).json({ status: "invalid signature" });
});

// Verify-payment endpoint
app.get("/verify-payment", async (req, res) => {
  const phone = req.query.phone;
  const { data, error } = await supabase.from("payments").select("unlocked").eq("phone", phone).single();
  if (error || !data) return res.json({ unlocked: false });
  return res.json({ unlocked: data.unlocked });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
