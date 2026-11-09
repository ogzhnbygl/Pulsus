import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Download,
    Palmtree,
    RotateCcw,
    ShieldAlert,
    Building2,
    Users,
    Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    apiFetch,
    DEFAULT_STAFF_DIRECTORY,
    getRoleBadgeInfo,
    getMemberName
} from '../utils/pulsusHelpers';

export default function ReportsAndTeam() {
    const { isVet } = useAuth();
    const [report, setReport] = useState(null);
    const [members, setMembers] = useState(DEFAULT_STAFF_DIRECTORY);
    const [loading, setLoading] = useState(true);

    const loadReport = useCallback(async () => {
        setLoading(true);
        try {
            const [repRes, memRes] = await Promise.all([
                apiFetch('/api/reports'),
                apiFetch('/api/members').catch(() => ({ members: DEFAULT_STAFF_DIRECTORY }))
            ]);
            setReport(repRes);
            if (memRes?.members?.length) {
                setMembers(memRes.members);
            }
        } catch (err) {
            console.error('Raporlar yüklenemedi:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const exportJson = () => {
        if (!report) return;
        const blob = new Blob([JSON.stringify(report, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulsus-performans-raporu-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportCsv = () => {
        if (!report?.staffMetrics) return;
        const headers = [
            'Ad Soyad',
            'E-Posta',
            'Rol',
            'Atanan Ritus',
            'Tamamlanan Ritus',
            'Tekrarlatma (Revizyon) Sayısı',
            'Hekime Eskalasyon',
            'Circa İzin Devri (Çıkan)',
            'Yedek Olarak Devralınan',
            'Tamamlanan Sequa'
        ];
        const rows = report.staffMetrics.map(s => [
            `"${s.name || ''}"`,
            `"${s.email || ''}"`,
            `"${s.pulsusRole || ''}"`,
            s.totalRitusAssigned || 0,
            s.ritusCompleted || 0,
            s.totalRevisionsReceived || 0,
            s.escalatedCount || 0,
            s.delegatedOutByLeave || 0,
            s.delegatedInAsBackup || 0,
            s.sequaCompleted || 0
        ]);
        const csvContent =
            '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pulsus-personel-performans-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-xs text-slate-400">
                Performans, denetim ve Circa izin metrikleri hesaplanıyor...
            </div>
        );
    }

    const summary = report?.summary || {};
    const staffMetrics = report?.staffMetrics || [];
    const revisions = report?.recentRevisionsAndEscalations || [];
    const externalTasks = report?.externalTasks || [];

    const combinedStaffRows = members.map(m => {
        const metric =
            staffMetrics.find(
                s => String(s.email).toLowerCase() === String(m.email).toLowerCase()
            ) || {};
        return {
            ...metric,
            ...m
        };
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Header & Export */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-violet-600 text-white">
                            ANALİTİK &amp; DENETİM
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                            Ritus + Sequa + Circa İzin Devir Raporu
                        </span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
                        Personel Performansı, Tekrarlatılan İşler ve Ekip İzin Durumu
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {isVet && (
                        <Link
                            to="/staff"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700"
                        >
                            <Settings size={14} />
                            Personel &amp; Rol Yönetimi Sayfası
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={exportCsv}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700"
                    >
                        <Download size={14} />
                        CSV İndir
                    </button>
                    <button
                        type="button"
                        onClick={exportJson}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white"
                    >
                        <Download size={14} />
                        JSON Raporu
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">
                        Toplam Ritus
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">
                        {summary.totalRitusRuns ?? 0}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                        %{summary.ritusCompletionRate ?? 0} Tamamlanma
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-amber-200 p-4">
                    <div className="text-[11px] font-bold text-amber-700 uppercase flex items-center gap-1">
                        <RotateCcw size={12} /> Tekrarlatılan İş
                    </div>
                    <div className="text-2xl font-extrabold text-amber-800 mt-1">
                        {summary.totalRevisions ?? 0}
                    </div>
                    <div className="text-[11px] text-amber-700 mt-0.5">
                        Denetçiden dönen işler
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-rose-200 p-4">
                    <div className="text-[11px] font-bold text-rose-700 uppercase flex items-center gap-1">
                        <ShieldAlert size={12} /> Hekime Eskale
                    </div>
                    <div className="text-2xl font-extrabold text-rose-800 mt-1">
                        {summary.totalEscalations ?? 0}
                    </div>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                        Kritik / eksik bildirim
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-indigo-200 p-4">
                    <div className="text-[11px] font-bold text-indigo-700 uppercase flex items-center gap-1">
                        <Palmtree size={12} /> Circa Yedek Devri
                    </div>
                    <div className="text-2xl font-extrabold text-indigo-800 mt-1">
                        {summary.totalBackupHandovers ?? 0}
                    </div>
                    <div className="text-[11px] text-indigo-700 mt-0.5">
                        İzinden yedeğe geçen
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                        Yedeksiz Hekime Düşen
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">
                        {summary.totalVetFallbacks ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        Asil + Yedek izinli
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-purple-200 p-4">
                    <div className="text-[11px] font-bold text-purple-700 uppercase flex items-center gap-1">
                        <Building2 size={12} /> Dış Birim (Sequa)
                    </div>
                    <div className="text-2xl font-extrabold text-purple-900 mt-1">
                        {summary.totalExternalTasks ?? externalTasks.length}
                    </div>
                    <div className="text-[11px] text-purple-700 mt-0.5">
                        Üniversite birimleri
                    </div>
                </div>
            </div>

            {/* Staff Directory, Live Circa Leave Status & Performance Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users size={18} className="text-indigo-600" />
                        <div>
                            <h2 className="text-sm font-extrabold text-slate-900">
                                Laboratuvar Ekibi, Canlı Circa İzin Durumu ve Performans Matrisi
                            </h2>
                            <p className="text-xs text-slate-500">
                                Kişi bazlı tamamlanan rutinler, tekrarlatma (revizyon) sayıları ve yedek devir istatistikleri
                            </p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                <th className="py-3 px-4">Personel</th>
                                <th className="py-3 px-4">Operasyonel Rol</th>
                                <th className="py-3 px-4">Varsayılan Yedek</th>
                                <th className="py-3 px-4">Circa İzin Durumu</th>
                                <th className="py-3 px-4 text-center">Ritus (Biten/Toplam)</th>
                                <th className="py-3 px-4 text-center">Tekrarlatılan (Revizyon)</th>
                                <th className="py-3 px-4 text-center">Eskalasyon</th>
                                <th className="py-3 px-4 text-center">Sequa (Biten/Toplam)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {combinedStaffRows.map(staff => {
                                const roleInfo = getRoleBadgeInfo(staff.pulsusRole);
                                return (
                                    <tr key={staff.email} className="hover:bg-slate-50/80">
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <div className="font-bold text-slate-900">
                                                {staff.name}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {staff.email}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${roleInfo.className}`}
                                            >
                                                {staff.title || roleInfo.shortLabel}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                                            {getMemberName(staff.defaultBackupEmail, members)}
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            {staff.onLeaveToday ? (
                                                <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                    🏖️ Circa&apos;da İzinli (Yedek Aktif)
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    🟢 Görevde / Müsait
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                                            {staff.ritusCompleted || 0} /{' '}
                                            {staff.totalRitusAssigned || 0}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span
                                                className={`px-2 py-0.5 rounded-full font-extrabold ${
                                                    (staff.totalRevisionsReceived || 0) > 0
                                                        ? 'bg-amber-100 text-amber-900'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}
                                            >
                                                {staff.totalRevisionsReceived || 0}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span
                                                className={`px-2 py-0.5 rounded-full font-extrabold ${
                                                    (staff.escalatedCount || 0) > 0
                                                        ? 'bg-rose-100 text-rose-900'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}
                                            >
                                                {staff.escalatedCount || 0}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                                            {staff.sequaCompleted || 0} /{' '}
                                            {staff.sequaAssigned || 0}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Revisions & Escalations Audit History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <RotateCcw size={16} className="text-amber-600" />
                        Son Tekrarlatılan (Revizyon) ve Eskale Edilen Görevler
                    </h3>
                    {revisions.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                            Henüz tekrarlatılan veya eskale edilen görev kaydı bulunmuyor.
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {revisions.map(item => (
                                <div
                                    key={item._id}
                                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                                >
                                    <div className="flex items-center justify-between font-bold text-slate-900">
                                        <span>{item.title}</span>
                                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px]">
                                            {item.revisionCount || 0} Revizyon • Durum: {item.status}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-slate-600">
                                        Görevli: {getMemberName(item.effectiveAssignee, members)} | Denetçi:{' '}
                                        {getMemberName(item.effectiveReviewer, members)}
                                    </div>
                                    {(item.lastRevisionNote || item.escalationNote) && (
                                        <div className="text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-200">
                                            {item.escalationNote || item.lastRevisionNote}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* External University Units Tracking */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <Building2 size={16} className="text-purple-600" />
                        Üniversite Dış Birim / Teknik Servis İş Takibi
                    </h3>
                    {externalTasks.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                            Açık dış birim / üniversite kaydı bulunmuyor.
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {externalTasks.map(ext => (
                                <div
                                    key={ext._id}
                                    className="p-3 rounded-xl bg-purple-50/40 border border-purple-200 text-xs space-y-1"
                                >
                                    <div className="flex items-center justify-between font-bold text-slate-900">
                                        <span>{ext.title}</span>
                                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 text-[10px]">
                                            {ext.status === 'done' ? '✓ Çözüldü' : 'Takip Ediliyor'}
                                        </span>
                                    </div>
                                    <div className="text-[11px] font-semibold text-purple-800">
                                        🏛️ {ext.externalUnit || 'Üniversite Birimi'}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        İç Sorumlu: {getMemberName(ext.assignedTo, members)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
