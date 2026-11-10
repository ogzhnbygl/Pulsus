import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getRoleBadgeInfo, getMemberName, apiFetch, DEFAULT_STAFF_DIRECTORY } from './pulsusHelpers';

/**
 * Loads a font from a public URL and converts it to Base64 for jsPDF VFS.
 */
async function loadFontAsBase64(url) {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
        throw new Error('Browser fetch is not available in current environment');
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Font file could not be loaded: ${url} (HTTP ${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return window.btoa(binary);
}

/**
 * Exports formal HADMEK / HADYEK vivarium audit report PDF for Pulsus.
 * 
 * @param {Object} params
 * @param {Object} params.report - Raw report data from /api/reports
 * @param {Array} params.members - Staff members directory list
 * @param {Object} [params.user] - Currently authenticated user (vet/admin)
 * @param {Array} [params.combinedStaffRows] - Pre-merged staff metrics rows
 * @param {string} [params.dateRangeText] - Optional custom date range text
 * @param {string} [params.filename] - Optional custom PDF file name
 */
export async function exportAuditReportPdf({
    report,
    members = [],
    user = null,
    combinedStaffRows = null,
    dateRangeText = 'Cari Dönem / Tüm Denetim Kayıtları',
    filename
}) {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    let fontNormal = 'helvetica';
    let fontBold = 'helvetica';

    // Attempt to load Tinos fonts for full Turkish character support
    try {
        const [regularFont, boldFont] = await Promise.all([
            loadFontAsBase64('/Tinos-Regular.ttf'),
            loadFontAsBase64('/Tinos-Bold.ttf')
        ]);

        doc.addFileToVFS('Tinos-Regular.ttf', regularFont);
        doc.addFont('Tinos-Regular.ttf', 'Tinos', 'normal');

        doc.addFileToVFS('Tinos-Bold.ttf', boldFont);
        doc.addFont('Tinos-Bold.ttf', 'Tinos', 'bold');

        fontNormal = 'Tinos';
        fontBold = 'Tinos';
        doc.setFont('Tinos', 'normal');
    } catch (fontErr) {
        console.warn('Tinos font embedding failed, falling back to Helvetica:', fontErr);
        fontNormal = 'helvetica';
        fontBold = 'helvetica';
        doc.setFont('helvetica', 'normal');
    }

    const marginX = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginX * 2;
    let currentY = 16;

    // --- Top Accent Bar ---
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.rect(marginX, currentY, contentWidth, 2, 'F');
    currentY += 8;

    // --- Report Header ---
    doc.setFont(fontBold, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(
        'WildType Deney Hayvanları Araştırma Laboratuvarı - Pulsus Rutin ve Denetim Raporu',
        marginX,
        currentY
    );
    currentY += 6;

    doc.setFont(fontNormal, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(
        'T.C. Tarım ve Orman Bakanlığı HADMEK / HADYEK Mevzuatı Vivarium Operasyon ve Kalite Denetim Özeti',
        marginX,
        currentY
    );
    currentY += 5;

    // Divider Line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY, marginX + contentWidth, currentY);
    currentY += 6;

    // --- Metadata Section ---
    const reportDateStr = new Date().toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const auditorName = user?.name
        ? `${user.name} (${user.title || (user.pulsusRole === 'vet' ? 'Sorumlu Veteriner Hekim' : 'Yetkili Denetçi')})`
        : 'Sorumlu Veteriner Hekim';

    const auditRefCode = `PUL-AUD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    autoTable(doc, {
        startY: currentY,
        margin: { left: marginX, right: marginX },
        theme: 'plain',
        tableWidth: contentWidth,
        styles: {
            font: fontNormal,
            fontSize: 8.5,
            cellPadding: 1.8,
            textColor: [51, 65, 85]
        },
        columnStyles: {
            0: { font: fontBold, fontStyle: 'bold', textColor: [30, 41, 59], cellWidth: 38 },
            1: { cellWidth: 54 },
            2: { font: fontBold, fontStyle: 'bold', textColor: [30, 41, 59], cellWidth: 38 },
            3: { cellWidth: 52 }
        },
        body: [
            [
                'Rapor Düzenleme Tarihi:',
                reportDateStr,
                'Raporu Oluşturan Hekim:',
                auditorName
            ],
            [
                'Seçili Denetim Aralığı:',
                dateRangeText,
                'Resmi Denetim Referansı:',
                auditRefCode
            ]
        ]
    });

    currentY = doc.lastAutoTable.finalY + 7;

    // --- Section 1: KPI Tablosu ---
    const summary = report?.summary || {};
    const externalTasks = report?.externalTasks || [];
    const totalRuns = summary.totalRuns ?? summary.totalRitusRuns ?? 0;
    const completedRuns = summary.completedRuns ?? (summary.totalRitusRuns ? Math.round((summary.ritusCompletionRate / 100) * summary.totalRitusRuns) : 0);
    const completionRate = summary.completionRate ?? summary.ritusCompletionRate ?? (totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0);
    const totalRevisions = summary.totalRevisions ?? 0;
    const revisionRate = summary.revisionRate ?? (totalRuns > 0 ? Math.round((totalRevisions / totalRuns) * 100) : 0);
    const totalEscalations = summary.totalEscalations ?? 0;
    const totalExternal = summary.externalTasksTotal ?? summary.totalExternalTasks ?? externalTasks.length;

    doc.setFont(fontBold, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text('1. Vivarium Genel Operasyon ve KPI İcmali', marginX, currentY);
    currentY += 3;

    autoTable(doc, {
        startY: currentY,
        margin: { left: marginX, right: marginX },
        theme: 'grid',
        tableWidth: contentWidth,
        head: [
            [
                'Toplam Rutin',
                'Tamamlanma Oranı',
                'Revizyon Oranı (Tekrarlatma)',
                'Sevk Edilen Görevler (Eskale / Dış Birim)'
            ]
        ],
        body: [
            [
                `${totalRuns} Rutin Görevi`,
                `%${completionRate} (${completedRuns} tamamlandı)`,
                `%${revisionRate} (${totalRevisions} denetçi revizyonu)`,
                `${totalEscalations} Hekim Eskalasyonu • ${totalExternal} Dış Birim (Sequa)`
            ]
        ],
        styles: {
            font: fontNormal,
            fontSize: 8.5,
            cellPadding: 3,
            halign: 'center',
            valign: 'middle'
        },
        headStyles: {
            font: fontBold,
            fontStyle: 'bold',
            fillColor: [79, 70, 229], // Indigo-600
            textColor: [255, 255, 255],
            halign: 'center'
        },
        bodyStyles: {
            textColor: [15, 23, 42],
            font: fontBold,
            fontStyle: 'bold'
        }
    });

    // Sub-KPI details row
    currentY = doc.lastAutoTable.finalY + 2;
    const backupCount = summary.totalBackupHandovers ?? 0;
    const vetFallbackCount = summary.totalVetFallbacks ?? 0;

    autoTable(doc, {
        startY: currentY,
        margin: { left: marginX, right: marginX },
        theme: 'plain',
        tableWidth: contentWidth,
        styles: {
            font: fontNormal,
            fontSize: 7.5,
            cellPadding: 1,
            textColor: [100, 116, 139]
        },
        body: [
            [
                `• Circa İzin Devri ile Yedeğe Aktarılan: ${backupCount} görev    • Asil ve Yedek İzinli Olması Nedeniyle Hekime Düşen: ${vetFallbackCount} görev    • Bekleyen Denetim İncelemesi: ${summary.pendingReviewRuns ?? 0}`
            ]
        ]
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // --- Section 2: Personel Performans ve Tamamlama Tablosu ---
    doc.setFont(fontBold, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    doc.text('2. Personel Performans, Rutin Tamamlama ve İzin Durumu', marginX, currentY);
    currentY += 3;

    // Build staff rows if not precomputed
    const staffMetrics = report?.staffMetrics || [];
    const staffList = combinedStaffRows || members.map(m => {
        const metric = staffMetrics.find(
            s => String(s.email).toLowerCase() === String(m.email).toLowerCase()
        ) || {};
        return { ...metric, ...m };
    });

    const staffTableRows = staffList.map(staff => {
        const roleInfo = getRoleBadgeInfo ? getRoleBadgeInfo(staff.pulsusRole) : { shortLabel: staff.pulsusRole };
        const roleLabel = staff.title || roleInfo?.shortLabel || staff.pulsusRole;
        const backupName = getMemberName ? getMemberName(staff.defaultBackupEmail, members) : (staff.defaultBackupEmail || '-');
        const leaveStatus = staff.onLeaveToday ? 'İzinli (Yedek Aktif)' : 'Görevde / Müsait';
        const assigned = staff.totalRitusAssigned || 0;
        const completed = staff.ritusCompleted || 0;
        const rate = staff.completionRate ?? (assigned > 0 ? Math.round((completed / assigned) * 100) : 0);
        const revs = staff.totalRevisionsReceived || 0;
        const escalations = staff.escalatedCount || 0;
        const sequaDone = staff.sequaCompleted || 0;
        const sequaTotal = staff.sequaAssigned || 0;

        return [
            staff.name || staff.email,
            roleLabel,
            backupName,
            leaveStatus,
            `${completed} / ${assigned}`,
            `%${rate}`,
            String(revs),
            String(escalations),
            `${sequaDone} / ${sequaTotal}`
        ];
    });

    autoTable(doc, {
        startY: currentY,
        margin: { left: marginX, right: marginX },
        theme: 'striped',
        tableWidth: contentWidth,
        head: [
            [
                'Personel Ad Soyad',
                'Operasyonel Rol',
                'Yedek Sorumlu',
                'İzin Durumu',
                'Ritus (Biten/Top.)',
                'Başarı',
                'Revizyon',
                'Eskalasyon',
                'Sequa'
            ]
        ],
        body: staffTableRows,
        styles: {
            font: fontNormal,
            fontSize: 7.5,
            cellPadding: 2.2,
            textColor: [30, 41, 59],
            valign: 'middle'
        },
        headStyles: {
            font: fontBold,
            fontStyle: 'bold',
            fillColor: [30, 41, 59], // Slate-800
            textColor: [255, 255, 255],
            fontSize: 7.5
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252] // Slate-50
        },
        columnStyles: {
            0: { font: fontBold, fontStyle: 'bold', cellWidth: 32 },
            1: { cellWidth: 28 },
            2: { cellWidth: 24 },
            3: { cellWidth: 26 },
            4: { halign: 'center', cellWidth: 18 },
            5: { halign: 'center', font: fontBold, fontStyle: 'bold', cellWidth: 14 },
            6: { halign: 'center', cellWidth: 14 },
            7: { halign: 'center', cellWidth: 14 },
            8: { halign: 'center', cellWidth: 12 }
        }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // --- Section 3: Son Tekrarlatılan (Revizyon) ve Eskale Edilen Görevler ---
    const revisions = report?.recentRevisionsAndEscalations || [];
    if (revisions.length > 0) {
        // Check if there is enough space on page, otherwise page break handled by autoTable
        if (currentY > 230) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFont(fontBold, 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        doc.text('3. Denetim Uygunsuzluk & Tekrarlatma (Revizyon) Kayıtları', marginX, currentY);
        currentY += 3;

        const revisionRows = revisions.slice(0, 15).map(item => {
            const assignee = getMemberName ? getMemberName(item.effectiveAssignee, members) : item.effectiveAssignee;
            const reviewer = getMemberName ? getMemberName(item.effectiveReviewer, members) : item.effectiveReviewer;
            const note = item.escalationNote || item.lastRevisionNote || '-';

            return [
                item.title || 'İsimsiz Görev',
                assignee || '-',
                reviewer || '-',
                `${item.revisionCount || 0} Kez`,
                item.status === 'escalated' ? 'Hekime Eskale' : (item.status === 'needs_revision' ? 'Revizyon Bekliyor' : item.status),
                note
            ];
        });

        autoTable(doc, {
            startY: currentY,
            margin: { left: marginX, right: marginX },
            theme: 'grid',
            tableWidth: contentWidth,
            head: [
                [
                    'Görev Adı',
                    'Görevli Personel',
                    'Denetçi',
                    'Tekrar',
                    'Durum',
                    'Denetçi Notu / Eskalasyon Gerekçesi'
                ]
            ],
            body: revisionRows,
            styles: {
                font: fontNormal,
                fontSize: 7.2,
                cellPadding: 2,
                textColor: [30, 41, 59]
            },
            headStyles: {
                font: fontBold,
                fontStyle: 'bold',
                fillColor: [180, 83, 9], // Amber-700
                textColor: [255, 255, 255]
            },
            columnStyles: {
                0: { font: fontBold, fontStyle: 'bold', cellWidth: 40 },
                1: { cellWidth: 26 },
                2: { cellWidth: 26 },
                3: { halign: 'center', cellWidth: 14 },
                4: { cellWidth: 24 },
                5: { cellWidth: 52 }
            }
        });

        currentY = doc.lastAutoTable.finalY + 8;
    }

    // --- Section 4: Üniversite Dış Birim & Teknik Servis Kayıtları ---
    if (externalTasks.length > 0) {
        if (currentY > 230) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFont(fontBold, 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        doc.text('4. Üniversite Dış Birim / Sequa Teknik İş Takibi', marginX, currentY);
        currentY += 3;

        const externalRows = externalTasks.slice(0, 10).map(t => {
            const assignee = getMemberName ? getMemberName(t.assignedTo, members) : t.assignedTo;
            return [
                t.externalUnit || 'Üniversite Birimi',
                t.title || '-',
                assignee || '-',
                t.priority === 'critical' ? 'Kritik' : (t.priority === 'high' ? 'Yüksek' : 'Normal'),
                t.status === 'done' ? 'Tamamlandı' : 'Açık / Devam Ediyor'
            ];
        });

        autoTable(doc, {
            startY: currentY,
            margin: { left: marginX, right: marginX },
            theme: 'grid',
            tableWidth: contentWidth,
            head: [
                ['Birim', 'Talep / Arıza Başlığı', 'İç Takipçi', 'Öncelik', 'Durum']
            ],
            body: externalRows,
            styles: {
                font: fontNormal,
                fontSize: 7.2,
                cellPadding: 2,
                textColor: [30, 41, 59]
            },
            headStyles: {
                font: fontBold,
                fontStyle: 'bold',
                fillColor: [109, 40, 217], // Purple-700
                textColor: [255, 255, 255]
            },
            columnStyles: {
                0: { font: fontBold, fontStyle: 'bold', cellWidth: 36 },
                1: { cellWidth: 62 },
                2: { cellWidth: 32 },
                3: { halign: 'center', cellWidth: 22 },
                4: { halign: 'center', cellWidth: 30 }
            }
        });
    }

    // --- Page Numbering & Official Verification Footer on all pages ---
    const totalPages = doc.getNumberOfPages();
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        doc.setPage(pageNum);

        const pageHeight = doc.internal.pageSize.getHeight();
        const footerY = pageHeight - 10;

        // Top thin rule for footer
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(marginX, footerY - 3, marginX + contentWidth, footerY - 3);

        doc.setFont(fontNormal, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184); // Slate-400

        doc.text(
            'WildType Deney Hayvanları Araştırma Laboratuvarı • Pulsus Rutin ve Denetim Sistemi • Resmi HADMEK/HADYEK Nüshası',
            marginX,
            footerY
        );

        doc.text(
            `Sayfa ${pageNum} / ${totalPages}`,
            marginX + contentWidth,
            footerY,
            { align: 'right' }
        );
    }

    // --- Save File ---
    const outFilename = filename || `pulsus-denetim-raporu-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(outFilename);

    return doc;
}

/**
 * Universal standalone helper to download the Audit PDF from anywhere in the application.
 */
export async function downloadAuditReportPdf(user = null) {
    const [report, membersRes] = await Promise.all([
        apiFetch('/api/reports'),
        apiFetch('/api/members').catch(() => ({ members: DEFAULT_STAFF_DIRECTORY }))
    ]);
    const members = membersRes?.members || DEFAULT_STAFF_DIRECTORY;
    const staffMetrics = report?.staffMetrics || [];
    const combinedStaffRows = members.map(m => {
        const metric =
            staffMetrics.find(
                s => String(s.email).toLowerCase() === String(m.email).toLowerCase()
            ) || {};
        return { ...metric, ...m };
    });
    return exportAuditReportPdf({
        report,
        members,
        user,
        combinedStaffRows
    });
}

export default exportAuditReportPdf;
