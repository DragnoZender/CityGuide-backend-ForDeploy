require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('./models/Place');
const Review = require('./models/Review');

async function migrateReviews() {
  try {
    console.log('🔄 Starting review migration process...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all places with reviews
    const places = await Place.find({});
    console.log(`📍 Found ${places.length} places in database\n`);

    let totalReviewsMigrated = 0;
    let placesWithReviews = 0;
    let skippedReviews = 0;

    for (const place of places) {
      // Check if place has reviews array (old schema)
      if (place.reviews && Array.isArray(place.reviews) && place.reviews.length > 0) {
        placesWithReviews++;
        console.log(`\n📝 Migrating reviews for: ${place.name} (${place.city})`);
        console.log(`   Found ${place.reviews.length} reviews`);

        for (const oldReview of place.reviews) {
          try {
            // Check if review already exists in new collection
            const existingReview = await Review.findOne({
              placeId: place._id,
              userId: oldReview.userId
            });

            if (existingReview) {
              console.log(`   ⏭️  Skipped duplicate review from user ${oldReview.userName}`);
              skippedReviews++;
              continue;
            }

            // Create new review document
            await Review.create({
              placeId: place._id,
              userId: oldReview.userId,
              userName: oldReview.userName,
              rating: oldReview.rating,
              comment: oldReview.comment,
              ownerReply: oldReview.ownerReply || null,
              ownerReplyAt: oldReview.ownerReplyAt || null,
              createdAt: oldReview.createdAt || new Date(),
              updatedAt: oldReview.createdAt || new Date()
            });

            totalReviewsMigrated++;
            console.log(`   ✅ Migrated review from ${oldReview.userName} (${oldReview.rating}⭐)`);
          } catch (error) {
            if (error.code === 11000) {
              // Duplicate key error - review already exists
              console.log(`   ⏭️  Skipped duplicate review from user ${oldReview.userName}`);
              skippedReviews++;
            } else {
              console.error(`   ❌ Error migrating review: ${error.message}`);
            }
          }
        }

        // Recalculate place statistics from new Review collection
        const allReviews = await Review.find({ placeId: place._id });
        place.totalReviews = allReviews.length;
        
        if (allReviews.length > 0) {
          const totalRating = allReviews.reduce((sum, review) => sum + review.rating, 0);
          place.averageRating = totalRating / allReviews.length;
          place.rating = place.averageRating;
        } else {
          place.averageRating = 0;
          place.rating = 0;
        }

        // Clear the old reviews array (optional - can be removed after migration is confirmed)
        // Uncomment the next line to remove the reviews array from Place documents
        // place.reviews = undefined;

        await place.save();
        console.log(`   📊 Updated place stats: ${place.totalReviews} reviews, ${place.averageRating.toFixed(2)}⭐ average`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   • Total places checked: ${places.length}`);
    console.log(`   • Places with reviews: ${placesWithReviews}`);
    console.log(`   • Reviews migrated: ${totalReviewsMigrated}`);
    console.log(`   • Reviews skipped (duplicates): ${skippedReviews}`);
    
    // Verify migration
    const totalReviewsInCollection = await Review.countDocuments();
    console.log(`\n✅ Verification:`);
    console.log(`   • Total reviews in Review collection: ${totalReviewsInCollection}`);

    console.log('\n💡 Next steps:');
    console.log('   1. Test the application to ensure reviews work correctly');
    console.log('   2. Once confirmed, you can uncomment the line in this script');
    console.log('      to remove the old reviews array from Place documents');
    console.log('   3. Update the Place model to remove the reviews field definition\n');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed\n');
  }
}

// Run the migration
migrateReviews();
