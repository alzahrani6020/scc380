CREATE TABLE "recruitment_job_openings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "departmentId" TEXT,
  "title" TEXT NOT NULL,
  "code" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "headcount" INTEGER NOT NULL DEFAULT 1,
  "employmentType" TEXT,
  "location" TEXT,
  "description" TEXT,
  "requirements" TEXT,
  "ownerUserId" TEXT,
  "openedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruitment_job_openings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruitment_candidates" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "jobOpeningId" TEXT NOT NULL,
  "hiredEmployeeId" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "source" TEXT,
  "status" TEXT NOT NULL DEFAULT 'APPLIED',
  "rating" DECIMAL(4,2),
  "notes" TEXT,
  "offerSalary" DECIMAL(18,2),
  "offerDate" TIMESTAMP(3),
  "resumeFileName" TEXT,
  "resumeMimeType" TEXT,
  "resumeSizeBytes" INTEGER,
  "resumeChecksumSha256" TEXT,
  "resumeContent" BYTEA,
  "hiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruitment_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruitment_interviews" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "interviewerUserId" TEXT,
  "type" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "score" DECIMAL(4,2),
  "feedback" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruitment_interviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_cycles" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_reviews" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "reviewerUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "overallRating" DECIMAL(4,2),
  "managerSummary" TEXT,
  "employeeComment" TEXT,
  "submittedAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_goals" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "weight" DECIMAL(5,2) NOT NULL,
  "target" TEXT,
  "result" TEXT,
  "rating" DECIMAL(4,2),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_courses" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "code" TEXT,
  "provider" TEXT,
  "hours" DECIMAL(8,2),
  "deliveryMode" TEXT,
  "cost" DECIMAL(18,2),
  "certificateRequired" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_sessions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER,
  "location" TEXT,
  "trainer" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_enrollments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOMINATED',
  "score" DECIMAL(5,2),
  "completedAt" TIMESTAMP(3),
  "certificateNumber" TEXT,
  "certificateUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recruitment_job_openings_tenantId_code_key" ON "recruitment_job_openings"("tenantId","code");
CREATE INDEX "recruitment_job_openings_tenantId_idx" ON "recruitment_job_openings"("tenantId");
CREATE INDEX "recruitment_job_openings_tenantId_status_idx" ON "recruitment_job_openings"("tenantId","status");
CREATE INDEX "recruitment_job_openings_departmentId_idx" ON "recruitment_job_openings"("departmentId");
CREATE INDEX "recruitment_candidates_tenantId_idx" ON "recruitment_candidates"("tenantId");
CREATE INDEX "recruitment_candidates_tenantId_jobOpeningId_idx" ON "recruitment_candidates"("tenantId","jobOpeningId");
CREATE INDEX "recruitment_candidates_tenantId_status_idx" ON "recruitment_candidates"("tenantId","status");
CREATE INDEX "recruitment_candidates_email_idx" ON "recruitment_candidates"("email");
CREATE INDEX "recruitment_interviews_tenantId_idx" ON "recruitment_interviews"("tenantId");
CREATE INDEX "recruitment_interviews_candidateId_idx" ON "recruitment_interviews"("candidateId");
CREATE INDEX "recruitment_interviews_scheduledAt_idx" ON "recruitment_interviews"("scheduledAt");

CREATE INDEX "performance_cycles_tenantId_idx" ON "performance_cycles"("tenantId");
CREATE INDEX "performance_cycles_tenantId_status_idx" ON "performance_cycles"("tenantId","status");
CREATE UNIQUE INDEX "performance_reviews_cycleId_employeeId_key" ON "performance_reviews"("cycleId","employeeId");
CREATE INDEX "performance_reviews_tenantId_idx" ON "performance_reviews"("tenantId");
CREATE INDEX "performance_reviews_tenantId_status_idx" ON "performance_reviews"("tenantId","status");
CREATE INDEX "performance_reviews_employeeId_idx" ON "performance_reviews"("employeeId");
CREATE INDEX "performance_goals_tenantId_idx" ON "performance_goals"("tenantId");
CREATE INDEX "performance_goals_reviewId_idx" ON "performance_goals"("reviewId");
CREATE INDEX "performance_goals_employeeId_idx" ON "performance_goals"("employeeId");

CREATE UNIQUE INDEX "training_courses_tenantId_code_key" ON "training_courses"("tenantId","code");
CREATE INDEX "training_courses_tenantId_idx" ON "training_courses"("tenantId");
CREATE INDEX "training_courses_tenantId_status_idx" ON "training_courses"("tenantId","status");
CREATE INDEX "training_sessions_tenantId_idx" ON "training_sessions"("tenantId");
CREATE INDEX "training_sessions_courseId_idx" ON "training_sessions"("courseId");
CREATE INDEX "training_sessions_startAt_idx" ON "training_sessions"("startAt");
CREATE UNIQUE INDEX "training_enrollments_sessionId_employeeId_key" ON "training_enrollments"("sessionId","employeeId");
CREATE INDEX "training_enrollments_tenantId_idx" ON "training_enrollments"("tenantId");
CREATE INDEX "training_enrollments_employeeId_idx" ON "training_enrollments"("employeeId");
CREATE INDEX "training_enrollments_status_idx" ON "training_enrollments"("status");

ALTER TABLE "recruitment_job_openings" ADD CONSTRAINT "recruitment_job_openings_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruitment_job_openings" ADD CONSTRAINT "recruitment_job_openings_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_candidates" ADD CONSTRAINT "recruitment_candidates_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruitment_candidates" ADD CONSTRAINT "recruitment_candidates_jobOpeningId_fkey"
FOREIGN KEY ("jobOpeningId") REFERENCES "recruitment_job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruitment_candidates" ADD CONSTRAINT "recruitment_candidates_hiredEmployeeId_fkey"
FOREIGN KEY ("hiredEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_interviews" ADD CONSTRAINT "recruitment_interviews_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruitment_interviews" ADD CONSTRAINT "recruitment_interviews_candidateId_fkey"
FOREIGN KEY ("candidateId") REFERENCES "recruitment_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycleId_fkey"
FOREIGN KEY ("cycleId") REFERENCES "performance_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_reviewId_fkey"
FOREIGN KEY ("reviewId") REFERENCES "performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "training_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recruitment_job_openings" ADD CONSTRAINT "recruitment_job_openings_status_check"
CHECK ("status" IN ('DRAFT','OPEN','CLOSED','CANCELLED'));
ALTER TABLE "recruitment_candidates" ADD CONSTRAINT "recruitment_candidates_status_check"
CHECK ("status" IN ('APPLIED','SCREENING','INTERVIEW','OFFER','HIRED','REJECTED','WITHDRAWN'));
ALTER TABLE "recruitment_interviews" ADD CONSTRAINT "recruitment_interviews_status_check"
CHECK ("status" IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW'));

ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_status_check"
CHECK ("status" IN ('DRAFT','ACTIVE','CLOSED'));
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_status_check"
CHECK ("status" IN ('DRAFT','SUBMITTED','ACKNOWLEDGED'));
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_status_check"
CHECK ("status" IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED'));
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_weight_check"
CHECK ("weight" > 0 AND "weight" <= 100);
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_rating_check"
CHECK ("rating" IS NULL OR ("rating" >= 0 AND "rating" <= 5));

ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_status_check"
CHECK ("status" IN ('ACTIVE','INACTIVE'));
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_status_check"
CHECK ("status" IN ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'));
ALTER TABLE "training_enrollments" ADD CONSTRAINT "training_enrollments_status_check"
CHECK ("status" IN ('NOMINATED','ENROLLED','COMPLETED','CANCELLED','NO_SHOW'));
