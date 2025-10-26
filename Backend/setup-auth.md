# Authentication Setup Instructions

## 1. Install Dependencies
```bash
cd Backend
npm install bcrypt
```

## 2. Run Database Migration
```bash
npx prisma migrate dev --name add-auth-fields
```

## 3. Generate Prisma Client
```bash
npx prisma generate
```

## 4. Update Environment Variables
Make sure your `.env` file has:
```
DATABASE_URL="your-database-url"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
```

## 5. Test Authentication

### Register a new user:
```bash
curl -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123","name":"Test User"}'
```

### Login:
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Create authenticated contest:
```bash
curl -X POST http://localhost:5000/create-contest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"numProblems":3,"difficulty":"Easy"}'
```

## 6. Frontend Changes
- Users must login/register before accessing the app
- JWT token is automatically included in API requests
- User info is displayed in top-right corner
- Logout button clears authentication

## 7. Protected Routes
- `POST /create-contest` - Requires authentication
- `POST /contest/:id/start` - Requires authentication (only creator)
- `POST /contest/:id/mark` - Requires authentication
- `GET /auth/me` - Requires authentication

## 8. Migration from Old System
Existing contests created without authentication will still work, but new contests require authenticated users.