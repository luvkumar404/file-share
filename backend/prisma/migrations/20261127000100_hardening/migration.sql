-- CreateTable
CREATE TABLE "rate_limits" (
    "key" VARCHAR(64) NOT NULL,
    "bucket" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "files_owner_id_created_at_idx" ON "files"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "share_links_file_id_idx" ON "share_links"("file_id");

-- CreateIndex
CREATE INDEX "share_links_expires_at_idx" ON "share_links"("expires_at");

-- CreateIndex
CREATE INDEX "access_logs_created_at_idx" ON "access_logs"("created_at");

-- CreateIndex
CREATE INDEX "access_logs_user_id_idx" ON "access_logs"("user_id");
