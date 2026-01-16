require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('./models/Place');
const Review = require('./models/Review');

async function cleanupReviewStats() {
  try {
    console.log('🧹 Starting review statistics cleanup...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Ensure indexes are created
    console.log('📋 Creating indexes...');
    await Review.createIndexes();
    console.log('✅ Indexes created successfully\n');

    // Get all places
    const places = await Place.find({});
    console.log(`📍 Found ${places.length} places\n`);

    let updatedCount = 0;
    let alreadyCorrect = 0;

    for (const place of places) {
      // Count actual reviews in Review collection
      const actualReviewCount = await Review.countDocuments({ placeId: place._id });
      
      // Calculate actual average rating
      let actualAverageRating = 0;
      if (actualReviewCount > 0) {
        const reviews = await Review.find({ placeId: place._id });
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        actualAverageRating = totalRating / actualReviewCount;
      }

      // Check if update is needed
      const needsUpdate = 
        place.totalReviews !== actualReviewCount ||
        Math.abs(place.averageRating - actualAverageRating) > 0.01 ||
        Math.abs(place.rating - actualAverageRating) > 0.01;

      if (needsUpdate) {
        console.log(`🔧 Updating: ${place.name}`);
        console.log(`   Old: ${place.totalReviews} reviews, ${place.averageRating.toFixed(2)}⭐`);
        console.log(`   New: ${actualReviewCount} reviews, ${actualAverageRating.toFixed(2)}⭐`);
        
        place.totalReviews = actualReviewCount;
        place.averageRating = actualAverageRating;
        place.rating = actualAverageRating;
        
        await place.save();
        updatedCount++;
        console.log('   ✅ Updated\n');
      } else {
        alreadyCorrect++;
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('🎉 CLEANUP COMPLETED!');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   • Total places: ${places.length}`);
    console.log(`   • Places updated: ${updatedCount}`);
    console.log(`   • Places already correct: ${alreadyCorrect}`);
    
    // Verify
    const totalReviews = await Review.countDocuments();
    const placesWithReviews = await Place.countDocuments({ totalReviews: { $gt: 0 } });
    
    console.log(`\n✅ Verification:`);
    console.log(`   • Total reviews in database: ${totalReviews}`);
    console.log(`   • Places with reviews: ${placesWithReviews}`);
    
    console.log('\n✨ All statistics are now accurate!\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed\n');
  }
}

// Run the cleanup
cleanupReviewStats();
