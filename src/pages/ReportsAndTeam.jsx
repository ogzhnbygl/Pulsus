import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Download,
    Palmtree,
    RotateCcw,
    ShieldAlert,
    Building2,
    Users,
    Edit3,
    UserPlus,
    X,
    Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    apiFetch,
    DEFAULT_STAFF_DIRECTORY,
    getRoleBadgeInfo,
    getMemberName
} from '../utils/pulsusHelpers';

const PRESET_TITLES = [
    { label: 'Sorumlu Veteriner Hekim', role: 'vet' },
    { label: 'Veteriner Sağlık Teknikeri', role: 'technician' },
    { label: 'Laboratuvar Teknikeri', role: 'technician' },
    { label: 'Hayvan Bakıcısı / Temizlik Görevlisi', role: 'caretaker' }
];

export default function ReportsAndTeam() {
    const { user, isVet, refreshUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [report, setReport] = useState(null);
    const [members, setMembers] = useState(DEFAULT_STAFF_DIRECTORY);
    const [loading, setLoading] = useState(true);

    // Role & Duty Management Modal State
    const [memberModalOpen, setMemberModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);

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

    const highlightRoles = searchParams.get('manage') === 'roles';

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

    const handleDeleteMember = async email => {
        if (String(email).toLowerCase() === String(user?.email || '').toLowerCase()) {
            alert('Kendi aktif personel kaydınızı silemezsiniz.');
            return;
        }
        if (!window.confirm(`${email} personel kaydını silmek istediğinize emin misiniz?`)) return;
        try {
            await apiFetch(`/api/members?email=${encodeURIComponent(email)}`, {
                method: 'DELETE'
            });
            await loadReport();
        } catch (err) {
            alert(err.message || 'Personel silinemedi.');
        }
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

    // Merge members list with staffMetrics so any newly added member is always shown
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
                            EKİP &amp; PERFORMANS
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                            Personel Görev Tanımları, İzin Yedekleri ve Denetim Raporu
                        </span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
                        Personel Performansı, Tekrarlatılan İşler ve Ekip Görev Yönetimi
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {isVet && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingMember(null);
                                setMemberModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs"
                        >
                            <UserPlus size={14} />
                            Personel / Görev Tanımla
                        </button>
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

            {/* Staff Directory, Role/Duty Assignment & Performance Table */}
            <div
                className={`bg-white rounded-2xl border shadow-xs overflow-hidden transition-all ${
                    highlightRoles
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'border-slate-200'
                }`}
            >
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <Users size={18} className="text-indigo-600 shrink-0" />
                        <div>
                            <h2 className="text-sm font-extrabold text-slate-900">
                                Laboratuvar Ekibi, Canlı Circa İzin Durumu ve Performans Matrisi
                            </h2>
                            <p className="text-xs text-slate-500">
                                {isVet
                                    ? 'Yönetici olarak her personelin sistemdeki yetki rolünü (Hekim / Tekniker / Bakıcı), görev ünvanını ve Circa izin yedeğini sağdaki "Görev & Rol Ata" butonuyla değiştirebilirsiniz.'
                                    : 'Kişi bazlı görev ünvanları, tamamlanan rutinler, tekrarlatma sayıları ve yedek devir istatistikleri'}
                            </p>
                        </div>
                    </div>

                    {highlightRoles && (
                        <button
                            type="button"
                            onClick={() => setSearchParams({})}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 self-end sm:self-auto"
                        >
                            Vurguyu Kapat
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                <th className="py-3 px-4">Personel</th>
                                <th className="py-3 px-4">Görev Ünvanı &amp; Yetki Rolü</th>
                                <th className="py-3 px-4">Varsayılan Yedek</th>
                                <th className="py-3 px-4">Circa İzin Durumu</th>
                                <th className="py-3 px-4 text-center">Ritus (Biten/Toplam)</th>
                                <th className="py-3 px-4 text-center">Tekrarlatılan</th>
                                <th className="py-3 px-4 text-center">Eskalasyon</th>
                                <th className="py-3 px-4 text-center">Sequa (Biten/Toplam)</th>
                                {isVet && <th className="py-3 px-4 text-right">Görev / Rol Ayarı</th>}
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
                                            <div className="font-semibold text-slate-800 mb-1">
                                                {staff.title || roleInfo.label}
                                            </div>
                                            <span
                                                className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${roleInfo.className}`}
                                            >
                                                Yetki: {roleInfo.shortLabel}
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
                                        {isVet && (
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingMember(staff);
                                                            setMemberModalOpen(true);
                                                        }}
                                                        className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-colors"
                                                    >
                                                        <Edit3 size={12} />
                                                        Görev &amp; Rol Ata
                                                    </button>
                                                    {String(staff.email).toLowerCase() !==
                                                        String(user?.email || '').toLowerCase() && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleDeleteMember(staff.email)
                                                            }
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                            title="Personel kaydını kaldır"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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

            {memberModalOpen && (
                <MemberRoleModal
                    isOpen={memberModalOpen}
                    onClose={() => setMemberModalOpen(false)}
                    initialMember={editingMember}
                    members={members}
                    onSaved={async () => {
                        setMemberModalOpen(false);
                        await loadReport();
                        if (refreshUser) await refreshUser();
                    }}
                />
            )}
        </div>
    );
}

function MemberRoleModal({ isOpen, onClose, initialMember, members, onSaved }) {
    const isEdit = Boolean(initialMember?.email);
    const [email, setEmail] = useState(initialMember?.email || '');
    const [name, setName] = useState(initialMember?.name || '');
    const [pulsusRole, setPulsusRole] = useState(initialMember?.pulsusRole || 'caretaker');
    const [title, setTitle] = useState(
        initialMember?.title ||
            (initialMember?.pulsusRole === 'vet'
                ? 'Sorumlu Veteriner Hekim'
                : initialMember?.pulsusRole === 'technician'
                  ? 'Veteriner Sağlık Teknikeri'
                  : 'Hayvan Bakıcısı / Temizlik Görevlisi')
    );
    const [defaultBackupEmail, setDefaultBackupEmail] = useState(
        initialMember?.defaultBackupEmail || ''
    );
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleRoleSelect = newRole => {
        setPulsusRole(newRole);
        if (newRole === 'vet') setTitle('Sorumlu Veteriner Hekim');
        else if (newRole === 'technician' && !title.toLowerCase().includes('tekniker')) {
            setTitle('Veteriner Sağlık Teknikeri');
        } else if (newRole === 'caretaker') {
            setTitle('Hayvan Bakıcısı / Temizlik Görevlisi');
        }
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await apiFetch('/api/members', {
                method: isEdit ? 'PUT' : 'POST',
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    name: name.trim(),
                    pulsusRole,
                    title: title.trim(),
                    defaultBackupEmail: defaultBackupEmail || null,
                    isActive: true
                })
            });
            await onSaved();
        } catch (err) {
            setError(err.message || 'Personel görev/rol bilgisi kaydedilemedi.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="shrink-0 px-5 py-3.5 bg-gradient-to-r from-indigo-700 to-violet-700 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-sm sm:text-base font-bold">
                            {isEdit
                                ? 'Personel Görev & Yetki Rolünü Düzenle'
                                : 'Yeni Personel & Görev Tanımla'}
                        </h3>
                        <p className="text-[11px] text-indigo-100">
                            Sistemdeki yetki grubunu, görev ünvanını ve Circa izin yedeğini belirleyin
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col flex-1 min-h-0 overflow-hidden"
                >
                    <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ad Soyad *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Örn: Kübra Çelik"
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Kurumsal E-Posta *
                                </label>
                                <input
                                    type="email"
                                    required
                                    disabled={isEdit}
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="ad.soyad@medeniyet.edu.tr"
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl disabled:bg-slate-100 disabled:text-slate-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                1. Sistem Yetki Rolü (Pulsus Davranışı) *
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleRoleSelect('vet')}
                                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                                        pulsusRole === 'vet'
                                            ? 'bg-rose-50 border-rose-500 text-rose-950 ring-1 ring-rose-500'
                                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="font-extrabold">
                                        🩺 Sorumlu Veteriner Hekim (Tam Yetki / Admin)
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                        Ritus rutin şablonlarını oluşturur/düzenler, eskalasyonları ve dış birim işlerini yönetir, personel rollerini atar.
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleRoleSelect('technician')}
                                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                                        pulsusRole === 'technician'
                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-950 ring-1 ring-indigo-500'
                                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="font-extrabold">
                                        🔬 Tekniker / Denetçi (Kontrol Eden &amp; Görev Atayan)
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                        Rutin görevleri denetler (onaylar, tekrarlatır veya hekime eskale eder), Sequa üzerinden görev açar ve hekimden muayene talep eder.
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleRoleSelect('caretaker')}
                                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                                        pulsusRole === 'caretaker'
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="font-extrabold">
                                        🧹 Hayvan Bakıcısı / Temizlik Görevlisi (Uygulayıcı)
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                        Kendisine atanan rutin ve anlık görevleri uygular, kontrole gönderir; aksaklık gördüğünde üst sorumluya problem bildirir.
                                    </div>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                2. Görev / Pozisyon Ünvanı (Ekranda Görünen Görev Adı) *
                            </label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {PRESET_TITLES.map(preset => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => {
                                            setTitle(preset.label);
                                            setPulsusRole(preset.role);
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                            title === preset.label
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Örn: Veteriner Sağlık Teknikeri"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                3. Varsayılan Circa İzin Yedeği
                            </label>
                            <select
                                value={defaultBackupEmail}
                                onChange={e => setDefaultBackupEmail(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                            >
                                <option value="">
                                    Yedek Yok (İzinliyken Sorumlu Vet. Hekime Düşsün)
                                </option>
                                {members
                                    .filter(
                                        m =>
                                            String(m.email).toLowerCase() !==
                                            String(email).trim().toLowerCase()
                                    )
                                    .map(m => (
                                        <option key={m.email} value={m.email}>
                                            {m.name} ({m.title || m.pulsusRole})
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {error && (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70"
                        >
                            Vazgeç
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            {submitting ? 'Kaydediliyor...' : 'Görev ve Rolü Kaydet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
