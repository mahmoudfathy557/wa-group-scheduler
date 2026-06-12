-- Support anchored interval schedules ("every N minutes from now")
ALTER TABLE "Schedule"
ADD COLUMN "intervalMinutes" INTEGER,
ADD COLUMN "intervalAnchorAt" TIMESTAMP(3);
