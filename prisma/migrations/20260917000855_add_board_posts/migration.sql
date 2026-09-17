-- CreateEnum
CREATE TYPE "PostTag" AS ENUM ('ISSUE', 'NOTICE', 'CHAT');

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "tag" "PostTag" NOT NULL,
    "title" VARCHAR(50) NOT NULL,
    "body" VARCHAR(200) NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "posts_createdAt_idx" ON "posts"("createdAt");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
