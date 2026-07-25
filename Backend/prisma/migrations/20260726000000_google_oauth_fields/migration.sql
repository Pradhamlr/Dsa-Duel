-- Add optional Google OAuth identity fields to local users.
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "authProvider" TEXT;

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
