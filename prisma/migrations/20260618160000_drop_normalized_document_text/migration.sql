-- Drop persisted normalized text copies. Raw extracted/OCR text remains intact.
ALTER TABLE "DocumentText" DROP COLUMN "normalizedText";
ALTER TABLE "DocumentPageText" DROP COLUMN "normalizedText";
