-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "numProblems" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "problems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" SERIAL NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemIndex" INTEGER NOT NULL,
    "solvedAt" TIMESTAMP(3),

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contest_creatorId_idx" ON "Contest"("creatorId");

-- CreateIndex
CREATE INDEX "Result_contestId_userId_idx" ON "Result"("contestId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_contestId_userId_problemIndex_key" ON "Result"("contestId", "userId", "problemIndex");

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
