import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("employee"),
  position: text("position").notNull().default("Staf"),
  baseSalary: integer("base_salary").notNull().default(0),
  avatarDataUrl: text("avatar_data_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("TalentaZ 2.0"),
  companyTagline: text("company_tagline")
    .notNull()
    .default("Sistem Kehadiran & Operasional SDM"),
  companyAddress: text("company_address")
    .notNull()
    .default("Jl. Merdeka No. 1, Jakarta Pusat"),
  companyContact: text("company_contact")
    .notNull()
    .default("Telp: (021) 555-0199 | Email: hr@talentaz.local"),
  leaderName: text("leader_name").notNull().default("Pimpinan Perusahaan"),
  leaderTitle: text("leader_title").notNull().default("Direktur Operasional"),
  logoDataUrl: text("logo_data_url"),
  officeLat: doublePrecision("office_lat").notNull().default(-6.175392),
  officeLng: doublePrecision("office_lng").notNull().default(106.827153),
  radiusMeters: integer("radius_meters").notNull().default(150),
  workStartTime: text("work_start_time").notNull().default("08:00"),
  workEndTime: text("work_end_time").notNull().default("17:00"),
  lateGraceMinutes: integer("late_grace_minutes").notNull().default(10),
  latePenaltyAmount: integer("late_penalty_amount").notNull().default(25000),
  overtimeHourlyRate: integer("overtime_hourly_rate").notNull().default(25000),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const attendances = pgTable("attendances", {
  id: serial("id").primaryKey(),
  attendanceCode: text("attendance_code").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workDate: text("work_date").notNull(),
  clockInAt: timestamp("clock_in_at"),
  clockInPhoto: text("clock_in_photo"),
  clockInLat: doublePrecision("clock_in_lat"),
  clockInLng: doublePrecision("clock_in_lng"),
  clockInDistanceMeters: integer("clock_in_distance_meters"),
  isLate: boolean("is_late").notNull().default(false),
  lateMinutes: integer("late_minutes").notNull().default(0),
  lateReason: text("late_reason"),
  isOutsideIn: boolean("is_outside_in").notNull().default(false),
  outsideInReason: text("outside_in_reason"),
  penaltyAmount: integer("penalty_amount").notNull().default(0),
  clockOutAt: timestamp("clock_out_at"),
  clockOutPhoto: text("clock_out_photo"),
  clockOutLat: doublePrecision("clock_out_lat"),
  clockOutLng: doublePrecision("clock_out_lng"),
  clockOutDistanceMeters: integer("clock_out_distance_meters"),
  isOutsideOut: boolean("is_outside_out").notNull().default(false),
  outsideOutReason: text("outside_out_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  requestCode: text("request_code").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  leaveType: text("leave_type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason").notNull(),
  attachmentName: text("attachment_name"),
  attachmentMime: text("attachment_mime"),
  attachmentDataUrl: text("attachment_data_url"),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const overtimeRequests = pgTable("overtime_requests", {
  id: serial("id").primaryKey(),
  overtimeCode: text("overtime_code").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  overtimeDate: text("overtime_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  taskDescription: text("task_description").notNull(),
  estimatedPay: integer("estimated_pay").notNull().default(0),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserRecord = typeof users.$inferSelect;
export type CompanySettingsRecord = typeof companySettings.$inferSelect;
export type AttendanceRecord = typeof attendances.$inferSelect;
export type LeaveRequestRecord = typeof leaveRequests.$inferSelect;
export type OvertimeRequestRecord = typeof overtimeRequests.$inferSelect;
