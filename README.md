# CityGuide Backend API

A comprehensive Node.js/Express backend API for the CityGuide mobile application. This API provides authentication, place management, reviews, favorites, and admin functionality.

## 🚀 Features

### Core Features
- **JWT Authentication** - Secure user authentication with token-based system
- **User Management** - Registration, login, profile management
- **Place Management** - CRUD operations for places with approval workflow
- **Reviews & Ratings** - Users can review places, owners can reply
- **Favorites** - Users can save favorite places
- **Image Upload** - Support for place images with multer
- **Search & Filter** - Search places by name, category, city with pagination
- **Admin Dashboard** - Complete admin panel with statistics

### User Features
- User registration and login
- Submit places for approval
- Edit own places (requires admin approval)
- Delete own places
- Add reviews and ratings
- Reply to reviews (place owners)
- Favorite/unfavorite places
- View submission and update request status

### Admin Features
- Approve/reject place submissions
- Approve/reject place updates
- Manage users (ban/unban, delete)
- View all places and delete any place
- Dashboard with comprehensive statistics
- View places by category and city

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB
- npm or yarn

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd city_guide/backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the backend directory:

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/cityguide?retryWrites=true&w=majority

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production

# Server Port (optional, defaults to 8080)
PORT=8080
```

**Important:** Replace the MongoDB URI with your actual connection string.

### 4. Create admin user (optional)
```bash
node create-admin.js
```

This creates an admin user with:
- Email: `admin@cityguide.com`
- Password: `admin123`

**⚠️ Change these credentials in production!**

## 🚀 Running the Server

### Development Mode
```bash
node production-server.js
```

### With Auto-Restart (using nodemon)
```bash
npx nodemon production-server.js
```

The server will start on `http://localhost:8080`

## 📁 Project Structure

```
backend/
├── models/                    # Mongoose models
│   ├── User.js               # User model with authentication
│   ├── Place.js              # Place model with reviews
│   ├── PlaceSubmission.js    # Place submission workflow
│   ├── PlaceUpdate.js        # Place update workflow
│   └── Favorite.js           # User favorites
├── uploads/                   # Uploaded images
├── production-server.js       # Main server file (ALL ROUTES HERE)
├── create-admin.js           # Utility to create admin user
├── fix-zero-ratings.js       # Utility to fix rating issues
├── package.json              # Dependencies
├── .env                      # Environment variables (create this)
└── README.md                 # This file
```

## 🔌 API Endpoints

### Base URL
```
http://localhost:8080/api
```

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Verify Token
```http
GET /auth/me
Authorization: Bearer <token>
```

### Place Endpoints

#### Get All Cities
```http
GET /cities
Authorization: Bearer <token>
```

#### Get Places by City
```http
GET /places?city=Mumbai&page=1&limit=10&sort=rating
Authorization: Bearer <token>
```

#### Search Places
```http
GET /places/search?keyword=restaurant&city=Mumbai&minRating=4&page=1&limit=10&sort=rating
Authorization: Bearer <token>
```

#### Get Place by ID
```http
GET /places/:id
Authorization: Bearer <token>
```

#### Submit New Place
```http
POST /submissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Amazing Restaurant",
  "category": "Restaurant",
  "city": "Mumbai",
  "description": "Great food and ambiance",
  "address": "123 Main St, Mumbai",
  "image": "https://example.com/image.jpg",
  "contactNumber": "+91 1234567890",
  "website": "https://example.com",
  "noteForAdmin": "Please review quickly"
}
```

#### Get My Submissions
```http
GET /submissions/my
Authorization: Bearer <token>
```

#### Get My Places (Approved)
```http
GET /my-places
Authorization: Bearer <token>
```

#### Delete My Place
```http
DELETE /my-places/:id
Authorization: Bearer <token>
```

#### Request Place Update
```http
PATCH /my-places/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "category": "Updated Category",
  "description": "Updated description",
  "image": "https://example.com/new-image.jpg"
}
```

#### Get My Update Requests
```http
GET /my-updates
Authorization: Bearer <token>
```

### Review Endpoints

#### Add Review
```http
POST /places/:id/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 5,
  "comment": "Excellent place!"
}
```

#### Get Place Reviews
```http
GET /places/:id/reviews
Authorization: Bearer <token>
```

#### Reply to Review (Owner Only)
```http
POST /places/:placeId/reviews/:reviewId/reply
Authorization: Bearer <token>
Content-Type: application/json

{
  "reply": "Thank you for your feedback!"
}
```

### Favorite Endpoints

#### Get Favorites
```http
GET /favorites
Authorization: Bearer <token>
```

#### Add to Favorites
```http
POST /favorites
Authorization: Bearer <token>
Content-Type: application/json

{
  "placeId": "place_id_here"
}
```

#### Remove from Favorites
```http
DELETE /favorites/:id
Authorization: Bearer <token>
```

### Image Upload

#### Upload Image
```http
POST /upload-image
Authorization: Bearer <token>
Content-Type: multipart/form-data

image: <file>
```

### Admin Endpoints

All admin endpoints require admin role.

#### Get Dashboard Stats
```http
GET /admin/stats
Authorization: Bearer <admin_token>
```

#### Get All Users
```http
GET /admin/users
Authorization: Bearer <admin_token>
```

#### Update User Status (Ban/Unban)
```http
PATCH /admin/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "isActive": false
}
```

#### Delete User
```http
DELETE /admin/users/:id
Authorization: Bearer <admin_token>
```

#### Get All Submissions
```http
GET /admin/submissions?status=pending
Authorization: Bearer <admin_token>
```

#### Review Submission (Approve/Reject)
```http
PATCH /admin/submissions/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "approved",
  "adminNotes": "Looks good!"
}
```

#### Get All Update Requests
```http
GET /admin/updates?status=pending
Authorization: Bearer <admin_token>
```

#### Review Update Request
```http
PATCH /admin/updates/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "approved",
  "adminNotes": "Changes approved"
}
```

#### Get All Places
```http
GET /admin/places
Authorization: Bearer <admin_token>
```

#### Delete Any Place
```http
DELETE /admin/places/:id
Authorization: Bearer <admin_token>
```

## 🗄️ Database Models

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (default: 'user'),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### Place Model
```javascript
{
  name: String,
  category: String,
  city: String,
  rating: Number (default: 0),
  description: String,
  image: String,
  address: String,
  contactNumber: String,
  website: String,
  ownerId: ObjectId (ref: User),
  reviews: [{
    userId: ObjectId,
    userName: String,
    rating: Number,
    comment: String,
    createdAt: Date,
    ownerReply: String,
    ownerReplyAt: Date
  }],
  totalReviews: Number,
  averageRating: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### PlaceSubmission Model
```javascript
{
  name: String,
  category: String,
  city: String,
  description: String,
  image: String,
  address: String,
  contactNumber: String,
  website: String,
  noteForAdmin: String,
  submittedBy: ObjectId (ref: User),
  status: String (pending/approved/rejected),
  adminNotes: String,
  reviewedBy: ObjectId (ref: User),
  reviewedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### PlaceUpdate Model
```javascript
{
  placeId: ObjectId (ref: Place),
  placeName: String,
  submittedBy: ObjectId (ref: User),
  updates: {
    name: String,
    category: String,
    description: String,
    image: String,
    address: String,
    contactNumber: String,
    website: String
  },
  status: String (pending/approved/rejected),
  adminNotes: String,
  reviewedBy: ObjectId (ref: User),
  reviewedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Favorite Model
```javascript
{
  userId: ObjectId (ref: User),
  placeId: ObjectId (ref: Place),
  createdAt: Date
}
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Token Format
```
Authorization: Bearer <your_jwt_token>
```

### Token Expiry
Tokens expire after 7 days by default.

### Protected Routes
All routes except `/auth/register`, `/auth/login`, and `/health` require authentication.

### Admin Routes
Routes under `/admin/*` require admin role.

## 🛡️ Security Features

- **Password Hashing** - bcryptjs with salt rounds
- **JWT Authentication** - Secure token-based auth
- **Role-Based Access Control** - Admin vs User permissions
- **Ban System** - Admins can ban users
- **Input Validation** - Server-side validation
- **CORS Enabled** - Cross-origin requests allowed
- **File Upload Limits** - 5MB max file size
- **Image Type Validation** - Only image files allowed

## 📊 Available Cities

The app supports 10 Indian cities:
1. Mumbai
2. Delhi
3. Bangalore
4. Chennai
5. Kolkata
6. Hyderabad
7. Pune
8. Ahmedabad
9. Jaipur
10. Lucknow

## 📝 Available Categories

15 place categories:
1. Restaurant
2. Cafe
3. Park
4. Museum
5. Shopping Mall
6. Hotel
7. Tourist Attraction
8. Temple
9. Beach
10. Market
11. Theater
12. Library
13. Hospital
14. School
15. Gym

## 🔧 Utility Scripts

### Create Admin User
```bash
node create-admin.js
```
Creates an admin user with default credentials.

### Fix Zero Ratings
```bash
node fix-zero-ratings.js
```
Fixes places that have 0 reviews but non-zero ratings.

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Error: MongooseServerSelectionError
```
**Solution:** Check your MongoDB URI in `.env` file and ensure your IP is whitelisted in MongoDB Atlas.

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::8080
```
**Solution:** Change the port in `.env` or kill the process using port 8080.

### JWT Token Invalid
```
Error: Invalid or expired token
```
**Solution:** Login again to get a new token.

### Image Upload Error
```
Error: File too large
```
**Solution:** Ensure image is under 5MB.

## 📈 Performance

- **Pagination** - All list endpoints support pagination
- **Indexing** - MongoDB indexes on frequently queried fields
- **Caching** - Consider adding Redis for production
- **Image Optimization** - Consider using CDN for images

## 🚀 Deployment

### Environment Variables for Production
```env
MONGO_URI=<production_mongodb_uri>
JWT_SECRET=<strong_random_secret>
PORT=8080
NODE_ENV=production
```

### Recommended Hosting
- **Backend**: Heroku, Railway, Render, DigitalOcean
- **Database**: MongoDB Atlas
- **Images**: AWS S3, Cloudinary, or similar CDN

### Production Checklist
- [ ] Change admin credentials
- [ ] Use strong JWT secret
- [ ] Enable HTTPS
- [ ] Set up proper CORS
- [ ] Add rate limiting
- [ ] Set up logging
- [ ] Configure error monitoring
- [ ] Set up backups
- [ ] Use environment variables
- [ ] Remove console.logs

## 📚 Dependencies

### Core Dependencies
- **express** - Web framework
- **mongoose** - MongoDB ODM
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **cors** - CORS middleware
- **dotenv** - Environment variables
- **multer** - File upload handling

### Dev Dependencies
- **nodemon** - Auto-restart server

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👥 Support

For issues or questions:
- Create an issue in the repository
- Contact the development team

## 🔄 Version History

### v1.0.0 (Current)
- Initial release
- Complete authentication system
- Place management with approval workflow
- Reviews and ratings
- Favorites system
- Admin dashboard
- Image upload
- Search and filter

## 🎯 Future Enhancements

- [ ] Email notifications
- [ ] SMS notifications
- [ ] Social media login
- [ ] Advanced search filters
- [ ] Place recommendations
- [ ] User profiles with avatars
- [ ] Place photos gallery
- [ ] Booking system
- [ ] Payment integration
- [ ] Analytics dashboard
- [ ] Export data functionality
- [ ] API rate limiting
- [ ] Caching with Redis
- [ ] WebSocket for real-time updates

---

**Made with ❤️ for CityGuide**
