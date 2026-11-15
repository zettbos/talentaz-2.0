import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import type {
  DailyAttendanceRow,
  KopSuratMeta,
  PayrollSummaryRow,
} from "./report-types";
import { formatMinutesAsHours, formatRupiah, getWibParts } from "./time";

function imageMimeFromDataUrl(dataUrl: string): "PNG" | "JPEG" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}

export function downloadAttendancePdf(params: {
  summaryRows: PayrollSummaryRow[];
  dailyLogs: DailyAttendanceRow[];
  kopSurat: KopSuratMeta;
  periodLabel: string;
}) {
  const { summaryRows, dailyLogs, kopSurat, periodLabel } = params;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;

  // Draw Kop Surat header.
  const headerTop = 12;
  if (kopSurat.logoDataUrl) {
    try {
      doc.addImage(
        kopSurat.logoDataUrl,
        imageMimeFromDataUrl(kopSurat.logoDataUrl),
        marginX,
        headerTop,
        20,
        20
      );
    } catch {
      // Continue cleanly if logo image format cannot be embedded.
    }
  }

  const textCenterX = pageWidth / 2;
  doc.setTextColor(26, 30, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(kopSurat.companyName.toUpperCase(), textCenterX, headerTop + 6, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(kopSurat.companyTagline, textCenterX, headerTop + 12, {
    align: "center",
  });

  doc.setFontSize(9);
  doc.setTextColor(70, 81, 71);
  doc.text(kopSurat.companyAddress, textCenterX, headerTop + 17, {
    align: "center",
  });
  doc.text(kopSurat.companyContact, textCenterX, headerTop + 21.5, {
    align: "center",
  });

  const lineY = headerTop + 25;
  doc.setDrawColor(31, 33, 30);
  doc.setLineWidth(0.9);
  doc.line(marginX, lineY, pageWidth - marginX, lineY);
  doc.setLineWidth(0.3);
  doc.line(marginX, lineY + 1.2, pageWidth - marginX, lineY + 1.2);

  // Report title and period metadata.
  doc.setTextColor(26, 30, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("LAPORAN REKAPITULASI ABSENSI & POTONGAN GAJI", textCenterX, lineY + 8, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Periode: ${periodLabel}   |   Dicetak: ${getWibParts().formattedDateTime}`, textCenterX, lineY + 13.5, {
    align: "center",
  });

  // Summary table per employee.
  autoTable(doc, {
    startY: lineY + 18,
    margin: { left: marginX, right: marginX },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [26, 30, 26],
      lineColor: [212, 228, 213],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [31, 33, 30],
      textColor: [246, 250, 246],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [243, 248, 243],
    },
    head: [
      [
        "ID",
        "Nama Karyawan",
        "Jabatan",
        "Hadir",
        "Telat",
        "Luar Radius",
        "Izin/Cuti",
        "Lembur",
        "Gaji Pokok",
        "Pot. Telat",
        "Uang Lembur",
        "Est. Bersih",
      ],
    ],
    body: summaryRows.map((row) => [
      row.employeeCode,
      row.fullName,
      row.position,
      `${row.presentDays} hr`,
      `${row.lateCount}x (${row.lateMinutesTotal}m)`,
      `${row.outsideCount}x`,
      `${row.approvedLeaveDays} hr`,
      `${formatMinutesAsHours(row.approvedOvertimeMinutes)} jam`,
      formatRupiah(row.baseSalary),
      formatRupiah(row.totalPenalty),
      formatRupiah(row.totalOvertimePay),
      formatRupiah(row.estimatedNetSalary),
    ]),
  });

  const docWithTable = doc as unknown as { lastAutoTable?: { finalY: number } };
  let cursorY = (docWithTable.lastAutoTable?.finalY ?? lineY + 40) + 8;

  if (dailyLogs.length > 0) {
    if (cursorY > 155) {
      doc.addPage();
      cursorY = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(26, 30, 26);
    doc.text("Rincian Log Kehadiran Harian", marginX, cursorY);

    autoTable(doc, {
      startY: cursorY + 3,
      margin: { left: marginX, right: marginX },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [26, 30, 26],
        lineColor: [212, 228, 213],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [36, 99, 38],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [243, 248, 243],
      },
      head: [
        [
          "Kode",
          "Tanggal",
          "Karyawan",
          "Masuk",
          "Pulang",
          "Jarak Masuk",
          "Status",
          "Catatan / Alasan",
          "Potongan",
        ],
      ],
      body: dailyLogs.map((log) => {
        const flags: string[] = [];
        flags.push(log.isLate ? `Telat ${log.lateMinutes}m` : "Tepat Waktu");
        if (log.isOutsideIn || log.isOutsideOut) flags.push("Luar Radius");

        const notes: string[] = [];
        if (log.lateReason) notes.push(`Telat: ${log.lateReason}`);
        if (log.outsideInReason) notes.push(`Luar (Masuk): ${log.outsideInReason}`);
        if (log.outsideOutReason) notes.push(`Luar (Pulang): ${log.outsideOutReason}`);

        return [
          log.attendanceCode,
          log.workDate,
          log.fullName,
          log.clockInTime,
          log.clockOutTime,
          log.clockInDistanceMeters !== null ? `${log.clockInDistanceMeters} m` : "-",
          flags.join(", "),
          notes.length > 0 ? notes.join(" | ") : "-",
          formatRupiah(log.penaltyAmount),
        ];
      }),
    });

    cursorY = (docWithTable.lastAutoTable?.finalY ?? cursorY + 30) + 10;
  }

  // Signature block at bottom right.
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY + 32 > pageHeight - 10) {
    doc.addPage();
    cursorY = 20;
  }
  const signX = pageWidth - marginX - 58;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(26, 30, 26);
  doc.text(`Mengetahui, ${getWibParts().displayDate}`, signX, cursorY);
  doc.text(kopSurat.leaderTitle, signX, cursorY + 5);
  doc.setFont("helvetica", "bold");
  doc.text(kopSurat.leaderName, signX, cursorY + 24);
  doc.setLineWidth(0.3);
  doc.line(signX, cursorY + 25.5, signX + 52, cursorY + 25.5);

  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]+/g, "-");
  doc.save(`Rekap-Absensi-TalentaZ-${safePeriod}.pdf`);
}

export async function downloadAttendanceExcel(params: {
  summaryRows: PayrollSummaryRow[];
  dailyLogs: DailyAttendanceRow[];
  kopSurat: KopSuratMeta;
  periodLabel: string;
}) {
  const { summaryRows, dailyLogs, kopSurat, periodLabel } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = kopSurat.companyName || "TalentaZ 2.0";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Rekap Penggajian");
  summarySheet.mergeCells("A1:L1");
  summarySheet.getCell("A1").value = `${kopSurat.companyName} - Rekap Absensi & Potongan Gaji (${periodLabel})`;
  summarySheet.getCell("A1").font = { bold: true, size: 13, color: { argb: "FF1A1E1A" } };

  summarySheet.mergeCells("A2:L2");
  summarySheet.getCell("A2").value = `${kopSurat.companyAddress} | ${kopSurat.companyContact}`;
  summarySheet.getCell("A2").font = { size: 10, color: { argb: "FF465147" } };

  const summaryHeader = summarySheet.addRow([
    "ID Karyawan",
    "Nama Lengkap",
    "Jabatan",
    "Hari Hadir",
    "Jumlah Telat",
    "Menit Telat",
    "Luar Radius",
    "Hari Izin/Cuti",
    "Menit Lembur Disetujui",
    "Gaji Pokok (Rp)",
    "Potongan Telat (Rp)",
    "Uang Lembur (Rp)",
    "Estimasi Gaji Bersih (Rp)",
  ]);

  summaryHeader.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F211E" },
    };
    cell.font = { bold: true, color: { argb: "FFF6FAF6" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const row of summaryRows) {
    const added = summarySheet.addRow([
      row.employeeCode,
      row.fullName,
      row.position,
      row.presentDays,
      row.lateCount,
      row.lateMinutesTotal,
      row.outsideCount,
      row.approvedLeaveDays,
      row.approvedOvertimeMinutes,
      row.baseSalary,
      row.totalPenalty,
      row.totalOvertimePay,
      row.estimatedNetSalary,
    ]);
    for (const colIdx of [10, 11, 12, 13]) {
      added.getCell(colIdx).numFmt = "#,##0";
    }
  }

  summarySheet.columns.forEach((col) => {
    col.width = 18;
  });
  summarySheet.getColumn(2).width = 24;
  summarySheet.getColumn(3).width = 20;

  const logSheet = workbook.addWorksheet("Log Absensi Harian");
  const logHeader = logSheet.addRow([
    "Kode Absen",
    "Tanggal",
    "ID Karyawan",
    "Nama Karyawan",
    "Jabatan",
    "Jam Masuk",
    "Jam Pulang",
    "Jarak Masuk (m)",
    "Jarak Pulang (m)",
    "Status Telat",
    "Menit Telat",
    "Alasan Telat",
    "Luar Radius",
    "Alasan Luar Lokasi",
    "Potongan Telat (Rp)",
  ]);

  logHeader.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF246326" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const log of dailyLogs) {
    const outsideReasons = [log.outsideInReason, log.outsideOutReason]
      .filter(Boolean)
      .join(" | ");
    const added = logSheet.addRow([
      log.attendanceCode,
      log.workDate,
      log.employeeCode,
      log.fullName,
      log.position,
      log.clockInTime,
      log.clockOutTime,
      log.clockInDistanceMeters ?? "-",
      log.clockOutDistanceMeters ?? "-",
      log.isLate ? "Terlambat" : "Tepat Waktu",
      log.lateMinutes,
      log.lateReason ?? "-",
      log.isOutsideIn || log.isOutsideOut ? "Ya" : "Tidak",
      outsideReasons || "-",
      log.penaltyAmount,
    ]);
    added.getCell(15).numFmt = "#,##0";
  }

  logSheet.columns.forEach((col) => {
    col.width = 17;
  });
  logSheet.getColumn(4).width = 22;
  logSheet.getColumn(12).width = 28;
  logSheet.getColumn(14).width = 28;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]+/g, "-");
  link.href = url;
  link.download = `Rekap-Absensi-TalentaZ-${safePeriod}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
