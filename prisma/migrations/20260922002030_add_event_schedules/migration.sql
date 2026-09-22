-- AlterTable
ALTER TABLE "inventory_events" ADD COLUMN     "endDate" DATE,
ADD COLUMN     "scheduleId" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "event_schedules" (
    "id" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'red',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_schedules_startDate_endDate_idx" ON "event_schedules"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "event_schedules_eventType_title_startDate_endDate_key" ON "event_schedules"("eventType", "title", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "inventory_events_scheduleId_idx" ON "inventory_events"("scheduleId");

-- AddForeignKey
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "event_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
