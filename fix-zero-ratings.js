const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

// Import Place model
const Place = require('./models/Place');

async function fixZeroRatings() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all places with 0 reviews but non-zero rating
    const placesWithWrongRating = await Place.find({
      totalReviews: 0,
      $or: [
        { rating: { $ne: 0 } },
        { averageRating: { $ne: 0 } }
      ]
    });

    console.log(`\n📊 Found ${placesWithWrongRating.length} places with incorrect ratings`);

    if (placesWithWrongRating.length === 0) {
      console.log('✅ All places have correct ratings!');
      process.exit(0);
    }

    console.log('\n🔧 Fixing ratings...\n');

    for (const place of placesWithWrongRating) {
      console.log(`📍 ${place.name} (${place.city})`);
      console.log(`   Current rating: ${place.rating}`);
      console.log(`   Current averageRating: ${place.averageRating}`);
      console.log(`   Total reviews: ${place.totalReviews}`);

      // Update to 0 rating
      place.rating = 0;
      place.averageRating = 0;
      await place.save();

      console.log(`   ✅ Fixed! New rating: 0\n`);
    }

    console.log('✅ All ratings fixed successfully!');
    
    // Show summary
    const totalPlaces = await Place.countDocuments();
    const placesWithReviews = await Place.countDocuments({ totalReviews: { $gt: 0 } });
    const placesWithoutReviews = await Place.countDocuments({ totalReviews: 0 });

    console.log('\n📊 Summary:');
    console.log(`   Total places: ${totalPlaces}`);
    console.log(`   Places with reviews: ${placesWithReviews}`);
    console.log(`   Places without reviews: ${placesWithoutReviews}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the fix
fixZeroRatings();
