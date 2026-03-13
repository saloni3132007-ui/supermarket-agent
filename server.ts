import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PAYMENT_RECEIVER = process.env.PAYMENT_RECEIVER || '0x000';
const PRICE_IN_AVAX = '0.001';

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Supermarket Agent Server Running',
    timestamp: new Date().toISOString()
  });
});

// x402 Protected route
app.get('/query/expiry', (req, res) => {
  const paymentHeader = req.headers['x-payment'];

  if (!paymentHeader) {
    return res.status(402).json({
      error: 'Payment Required',
      price: PRICE_IN_AVAX,
      currency: 'AVAX',
      receiver: PAYMENT_RECEIVER,
      network: 'Avalanche Fuji Testnet',
      instructions: 'Send payment and include tx hash in X-Payment header'
    });
  }

  // Payment received - return inventory data
  const inventory = require('./inventory.json');
  const today = new Date();
  
  const expiring = inventory.filter((item: any) => {
    const expiry = new Date(item.expiry_date);
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 3;
  });

  return res.json({
    success: true,
    payment_received: paymentHeader,
    expiring_soon: expiring,
    total_items: inventory.length,
    expiring_count: expiring.length
  });
});

app.listen(PORT, () => {
  console.log(`✅ Supermarket Agent Server running on port ${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`📦 Expiry: http://localhost:${PORT}/query/expiry`);
});