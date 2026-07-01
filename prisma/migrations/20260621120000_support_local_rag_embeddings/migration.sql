ALTER TABLE "DocumentChunkEmbedding"
  ALTER COLUMN "embedding" TYPE vector
  USING "embedding"::vector;

CREATE INDEX "DocumentChunkEmbedding_dimensions_idx"
  ON "DocumentChunkEmbedding"("dimensions");
