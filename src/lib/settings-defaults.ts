export interface SettingsFormState {
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  companyContact: string;
  leaderName: string;
  leaderTitle: string;
  logoDataUrl: string | null;
  officeLat: number;
  officeLng: number;
  radiusMeters: number;
  workStartTime: string;
  workEndTime: string;
  lateGraceMinutes: number;
  latePenaltyAmount: number;
  overtimeHourlyRate: number;
}

export const DEFAULT_SETTINGS_FORM: SettingsFormState = {
  companyName: "TalentaZ 2.0",
  companyTagline: "Sistem Kehadiran & Operasional SDM",
  companyAddress: "Jl. Merdeka No. 1, Jakarta Pusat",
  companyContact: "Telp: (021) 555-0199 | Email: hr@talentaz.local",
  leaderName: "Pimpinan Perusahaan",
  leaderTitle: "Direktur Operasional",
  logoDataUrl: null,
  officeLat: -6.175392,
  officeLng: 106.827153,
  radiusMeters: 150,
  workStartTime: "08:00",
  workEndTime: "17:00",
  lateGraceMinutes: 10,
  latePenaltyAmount: 25000,
  overtimeHourlyRate: 25000,
};

export function normalizeCompanySettings(
  s: Partial<SettingsFormState> & Record<string, unknown>
): SettingsFormState {
  return {
    companyName: String(s.companyName ?? DEFAULT_SETTINGS_FORM.companyName),
    companyTagline: String(s.companyTagline ?? DEFAULT_SETTINGS_FORM.companyTagline),
    companyAddress: String(s.companyAddress ?? DEFAULT_SETTINGS_FORM.companyAddress),
    companyContact: String(s.companyContact ?? DEFAULT_SETTINGS_FORM.companyContact),
    leaderName: String(s.leaderName ?? DEFAULT_SETTINGS_FORM.leaderName),
    leaderTitle: String(s.leaderTitle ?? DEFAULT_SETTINGS_FORM.leaderTitle),
    logoDataUrl: typeof s.logoDataUrl === "string" ? s.logoDataUrl : null,
    officeLat: Number(s.officeLat ?? DEFAULT_SETTINGS_FORM.officeLat),
    officeLng: Number(s.officeLng ?? DEFAULT_SETTINGS_FORM.officeLng),
    radiusMeters: Number(s.radiusMeters ?? DEFAULT_SETTINGS_FORM.radiusMeters),
    workStartTime: String(s.workStartTime ?? DEFAULT_SETTINGS_FORM.workStartTime),
    workEndTime: String(s.workEndTime ?? DEFAULT_SETTINGS_FORM.workEndTime),
    lateGraceMinutes: Number(
      s.lateGraceMinutes ?? DEFAULT_SETTINGS_FORM.lateGraceMinutes
    ),
    latePenaltyAmount: Number(
      s.latePenaltyAmount ?? DEFAULT_SETTINGS_FORM.latePenaltyAmount
    ),
    overtimeHourlyRate: Number(
      s.overtimeHourlyRate ?? DEFAULT_SETTINGS_FORM.overtimeHourlyRate
    ),
  };
}
