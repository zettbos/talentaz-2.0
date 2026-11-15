export interface KopSuratMeta {
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  companyContact: string;
  leaderName: string;
  leaderTitle: string;
  logoDataUrl: string | null;
}

export interface PayrollSummaryRow {
  userId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  baseSalary: number;
  presentDays: number;
  lateCount: number;
  lateMinutesTotal: number;
  outsideCount: number;
  approvedLeaveDays: number;
  approvedOvertimeMinutes: number;
  totalPenalty: number;
  totalOvertimePay: number;
  estimatedNetSalary: number;
}

export interface DailyAttendanceRow {
  id: number;
  attendanceCode: string;
  workDate: string;
  userId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInTime: string;
  clockOutTime: string;
  clockInDistanceMeters: number | null;
  clockOutDistanceMeters: number | null;
  isLate: boolean;
  lateMinutes: number;
  lateReason: string | null;
  isOutsideIn: boolean;
  outsideInReason: string | null;
  isOutsideOut: boolean;
  outsideOutReason: string | null;
  penaltyAmount: number;
  clockInPhoto: string | null;
  clockOutPhoto: string | null;
}
