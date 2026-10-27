-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "branch" TEXT,
ADD COLUMN     "commitSha" TEXT,
ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "pullNumber" INTEGER,
ADD COLUMN     "repositoryId" TEXT;

-- CreateTable
CREATE TABLE "github_installations" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_repositories" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "githubRepoId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "htmlUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_installations_installationId_key" ON "github_installations"("installationId");

-- CreateIndex
CREATE INDEX "github_installations_userId_idx" ON "github_installations"("userId");

-- CreateIndex
CREATE INDEX "github_installations_installationId_idx" ON "github_installations"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "github_repositories_githubRepoId_key" ON "github_repositories"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "github_repositories_fullName_key" ON "github_repositories"("fullName");

-- CreateIndex
CREATE INDEX "github_repositories_installationId_idx" ON "github_repositories"("installationId");

-- CreateIndex
CREATE INDEX "github_repositories_fullName_idx" ON "github_repositories"("fullName");

-- CreateIndex
CREATE INDEX "reviews_repositoryId_idx" ON "reviews"("repositoryId");

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "github_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "github_repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
