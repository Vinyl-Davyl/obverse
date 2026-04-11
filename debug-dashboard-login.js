/**
 * Debug script to check dashboard login issues
 * Run with: node debug-dashboard-login.js <your_identifier>
 */

const mongoose = require('mongoose');
require('dotenv').config();

const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Usage: node debug-dashboard-login.js <identifier>');
  console.error('   Example: node debug-dashboard-login.js myusername');
  console.error('   Example: node debug-dashboard-login.js 123456789');
  process.exit(1);
}

// Define schemas
const MerchantSchema = new mongoose.Schema({
  telegramId: String,
  username: String,
  firstName: String,
  lastName: String,
  walletAddress: String,
}, { collection: 'merchants' });

const DashboardSessionSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
  paymentLinkId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentLink' },
  passwordHash: String,
  expiresAt: Date,
  isUsed: { type: Boolean, default: false },
  isRevoked: { type: Boolean, default: false },
  lastUsedAt: Date,
  ipAddress: String,
  userAgent: String,
}, { collection: 'dashboardsessions', timestamps: true });

const PaymentLinkSchema = new mongoose.Schema({
  name: String,
  merchantId: mongoose.Schema.Types.ObjectId,
  amount: String,
  currency: String,
  isActive: Boolean,
}, { collection: 'paymentlinks' });

async function debug() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Merchant = mongoose.model('Merchant', MerchantSchema);
    const DashboardSession = mongoose.model('DashboardSession', DashboardSessionSchema);
    const PaymentLink = mongoose.model('PaymentLink', PaymentLinkSchema);

    // Clean identifier
    const cleanIdentifier = identifier.replace('@', '').trim();
    console.log(`🔍 Searching for identifier: "${cleanIdentifier}"\n`);

    // Step 1: Find merchant
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Finding Merchant');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const merchant = await Merchant.findOne({
      $or: [
        { username: cleanIdentifier },
        { telegramId: cleanIdentifier },
      ],
    });

    if (!merchant) {
      console.log('❌ MERCHANT NOT FOUND');
      console.log('\n📋 Possible reasons:');
      console.log('   1. Wrong identifier - check your username or telegram ID');
      console.log('   2. Merchant not registered yet');
      console.log('\n💡 Solution: Make sure you have a merchant account');
      console.log('   Try searching in your merchants collection to find the correct identifier');
      process.exit(1);
    }

    console.log('✅ Merchant found:');
    console.log(`   ID: ${merchant._id}`);
    console.log(`   Telegram ID: ${merchant.telegramId || 'N/A'}`);
    console.log(`   Username: ${merchant.username || 'N/A'}`);
    console.log(`   Name: ${merchant.firstName || ''} ${merchant.lastName || ''}`);
    console.log(`   Wallet: ${merchant.walletAddress || 'N/A'}\n`);

    // Step 2: Check payment links
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Checking Payment Links');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const paymentLinks = await PaymentLink.find({ merchantId: merchant._id });

    if (paymentLinks.length === 0) {
      console.log('⚠️  No payment links found for this merchant');
      console.log('\n💡 Solution: Create a payment link first using /payment command');
    } else {
      console.log(`✅ Found ${paymentLinks.length} payment link(s):`);
      paymentLinks.forEach((link, idx) => {
        console.log(`   ${idx + 1}. ${link.name} (${link.amount} ${link.currency}) - Active: ${link.isActive}`);
      });
    }
    console.log();

    // Step 3: Check dashboard sessions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: Checking Dashboard Sessions');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const allSessions = await DashboardSession.find({
      merchantId: merchant._id
    }).populate('paymentLinkId').sort({ createdAt: -1 });

    if (allSessions.length === 0) {
      console.log('❌ NO DASHBOARD SESSIONS FOUND');
      console.log('\n📋 This is the problem!');
      console.log('   You need to generate credentials via Telegram bot first.\n');
      console.log('💡 Solution:');
      console.log('   1. Open your Telegram bot');
      console.log('   2. Send command: /dashboard');
      console.log('   3. Click on a payment link button');
      console.log('   4. Bot will send you username and password');
      console.log('   5. Use those credentials in Postman\n');
      process.exit(1);
    }

    console.log(`📊 Found ${allSessions.length} total session(s):\n`);

    const now = new Date();
    let validSessionFound = false;

    allSessions.forEach((session, idx) => {
      const isExpired = session.expiresAt < now;
      const isValid = !isExpired && !session.isRevoked;

      console.log(`Session ${idx + 1}:`);
      console.log(`   ID: ${session._id}`);
      console.log(`   Payment Link: ${session.paymentLinkId?.name || 'N/A'}`);
      console.log(`   Created: ${session.createdAt}`);
      console.log(`   Expires: ${session.expiresAt}`);
      console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ Active'}`);
      console.log(`   Revoked: ${session.isRevoked ? '⚠️  YES' : 'No'}`);
      console.log(`   Used: ${session.isUsed ? 'Yes' : 'No'}`);
      console.log(`   Last Used: ${session.lastUsedAt || 'Never'}`);
      console.log(`   IP: ${session.ipAddress || 'N/A'}`);
      console.log(`   Valid for Login: ${isValid ? '✅ YES' : '❌ NO'}`);
      console.log();

      if (isValid) validSessionFound = true;
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DIAGNOSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (validSessionFound) {
      console.log('✅ Valid session exists!');
      console.log('\n📋 But login failed, so:');
      console.log('   1. Check that you\'re using the EXACT password from Telegram');
      console.log('   2. Passwords are case-sensitive');
      console.log('   3. Make sure there are no extra spaces');
      console.log('\n💡 If you forgot the password, generate a new one:');
      console.log('   Send /dashboard command again in Telegram');
    } else {
      console.log('❌ No valid sessions found');
      console.log('\n📋 All sessions are either:');
      console.log('   - Expired (older than 2 hours)');
      console.log('   - Revoked');
      console.log('\n💡 Solution:');
      console.log('   1. Open Telegram bot');
      console.log('   2. Send: /dashboard');
      console.log('   3. Click on a payment link');
      console.log('   4. Get fresh credentials');
      console.log('   5. Use immediately in Postman (valid for 2 hours)');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

debug();

