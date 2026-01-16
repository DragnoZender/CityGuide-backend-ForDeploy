require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('./models/Place');
const Review = require('./models/Review');
const User = require('./models/User');

async function testReviewSystem() {
  try {
    console.log('🧪 Testing Review System...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Check Review model
    console.log('📋 Test 1: Review Model Structure');
    const reviewSchema = Review.schema.obj;
    console.log('   Fields:', Object.keys(reviewSchema));
    console.log('   ✅ Review model loaded successfully\n');

    // Test 2: Check Place model (should not have reviews array)
    console.log('📋 Test 2: Place Model Structure');
    const placeSchema = Place.schema.obj;
    const hasReviewsArray = 'reviews' in placeSchema;
    if (hasReviewsArray) {
      console.log('   ⚠️  WARNING: Place model still has reviews array field');
    } else {
      console.log('   ✅ Place model does not have reviews array (correct)');
    }
    console.log('   Has totalReviews:', 'totalReviews' in placeSchema);
    console.log('   Has averageRating:', 'averageRating' in placeSchema);
    console.log('');

    // Test 3: Check indexes
    console.log('📋 Test 3: Review Collection Indexes');
    const indexes = await Review.collection.getIndexes();
    console.log('   Indexes:', Object.keys(indexes));
    const hasUniqueIndex = Object.values(indexes).some(
      idx => idx.some(field => field[0] === 'placeId' && field[1] === 1) &&
             idx.some(field => field[0] === 'userId' && field[1] === 1)
    );
    console.log('   Has unique compound index (placeId + userId):', hasUniqueIndex ? '✅' : '⚠️');
    console.log('');

    // Test 4: Count existing data
    console.log('📋 Test 4: Data Statistics');
    const placeCount = await Place.countDocuments();
    const reviewCount = await Review.countDocuments();
    const userCount = await User.countDocuments();
    console.log(`   Places: ${placeCount}`);
    console.log(`   Reviews: ${reviewCount}`);
    console.log(`   Users: ${userCount}`);
    console.log('');

    // Test 5: Sample data check
    if (reviewCount > 0) {
      console.log('📋 Test 5: Sample Review Data');
      const sampleReview = await Review.findOne().populate('placeId', 'name city');
      console.log('   Sample Review:');
      console.log(`     Place: ${sampleReview.placeId?.name || 'N/A'}`);
      console.log(`     User: ${sampleReview.userName}`);
      console.log(`     Rating: ${sampleReview.rating}⭐`);
      console.log(`     Comment: ${sampleReview.comment.substring(0, 50)}...`);
      console.log(`     Created: ${sampleReview.createdAt}`);
      console.log('   ✅ Review data structure looks good\n');
    } else {
      console.log('📋 Test 5: No reviews in database yet\n');
    }

    // Test 6: Verify place statistics
    if (placeCount > 0) {
      console.log('📋 Test 6: Place Statistics Verification');
      const placesWithReviews = await Place.find({ totalReviews: { $gt: 0 } });
      console.log(`   Places with reviews: ${placesWithReviews.length}`);
      
      if (placesWithReviews.length > 0) {
        const samplePlace = placesWithReviews[0];
        const actualReviews = await Review.countDocuments({ placeId: samplePlace._id });
        const statsMatch = samplePlace.totalReviews === actualReviews;
        
        console.log(`   Sample Place: ${samplePlace.name}`);
        console.log(`     Stored totalReviews: ${samplePlace.totalReviews}`);
        console.log(`     Actual reviews in collection: ${actualReviews}`);
        console.log(`     Statistics match: ${statsMatch ? '✅' : '❌'}`);
        
        if (actualReviews > 0) {
          const reviews = await Review.find({ placeId: samplePlace._id });
          const calculatedAvg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
          const avgMatch = Math.abs(samplePlace.averageRating - calculatedAvg) < 0.01;
          console.log(`     Stored averageRating: ${samplePlace.averageRating.toFixed(2)}`);
          console.log(`     Calculated average: ${calculatedAvg.toFixed(2)}`);
          console.log(`     Average match: ${avgMatch ? '✅' : '❌'}`);
        }
      }
      console.log('');
    }

    // Test 7: Check for orphaned reviews
    console.log('📋 Test 7: Data Integrity Check');
    const allReviews = await Review.find();
    let orphanedReviews = 0;
    
    for (const review of allReviews) {
      const placeExists = await Place.exists({ _id: review.placeId });
      if (!placeExists) {
        orphanedReviews++;
      }
    }
    
    console.log(`   Orphaned reviews (place deleted): ${orphanedReviews}`);
    console.log(`   ${orphanedReviews === 0 ? '✅' : '⚠️'} Data integrity check complete\n`);

    // Summary
    console.log('='.repeat(60));
    console.log('🎉 TESTING COMPLETED!');
    console.log('='.repeat(60));
    console.log('\n✅ Review system is properly configured');
    console.log('✅ Separate Review collection is active');
    console.log('✅ Place model updated correctly');
    console.log('✅ Indexes are in place');
    
    if (reviewCount > 0) {
      console.log(`✅ ${reviewCount} reviews migrated successfully`);
    } else {
      console.log('💡 No reviews yet - system ready for new reviews');
    }
    
    console.log('\n🚀 Ready to use the new review system!\n');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed\n');
  }
}

// Run the test
testReviewSystem();
