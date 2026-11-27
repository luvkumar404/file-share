// Test defaults never point at a production account. CI supplies an isolated DB.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/fileshare_test";
process.env.JWT_SECRET_KEY = "test-only-secret-with-more-than-32-characters";
process.env.CLOUDINARY_CLOUD_NAME = "test";
process.env.CLOUDINARY_API_KEY = "test";
process.env.CLOUDINARY_API_SECRET = "test";
process.env.FRONTEND_URL = "http://localhost:5173";
