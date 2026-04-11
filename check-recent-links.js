/**
 * Check recently created payment links
 */
const mongoose = require('mongoose');
require('dotenv').config();

const MerchantSchema = new mongoose.Schema({
  telegramId: String,
  username: String,
  firstName: String,
  lastName: String,
}, { collection: 'merchants' });

const PaymentLinkSchema = new mongoose.Schema({
  merchantId: mongoose.Schema.Types.ObjectId,
  linkId: String,
  amount: mongoose.Schema.Types.Mixed,
  token: String,
  chain: String,
  isActive: Boolean,
}, { collection: 'paymentlinks', timestamps: true });

const DashboardSessionSchema = new mongoose.Schema({
  merchantId: mongoose.Schema.Types.ObjectId,
  paymentLinkId: mongoose.Schema.Types.ObjectId,
  expiresAt: Date,
  isRevoked: Boolean,
}, { collection: 'dashboardsessions', timestamps: true });

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const Merchant = mongoose.model('Merchant', MerchantSchema);
    const PaymentLink = mongoose.model('PaymentLink', PaymentLinkSchema);
    const DashboardSession = mongoose.model('DashboardSession', DashboardSessionSchema);

    // Get most recent payment links (last 5)
    const recentLinks = await PaymentLink.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('merchantId');

    console.log('\n📊 Last 5 Payment Links Created:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    recentLinks.forEach((link, idx) => {
      const merchant = link.merchantId;
      console.log(`${idx + 1}. Created: ${link.createdAt}`);
      console.log(`   Payment Link ID: ${link._id}`);
      console.log(`   Link ID: ${link.linkId || 'N/A'}`);
      console.log(`   Amount: ${link.amount} ${link.token || 'N/A'}`);
      console.log(`   Merchant: ${merchant?.username || merchant?.telegramId || 'N/A'}`);
      console.log(`   Active: ${link.isActive}`);
      console.log();
    });

    // Get recent dashboard sessions
    const recentSessions = await DashboardSession.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('merchantId')
      .populate('paymentLinkId');

    console.log('\n🔐 Last 5 Dashboard Sessions Created:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (recentSessions.length === 0) {
      console.log('❌ No dashboard sessions found\n');
    } else {
      recentSessions.forEach((session, idx) => {
        const merchant = session.merchantId;
        const now = new Date();
        const isExpired = session.expiresAt < now;
        const isValid = !isExpired && !session.isRevoked;

        console.log(`${idx + 1}. Created: ${session.createdAt}`);
        console.log(`   Session ID: ${session._id}`);
        console.log(`   Merchant: ${merchant?.username || merchant?.telegramId || 'N/A'}`);
        console.log(`   Payment Link: ${session.paymentLinkId?.linkId || session.paymentLinkId?._id || 'N/A'}`);
        console.log(`   Expires: ${session.expiresAt}`);
        console.log(`   Status: ${isValid ? '✅ VALID' : (isExpired ? '❌ EXPIRED' : '⚠️  REVOKED')}`);
        console.log();
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

check();

