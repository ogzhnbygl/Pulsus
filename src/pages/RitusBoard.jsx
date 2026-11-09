import React, { useState, useEffect, useCallback } from 'react';
import {
    CalendarClock,
    Plus,
    Lock,
    CheckSquare,
    Square,
    RotateCcw,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Palmtree,
    Link2,
    Edit3,
    Trash2,
    Send,
    RefreshCw,
    X,
    UserCheck,
    SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    apiFetch,
    VET_EMAIL,
    DEFAULT_STAFF_DIRECTORY,
    DAYS_OF_WEEK,
    RITUS_CATEGORIES,
    RITUS_FREQUENCIES,
    formatScheduledBadge,
    formatWeekRangeLabel,
    formatTemplateScheduleSummary,
    getMemberName
} from '../utils/pulsusHelpers';
import { CreateSequaModal, RitusActionModal } from '../components/TaskModals';

export default function RitusBoard() {
    const { user, isVet, isCaretaker } = useAuth();
    const [activeSubTab, setActiveSubTab] = useState('kanban'); // 'kanban' | 'templates'
    const [selectedWeekMode, setSelectedWeekMode] = useState('current'); // 'current' | 'next'
    const [ritusState, setRitusState] = useState({
        runs: [],
        weekStart: '',
        currentWeekStart: '',
        nextWeekStart: '',
        nextWeekDistributed: false
    });
    const [templates, setTemplates] = useState([]);
    const [members, setMembers] = useState(DEFAULT_STAFF_DIRECTORY);
    const [loading, setLoading] = useState(true);
    const [distributing, setDistributing] = useState(false);

    // Filters
    const [filterAssignee, setFilterAssignee] = useState('ALL');
    const [filterFrequency, setFilterFrequency] = useState('ALL');

    // Modals
    const [actionModal, setActionModal] = useState({ open: false, run: null, actionType: null });
    const [spawnSequaModal, setSpawnSequaModal] = useState({ open: false, run: null });
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [runsRes, tplRes, memRes] = await Promise.all([
                apiFetch(`/api/ritus/runs?week=${selectedWeekMode}`),
                apiFetch('/api/ritus/templates'),
                apiFetch('/api/members').catch(() => ({ members: DEFAULT_STAFF_DIRECTORY }))
            ]);
            setRitusState(runsRes);
            setTemplates(tplRes.templates || []);
            if (memRes?.members?.length) {
                setMembers(memRes.members);
            }
        } catch (err) {
            console.error('Ritus verileri yüklenemedi:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedWeekMode]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleTriggerDistribution = async target => {
        setDistributing(true);
        try {
            await apiFetch('/api/ritus/runs', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'distribute',
                    scope: target
                })
            });
            if (target === 'next_week') {
                setSelectedWeekMode('next');
            }
            await loadData();
        } catch (err) {
            alert(err.message || 'Dağıtım sırasında hata oluştu.');
        } finally {
            setDistributing(false);
        }
    };

    const handleSyncCircaLeaves = async () => {
        setDistributing(true);
        try {
            await apiFetch('/api/ritus/runs', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'sync_leaves',
                    weekStart: ritusState.weekStart
                })
            });
            await loadData();
        } catch (err) {
            alert(err.message || 'Circa izin senkronizasyonu başarısız oldu.');
        } finally {
            setDistributing(false);
        }
    };

    const handleRunPatch = async (runId, action, extra = {}) => {
        try {
            await apiFetch('/api/ritus/runs', {
                method: 'PATCH',
                body: JSON.stringify({ id: String(runId), action, ...extra })
            });
            await loadData();
        } catch (err) {
            alert(err.message || 'İşlem başarısız oldu.');
        }
    };

    const handleDeleteTemplate = async templateId => {
        if (!window.confirm('Bu rutin şablonunu silmek istediğinize emin misiniz?')) return;
        try {
            await apiFetch(`/api/ritus/templates?id=${templateId}`, { method: 'DELETE' });
            await loadData();
        } catch (err) {
            alert(err.message || 'Şablon silinemedi.');
        }
    };

    const myEmail = String(user?.email || '').toLowerCase();

    const filteredRuns = (ritusState.runs || []).filter(run => {
        if (filterAssignee !== 'ALL') {
            if (
                String(run.effectiveAssignee || '').toLowerCase() !==
                filterAssignee.toLowerCase()
            ) {
                return false;
            }
        }
        if (filterFrequency !== 'ALL' && run.frequency !== filterFrequency) {
            return false;
        }
        return true;
    });

    const columns = [
        {
            key: 'todo',
            title: 'Yapılacak (Planlandı)',
            headerClass: 'bg-slate-100 text-slate-800 border-slate-200',
            items: filteredRuns.filter(r => r.status === 'todo')
        },
        {
            key: 'in_progress_or_revision',
            title: 'Yapılıyor & Tekrarlatılanlar',
            headerClass: 'bg-amber-50 text-amber-900 border-amber-200',
            items: filteredRuns.filter(
                r => r.status === 'in_progress' || r.status === 'needs_revision'
            )
        },
        {
            key: 'pending_review',
            title: 'Denetim Bekliyor (Kontrol)',
            headerClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
            items: filteredRuns.filter(r => r.status === 'pending_review')
        },
        {
            key: 'escalated',
            title: 'Hekime Bildirildi (Eskale)',
            headerClass: 'bg-rose-50 text-rose-900 border-rose-200',
            items: filteredRuns.filter(r => r.status === 'escalated')
        },
        {
            key: 'done',
            title: 'Onaylandı & Bitti',
            headerClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
            items: filteredRuns.filter(r => r.status === 'done')
        }
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
            {/* Header & Mode Switcher */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-600 text-white">
                            RITUS MOTORU
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                            Cuma 16:30 Otomatik Paket Dağıtımı &amp; Circa Yedek Zinciri
                        </span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
                        Periyodik Laboratuvar Rutinleri ve Denetim Akışı
                    </h1>
                </div>

                {/* Sub-tabs: Kanban vs Template Planner */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('kanban')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeSubTab === 'kanban'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            📋 Haftalık Operasyon Panosu
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('templates')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeSubTab === 'templates'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {!isVet && <Lock size={12} className="text-slate-400" />}
                            ⚙️ Rutin Şablon Planlayıcı ({templates.length})
                        </button>
                    </div>

                    {isVet && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingTemplate(null);
                                setTemplateModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs"
                        >
                            <Plus size={15} />
                            Yeni Rutin Şablonu
                        </button>
                    )}
                </div>
            </div>

            {activeSubTab === 'kanban' ? (
                <>
                    {/* Week Selector, Friday 16:30 Trigger & Filters */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setSelectedWeekMode('current')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                                        selectedWeekMode === 'current'
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Bu Hafta ({formatWeekRangeLabel(ritusState.currentWeekStart)})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedWeekMode('next')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                                        selectedWeekMode === 'next'
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Gelecek Hafta Paketi ({formatWeekRangeLabel(ritusState.nextWeekStart)})
                                </button>
                            </div>

                            <button
                                type="button"
                                disabled={distributing}
                                onClick={() => handleTriggerDistribution('next_week')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100"
                                title="Cuma 16:30 dağıtım motorunu gelecek hafta için çalıştır (Hafta ortası ay/çeyrek geçişleri dahil)"
                            >
                                <CalendarClock size={14} />
                                Cuma 16:30 Gelecek Hafta Paketini Dağıt
                            </button>

                            <button
                                type="button"
                                disabled={distributing}
                                onClick={handleSyncCircaLeaves}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                            >
                                <Palmtree size={14} />
                                Circa İzin &amp; Yedekleri Senkronize Et
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <SlidersHorizontal size={14} className="text-slate-400" />
                            <select
                                value={filterAssignee}
                                onChange={e => setFilterAssignee(e.target.value)}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
                            >
                                <option value="ALL">Tüm Personel</option>
                                {members.map(m => (
                                    <option key={m.email} value={m.email}>
                                        {m.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={filterFrequency}
                                onChange={e => setFilterFrequency(e.target.value)}
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
                            >
                                <option value="ALL">Tüm Periyotlar (Haftalık/Aylık/3 Aylık)</option>
                                <option value="weekly">Haftalık</option>
                                <option value="monthly">Aylık</option>
                                <option value="quarterly">3 Aylık</option>
                            </select>
                        </div>
                    </div>

                    {/* 5-Column Ritus Kanban */}
                    {loading ? (
                        <div className="py-12 text-center text-xs text-slate-400">
                            Ritus görev kartları yükleniyor...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
                            {columns.map(col => (
                                <div
                                    key={col.key}
                                    className="bg-slate-100/80 rounded-2xl border border-slate-200/90 p-3 space-y-3 min-h-[420px]"
                                >
                                    <div
                                        className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center justify-between ${col.headerClass}`}
                                    >
                                        <span>{col.title}</span>
                                        <span className="px-2 py-0.5 rounded-full bg-white/90 text-[11px] font-bold">
                                            {col.items.length}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {col.items.length === 0 ? (
                                            <div className="py-8 text-center text-[11px] text-slate-400">
                                                Bu sütunda kart yok
                                            </div>
                                        ) : (
                                            col.items.map(run => {
                                                const freq =
                                                    RITUS_FREQUENCIES[run.frequency] ||
                                                    RITUS_FREQUENCIES.weekly;
                                                const cat =
                                                    RITUS_CATEGORIES[run.category] ||
                                                    RITUS_CATEGORIES.other;
                                                const isMyRun =
                                                    String(
                                                        run.effectiveAssignee || ''
                                                    ).toLowerCase() === myEmail || isVet;
                                                const canReview =
                                                    isVet ||
                                                    String(
                                                        run.effectiveReviewer || ''
                                                    ).toLowerCase() === myEmail;

                                                return (
                                                    <div
                                                        key={run._id}
                                                        className={`bg-white rounded-xl p-3.5 border shadow-2xs space-y-2.5 ${
                                                            run.status === 'needs_revision'
                                                                ? 'border-2 border-amber-400'
                                                                : run.status === 'escalated'
                                                                  ? 'border-2 border-rose-400'
                                                                  : 'border-slate-200'
                                                        }`}
                                                    >
                                                        {/* Top Badges */}
                                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                                            <span
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${freq.badge}`}
                                                            >
                                                                {freq.label}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                                                <Clock size={11} className="text-indigo-600" />
                                                                {formatScheduledBadge(
                                                                    run.scheduledDate,
                                                                    run.scheduledTime
                                                                )}
                                                            </span>
                                                        </div>

                                                        {/* Repeated / Needs Revision Callout */}
                                                        {run.status === 'needs_revision' && (
                                                            <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-950">
                                                                <div className="font-extrabold flex items-center gap-1">
                                                                    <RotateCcw size={12} />
                                                                    🔄 TEKRARLATILDI ({run.revisionCount}. kez)
                                                                </div>
                                                                {run.lastRevisionNote && (
                                                                    <div className="mt-0.5 text-rose-800">
                                                                        Not: {run.lastRevisionNote}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Escalated Callout */}
                                                        {run.status === 'escalated' && (
                                                            <div className="p-2 rounded-lg bg-rose-50 border border-rose-300 text-[11px] text-rose-900">
                                                                <div className="font-extrabold">
                                                                    ⚠️ HEKİME BİLDİRİLDİ
                                                                </div>
                                                                {run.escalationNote && (
                                                                    <div className="mt-0.5">
                                                                        {run.escalationNote}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="text-xs font-extrabold text-slate-900">
                                                            {run.title}
                                                        </div>

                                                        <span
                                                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${cat.color}`}
                                                        >
                                                            {cat.label}
                                                        </span>

                                                        {/* Circa Leave / Backup Handover Badges */}
                                                        {run.assignmentStatus === 'backup' && (
                                                            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-900">
                                                                🏖️ Circa İzin Devri: Asil ({getMemberName(run.primaryAssignee, members)}) izinli ➡️ Yedek: <strong>{getMemberName(run.effectiveAssignee, members)}</strong>
                                                            </div>
                                                        )}

                                                        {run.assignmentStatus === 'vet_fallback' && (
                                                            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-900">
                                                                ⚠️ Yedeksiz / İzinli ➡️ Sorumlu Vet. Hekime Devredildi
                                                            </div>
                                                        )}

                                                        {/* Assignee & Reviewer Info */}
                                                        <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
                                                            <div>
                                                                Görevli:{' '}
                                                                <strong className="text-slate-800">
                                                                    {getMemberName(
                                                                        run.effectiveAssignee,
                                                                        members
                                                                    )}
                                                                </strong>
                                                            </div>
                                                            <div>
                                                                Denetçi:{' '}
                                                                <strong className="text-slate-800">
                                                                    {getMemberName(
                                                                        run.effectiveReviewer,
                                                                        members
                                                                    )}
                                                                </strong>
                                                                {run.reviewerStatus === 'backup' && (
                                                                    <span className="ml-1 text-[10px] text-amber-700 font-semibold">
                                                                        (Yedek Denetçi)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Interactive Checklist */}
                                                        {run.checklist?.length > 0 && (
                                                            <div className="space-y-1 pt-1 border-t border-slate-100">
                                                                {run.checklist.map((item, idx) => (
                                                                    <button
                                                                        key={item.id ?? idx}
                                                                        type="button"
                                                                        disabled={
                                                                            !isMyRun ||
                                                                            run.status === 'done'
                                                                        }
                                                                        onClick={() =>
                                                                            handleRunPatch(
                                                                                run._id,
                                                                                'toggle_checklist',
                                                                                {
                                                                                    checklistItemId: item.id ?? idx
                                                                                }
                                                                            )
                                                                        }
                                                                        className="w-full flex items-start gap-1.5 text-left text-[11px] text-slate-700 hover:text-indigo-700 disabled:opacity-75"
                                                                    >
                                                                        {item.done ? (
                                                                            <CheckSquare
                                                                                size={13}
                                                                                className="text-emerald-600 shrink-0 mt-0.5"
                                                                            />
                                                                        ) : (
                                                                            <Square
                                                                                size={13}
                                                                                className="text-slate-400 shrink-0 mt-0.5"
                                                                            />
                                                                        )}
                                                                        <span
                                                                            className={
                                                                                item.done
                                                                                    ? 'line-through text-slate-400'
                                                                                    : ''
                                                                            }
                                                                        >
                                                                            {item.text}
                                                                        </span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Action Buttons */}
                                                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                                                            {isMyRun && run.status === 'todo' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleRunPatch(
                                                                            run._id,
                                                                            'start'
                                                                        )
                                                                    }
                                                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700"
                                                                >
                                                                    Başlat
                                                                </button>
                                                            )}

                                                            {isMyRun &&
                                                                (run.status === 'todo' ||
                                                                    run.status === 'in_progress' ||
                                                                    run.status ===
                                                                        'needs_revision') && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleRunPatch(
                                                                                run._id,
                                                                                'submit_for_review'
                                                                            )
                                                                        }
                                                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700"
                                                                    >
                                                                        Kontrole Gönder
                                                                    </button>
                                                                )}

                                                            {/* Reviewer Actions on pending_review or escalated */}
                                                            {canReview &&
                                                                !isCaretaker &&
                                                                (run.status === 'pending_review' ||
                                                                    run.status === 'escalated') && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleRunPatch(
                                                                                    run._id,
                                                                                    'approve',
                                                                                    {
                                                                                        note: 'Denetçi tarafından onaylandı.'
                                                                                    }
                                                                                )
                                                                            }
                                                                            className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                                                                        >
                                                                            ✅ Onayla
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setActionModal({
                                                                                    open: true,
                                                                                    run,
                                                                                    actionType:
                                                                                        'request_revision'
                                                                                })
                                                                            }
                                                                            className="px-2 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold"
                                                                        >
                                                                            🔄 Tekrarlat
                                                                        </button>
                                                                        {run.status !==
                                                                            'escalated' && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setActionModal({
                                                                                        open: true,
                                                                                        run,
                                                                                        actionType:
                                                                                            'escalate_to_vet'
                                                                                    })
                                                                                }
                                                                                className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold"
                                                                            >
                                                                                ⚠️ Hekime Bildir
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}

                                                            {isVet && run.status !== 'done' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setActionModal({
                                                                            open: true,
                                                                            run,
                                                                            actionType:
                                                                                'vet_reassign'
                                                                        })
                                                                    }
                                                                    className="px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-bold"
                                                                >
                                                                    Yönlendir
                                                                </button>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setSpawnSequaModal({
                                                                        open: true,
                                                                        run
                                                                    })
                                                                }
                                                                className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-semibold inline-flex items-center gap-1 ml-auto"
                                                                title="Bu rutin görevden Sequa kaydı / arıza bildirimi doğur"
                                                            >
                                                                <Link2 size={11} />
                                                                Sequa Aç
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                /* TEMPLATE PLANNER SUB-TAB */
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    {!isVet && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900 font-semibold">
                            <Lock size={16} className="text-amber-700 shrink-0" />
                            🔒 Rutin görev şablonlarını yalnızca Sorumlu Veteriner Hekim (Oğuzhan Baygül) oluşturabilir, değiştirebilir ve silebilir.
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map(tpl => {
                            const freq =
                                RITUS_FREQUENCIES[tpl.frequency] || RITUS_FREQUENCIES.weekly;
                            const cat = RITUS_CATEGORIES[tpl.category] || RITUS_CATEGORIES.other;
                            return (
                                <div
                                    key={tpl._id}
                                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${freq.badge}`}
                                                >
                                                    {freq.label}
                                                </span>
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cat.color}`}
                                                >
                                                    {cat.label}
                                                </span>
                                            </div>
                                            <span className="text-xs font-bold text-indigo-700">
                                                {formatTemplateScheduleSummary(tpl)}
                                            </span>
                                        </div>

                                        <h3 className="text-sm font-extrabold text-slate-900">
                                            {tpl.title}
                                        </h3>
                                        {tpl.description && (
                                            <p className="text-xs text-slate-600">
                                                {tpl.description}
                                            </p>
                                        )}

                                        <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] bg-white p-2.5 rounded-xl border border-slate-200">
                                            <div>
                                                <span className="text-slate-400 block">
                                                    Asil Görevli:
                                                </span>
                                                <strong className="text-slate-800">
                                                    {getMemberName(tpl.primaryAssignee, members)}
                                                </strong>
                                                <span className="text-slate-400 block mt-1">
                                                    Yedek Görevli:
                                                </span>
                                                <strong className="text-slate-700">
                                                    {tpl.backupAssignee
                                                        ? getMemberName(tpl.backupAssignee, members)
                                                        : 'Girilmedi (Vet. Hekime Düşer)'}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block">
                                                    Asil Denetçi:
                                                </span>
                                                <strong className="text-slate-800">
                                                    {getMemberName(tpl.primaryReviewer, members)}
                                                </strong>
                                                <span className="text-slate-400 block mt-1">
                                                    Yedek Denetçi:
                                                </span>
                                                <strong className="text-slate-700">
                                                    {tpl.backupReviewer
                                                        ? getMemberName(tpl.backupReviewer, members)
                                                        : 'Girilmedi (Vet. Hekime Düşer)'}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>

                                    {isVet && (
                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingTemplate(tpl);
                                                    setTemplateModalOpen(true);
                                                }}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700"
                                            >
                                                <Edit3 size={13} />
                                                Düzenle (Bu Hafta / Gelecek Hafta Seçimli)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTemplate(tpl._id)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-xs font-bold text-rose-700"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Ritus Template Create / Edit Modal with CRITICAL updateScope ('current_week' vs 'next_week') */}
            {templateModalOpen && (
                <RitusTemplateModal
                    isOpen={templateModalOpen}
                    onClose={() => setTemplateModalOpen(false)}
                    initialTemplate={editingTemplate}
                    members={members}
                    onSaved={async () => {
                        setTemplateModalOpen(false);
                        await loadData();
                    }}
                />
            )}

            <RitusActionModal
                isOpen={actionModal.open}
                onClose={() => setActionModal({ open: false, run: null, actionType: null })}
                run={actionModal.run}
                actionType={actionModal.actionType}
                members={members}
                onSubmit={async payload => {
                    await apiFetch('/api/ritus/runs', {
                        method: 'PATCH',
                        body: JSON.stringify(payload)
                    });
                    await loadData();
                }}
            />

            <CreateSequaModal
                isOpen={spawnSequaModal.open}
                onClose={() => setSpawnSequaModal({ open: false, run: null })}
                user={user}
                members={members}
                sourceRitusRun={spawnSequaModal.run}
                onSubmit={async payload => {
                    await apiFetch('/api/sequa/tasks', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    await loadData();
                }}
            />
        </div>
    );
}

function RitusTemplateModal({ isOpen, onClose, initialTemplate, members, onSaved }) {
    const isEdit = Boolean(initialTemplate?._id);
    const [title, setTitle] = useState(initialTemplate?.title || '');
    const [description, setDescription] = useState(initialTemplate?.description || '');
    const [category, setCategory] = useState(initialTemplate?.category || 'cleaning');
    const [frequency, setFrequency] = useState(initialTemplate?.frequency || 'weekly');
    const [daysOfWeek, setDaysOfWeek] = useState(initialTemplate?.daysOfWeek || [1, 4]);
    const [dayOfMonth, setDayOfMonth] = useState(initialTemplate?.dayOfMonth || 15);
    const [scheduledTime, setScheduledTime] = useState(initialTemplate?.scheduledTime || '09:00');
    const [primaryAssignee, setPrimaryAssignee] = useState(
        initialTemplate?.primaryAssignee || 'gokhan.sert@medeniyet.edu.tr'
    );
    const [backupAssignee, setBackupAssignee] = useState(
        initialTemplate?.backupAssignee ?? 'yusufenes.isik@medeniyet.edu.tr'
    );
    const [primaryReviewer, setPrimaryReviewer] = useState(
        initialTemplate?.primaryReviewer || 'kubra.celik@medeniyet.edu.tr'
    );
    const [backupReviewer, setBackupReviewer] = useState(
        initialTemplate?.backupReviewer ?? 'gamze.demir@medeniyet.edu.tr'
    );
    const [checklistText, setChecklistText] = useState(
        (initialTemplate?.checklist || ['Altlık ve suluk kontrolü', 'Zemin dezenfeksiyonu']).join('\n')
    );
    const [updateScope, setUpdateScope] = useState('current_week');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const toggleDay = d => {
        if (daysOfWeek.includes(d)) {
            if (daysOfWeek.length > 1) setDaysOfWeek(daysOfWeek.filter(x => x !== d));
        } else {
            setDaysOfWeek([...daysOfWeek, d].sort((a, b) => a - b));
        }
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const payload = {
                ...(isEdit ? { id: String(initialTemplate._id) } : {}),
                title: title.trim(),
                description: description.trim(),
                category,
                frequency,
                daysOfWeek,
                dayOfMonth: Number(dayOfMonth) || 1,
                scheduledTime,
                primaryAssignee,
                backupAssignee: backupAssignee || null,
                primaryReviewer,
                backupReviewer: backupReviewer || null,
                checklist: checklistText
                    .split('\n')
                    .map(s => s.trim())
                    .filter(Boolean),
                updateScope
            };

            await apiFetch('/api/ritus/templates', {
                method: isEdit ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });
            await onSaved();
        } catch (err) {
            setError(err.message || 'Şablon kaydedilirken hata oluştu.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatRoleLabel = role =>
        role === 'vet' ? 'Vet. Hekim' : role === 'technician' ? 'Tekniker' : 'Bakıcı';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="shrink-0 px-5 py-3.5 bg-gradient-to-r from-indigo-700 to-violet-700 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-sm sm:text-base font-bold">
                            {isEdit ? 'Ritus Rutin Şablonunu Düzenle' : 'Yeni Ritus Rutin Şablonu Oluştur'}
                        </h3>
                        <p className="text-[11px] text-indigo-100">
                            Sorumlu Veteriner Hekim Yetkisi • Haftalık, Aylık ve 3 Aylık Periyodik Planlayıcı
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

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Rutin Görev Başlığı *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Örn: Fare Odaları Kafes & Altlık Değişimi"
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Kategori
                                </label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                                >
                                    {Object.entries(RITUS_CATEGORIES).map(([k, v]) => (
                                        <option key={k} value={k}>
                                            {v.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Rutin Açıklaması / SOP Özeti (Opsiyonel)
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Örn: Tüm IVC kafeslerin altlık, yem ve suluk kontrollerinin yapılarak kayıt altına alınması."
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tekrar Periyodu *
                                </label>
                                <select
                                    value={frequency}
                                    onChange={e => setFrequency(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                                >
                                    <option value="weekly">Haftalık</option>
                                    <option value="monthly">Aylık (Hafta Ortası Dahil)</option>
                                    <option value="quarterly">3 Aylık (Çeyreklik)</option>
                                </select>
                            </div>

                            {frequency === 'weekly' ? (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Haftanın Günleri *
                                    </label>
                                    <div className="flex flex-wrap gap-1">
                                        {DAYS_OF_WEEK.map(d => (
                                            <button
                                                key={d.value}
                                                type="button"
                                                onClick={() => toggleDay(d.value)}
                                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                                                    daysOfWeek.includes(d.value)
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-white text-slate-600 border-slate-300'
                                                }`}
                                            >
                                                {d.short}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Ayın Günü (1-31) *
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={dayOfMonth}
                                        onChange={e => setDayOfMonth(e.target.value)}
                                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Sabit Görev Saati *
                                </label>
                                <input
                                    type="time"
                                    required
                                    value={scheduledTime}
                                    onChange={e => setScheduledTime(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                                />
                            </div>
                        </div>

                        {/* Primary & Backup Assignee + Reviewer Chain (Aligned 2x2 Grid) */}
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1 truncate">
                                    1. Asil Görevli Personel *
                                </label>
                                <select
                                    value={primaryAssignee}
                                    onChange={e => setPrimaryAssignee(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                >
                                    {members.map(m => (
                                        <option key={m.email} value={m.email}>
                                            {m.name} ({formatRoleLabel(m.pulsusRole)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1 truncate">
                                    3. Asil Denetçi (Kontrol Eden) *
                                </label>
                                <select
                                    value={primaryReviewer}
                                    onChange={e => setPrimaryReviewer(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                >
                                    {members
                                        .filter(m => m.pulsusRole !== 'caretaker')
                                        .map(m => (
                                            <option key={m.email} value={m.email}>
                                                {m.name} ({formatRoleLabel(m.pulsusRole)})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1 truncate">
                                    2. Yedek Görevli
                                </label>
                                <select
                                    value={backupAssignee || ''}
                                    onChange={e => setBackupAssignee(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                >
                                    <option value="">Yedek Yok (Vet. Hekime Düşsün)</option>
                                    {members.map(m => (
                                        <option key={m.email} value={m.email}>
                                            {m.name} ({formatRoleLabel(m.pulsusRole)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1 truncate">
                                    4. Yedek Denetçi
                                </label>
                                <select
                                    value={backupReviewer || ''}
                                    onChange={e => setBackupReviewer(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                                >
                                    <option value="">Yedek Yok (Vet. Hekime Düşsün)</option>
                                    {members
                                        .filter(m => m.pulsusRole !== 'caretaker')
                                        .map(m => (
                                            <option key={m.email} value={m.email}>
                                                {m.name} ({formatRoleLabel(m.pulsusRole)})
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Alt Kontrol Listesi (Her satıra 1 adım)
                            </label>
                            <textarea
                                rows={2}
                                value={checklistText}
                                onChange={e => setChecklistText(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
                            />
                        </div>

                        {error && (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                            <span className="px-2 text-[11px] font-bold text-slate-500">
                                Uygula:
                            </span>
                            <button
                                type="button"
                                onClick={() => setUpdateScope('current_week')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                    updateScope === 'current_week'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Bu Hafta
                            </button>
                            <button
                                type="button"
                                onClick={() => setUpdateScope('next_week')}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                    updateScope === 'next_week'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Gelecek Hafta
                            </button>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
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
                                {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
