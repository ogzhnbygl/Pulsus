import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    RotateCcw,
    Stethoscope,
    UserCheck,
    Plus,
    ArrowRight,
    ShieldAlert,
    Palmtree,
    CalendarClock,
    Zap,
    RefreshCw,
    Link2,
    CheckSquare,
    Square
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    apiFetch,
    DEFAULT_STAFF_DIRECTORY,
    RITUS_CATEGORIES,
    RITUS_FREQUENCIES,
    SEQUA_PRIORITIES,
    SEQUA_TASK_TYPES,
    formatScheduledBadge,
    getMemberName
} from '../utils/pulsusHelpers';
import {
    CreateSequaModal,
    RitusActionModal,
    ConvertIssueModal
} from '../components/TaskModals';

export default function PulseDashboard() {
    const { user, isVet, isTechnician, isCaretaker } = useAuth();
    const [ritusData, setRitusData] = useState({ runs: [], currentWeekStart: '', nextWeekStart: '', nextWeekDistributed: false });
    const [sequaTasks, setSequaTasks] = useState([]);
    const [members, setMembers] = useState(DEFAULT_STAFF_DIRECTORY);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modals
    const [sequaModalOpen, setSequaModalOpen] = useState(false);
    const [sequaModalInitialType, setSequaModalInitialType] = useState(null);
    const [sourceRitusForSequa, setSourceRitusForSequa] = useState(null);
    const [actionModal, setActionModal] = useState({ open: false, run: null, actionType: null });
    const [convertModal, setConvertModal] = useState({ open: false, task: null });

    const loadAll = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        try {
            const [ritusRes, sequaRes, membersRes] = await Promise.all([
                apiFetch('/api/ritus/runs?week=current'),
                apiFetch('/api/sequa/tasks'),
                apiFetch('/api/members').catch(() => ({ members: DEFAULT_STAFF_DIRECTORY }))
            ]);
            setRitusData(ritusRes);
            setSequaTasks(sequaRes.tasks || []);
            if (membersRes?.members?.length) {
                setMembers(membersRes.members);
            }
        } catch (err) {
            console.error('Nabız verileri yüklenemedi:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const handleRitusQuickAction = async (runId, action, extra = {}) => {
        try {
            await apiFetch('/api/ritus/runs', {
                method: 'PATCH',
                body: JSON.stringify({ id: String(runId), action, ...extra })
            });
            await loadAll(true);
        } catch (err) {
            alert(err.message || 'Ritus işlemi başarısız oldu.');
        }
    };

    const handleSequaQuickAction = async (taskId, action, extra = {}) => {
        try {
            await apiFetch('/api/sequa/tasks', {
                method: 'PATCH',
                body: JSON.stringify({ id: String(taskId), action, ...extra })
            });
            await loadAll(true);
        } catch (err) {
            alert(err.message || 'Sequa işlemi başarısız oldu.');
        }
    };

    const handleCreateSequa = async payload => {
        await apiFetch('/api/sequa/tasks', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        await loadAll(true);
    };

    const myEmail = String(user?.email || '').toLowerCase();
    const runs = ritusData.runs || [];

    // Role-focused queues
    const myRitusRuns = runs.filter(
        r => String(r.effectiveAssignee || '').toLowerCase() === myEmail && r.status !== 'done'
    );
    const mySequaTasks = sequaTasks.filter(
        t => String(t.assignedTo || '').toLowerCase() === myEmail && t.status !== 'done'
    );

    // Vet specific queues
    const vetFallbackRuns = runs.filter(r => r.vetFallback && r.status !== 'done');
    const escalatedRuns = runs.filter(r => r.status === 'escalated');
    const vetRequests = sequaTasks.filter(
        t => (t.taskType === 'vet_request' || t.taskType === 'issue_report') && t.status !== 'done'
    );

    // Reviewer (Technician & Vet) pending review queue
    const pendingMyReviewRuns = runs.filter(
        r =>
            r.status === 'pending_review' &&
            (isVet || String(r.effectiveReviewer || '').toLowerCase() === myEmail)
    );

    // Caretaker / Staff repeated (needs_revision) tasks
    const myRepeatedRuns = runs.filter(
        r =>
            r.status === 'needs_revision' &&
            (String(r.effectiveAssignee || '').toLowerCase() === myEmail || isVet)
    );

    const onLeaveMembers = members.filter(m => m.onLeaveToday);

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-slate-500 text-sm">
                Operasyon nabzı senkronize ediliyor...
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
            {/* Compact Quick Action Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={() => loadAll(true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    Yenile
                </button>

                {isCaretaker ? (
                    <button
                        type="button"
                        onClick={() => {
                            setSourceRitusForSequa(null);
                            setSequaModalInitialType('issue_report');
                            setSequaModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-xs"
                    >
                        <AlertTriangle size={15} />
                        ⚠️ Problem / Arıza Bildir
                    </button>
                ) : (
                    <>
                        {isTechnician && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSourceRitusForSequa(null);
                                    setSequaModalInitialType('vet_request');
                                    setSequaModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200"
                            >
                                <Stethoscope size={15} />
                                🩺 Hekime Muayene Talebi Aç
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setSourceRitusForSequa(null);
                                setSequaModalInitialType('task');
                                setSequaModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 shadow-xs"
                        >
                            <Plus size={15} />
                            Yeni Sequa Görevi / Kaydı
                        </button>
                    </>
                )}
            </div>

            {/* Circa Active Leave Banner if any staff is on leave today */}
            {onLeaveMembers.length > 0 && (
                <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                            <Palmtree size={18} />
                        </div>
                        <div className="text-xs">
                            <div className="font-bold text-amber-950">
                                Circa Canlı İzin &amp; Yedek Devir Bildirimi
                            </div>
                            <p className="text-amber-800 mt-0.5">
                                Bugün Circa üzerinde onaylı izinde olan personel:{' '}
                                {onLeaveMembers.map(m => (
                                    <span key={m.email} className="font-bold underline mr-2">
                                        {m.name} (Yedeği: {getMemberName(m.defaultBackupEmail, members)})
                                    </span>
                                ))}
                            </p>
                        </div>
                    </div>
                    {isVet && (
                        <Link
                            to="/reports"
                            className="text-xs font-bold text-amber-900 hover:underline inline-flex items-center gap-1 shrink-0"
                        >
                            İzin &amp; Devir Detayları <ArrowRight size={13} />
                        </Link>
                    )}
                </div>
            )}

            {/* ROLE-SPECIFIC PRIORITY ALERTS */}
            {/* 1. VET: Vet Fallback (Unbacked Leave Tasks) + Escalated + Vet Requests */}
            {isVet && (vetFallbackRuns.length > 0 || escalatedRuns.length > 0 || vetRequests.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Vet Fallback Card */}
                    <div className="bg-white rounded-2xl border-2 border-amber-300 p-4 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                                    <Palmtree size={15} className="text-amber-600" />
                                    Yedeksiz / İzin Devriyle Hekime Düşenler
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900">
                                    {vetFallbackRuns.length}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3">
                                Asil görevlisi Circa&apos;da izinli olup yedeği bulunmayan veya yedeği de izinli olan rutinler:
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {vetFallbackRuns.length === 0 ? (
                                    <div className="text-xs text-slate-400 py-2">
                                        Yedeksiz devredilen görev bulunmuyor.
                                    </div>
                                ) : (
                                    vetFallbackRuns.map(run => (
                                        <div
                                            key={run._id}
                                            className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1.5"
                                        >
                                            <div className="font-bold text-slate-800">{run.title}</div>
                                            <div className="text-[11px] text-amber-800">
                                                Asil: {getMemberName(run.primaryAssignee, members)} •{' '}
                                                {formatScheduledBadge(run.scheduledDate, run.scheduledTime)}
                                            </div>
                                            <div className="flex items-center gap-1.5 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setActionModal({
                                                            open: true,
                                                            run,
                                                            actionType: 'vet_reassign'
                                                        })
                                                    }
                                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700"
                                                >
                                                    Personele Yönlendir
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRitusQuickAction(run._id, 'approve', {
                                                            note: 'Veteriner Hekim tarafından doğrudan tamamlandı.'
                                                        })
                                                    }
                                                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold text-[11px] hover:bg-amber-100"
                                                >
                                                    Kendim Tamamla
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Escalated Ritus Runs */}
                    <div className="bg-white rounded-2xl border-2 border-rose-300 p-4 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-900">
                                    <ShieldAlert size={15} className="text-rose-600" />
                                    Teknikerden Hekime Eskale Edilenler
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-900">
                                    {escalatedRuns.length}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3">
                                Denetim sırasında eksik/kritik bulunarak tarafınıza bildirilen rutinler:
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {escalatedRuns.length === 0 ? (
                                    <div className="text-xs text-slate-400 py-2">
                                        Eskale edilen rutin görev bulunmuyor.
                                    </div>
                                ) : (
                                    escalatedRuns.map(run => (
                                        <div
                                            key={run._id}
                                            className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs space-y-1.5"
                                        >
                                            <div className="font-bold text-slate-800">{run.title}</div>
                                            {run.escalationNote && (
                                                <div className="text-[11px] text-rose-800 bg-white/80 p-1.5 rounded border border-rose-200">
                                                    <strong>Not:</strong> {run.escalationNote}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setActionModal({
                                                            open: true,
                                                            run,
                                                            actionType: 'request_revision'
                                                        })
                                                    }
                                                    className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-[11px]"
                                                >
                                                    🔄 Tekrarlat
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRitusQuickAction(run._id, 'approve', {
                                                            note: 'Hekim kontrolüyle kapatıldı.'
                                                        })
                                                    }
                                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]"
                                                >
                                                    ✓ Onayla &amp; Kapat
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Vet Requests & Reported Issues */}
                    <div className="bg-white rounded-2xl border-2 border-indigo-300 p-4 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-900">
                                    <Stethoscope size={15} className="text-indigo-600" />
                                    Hekim Muayene Talebi &amp; Bildirimler
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-900">
                                    {vetRequests.length}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3">
                                Tekniker muayene çağrıları (&quot;Hocam bakar mısınız?&quot;) ve bakıcı arıza bildirimleri:
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {vetRequests.length === 0 ? (
                                    <div className="text-xs text-slate-400 py-2">
                                        Bekleyen muayene talebi veya bildirim yok.
                                    </div>
                                ) : (
                                    vetRequests.map(task => (
                                        <div
                                            key={task._id}
                                            className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200 text-xs space-y-1.5"
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-bold text-slate-800">{task.title}</span>
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-indigo-700">
                                                    {task.taskType === 'vet_request' ? 'Muayene' : 'Bildirim'}
                                                </span>
                                            </div>
                                            {task.description && (
                                                <p className="text-[11px] text-slate-600 line-clamp-2">
                                                    {task.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-1.5 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setConvertModal({ open: true, task })
                                                    }
                                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px]"
                                                >
                                                    Göreve / Dış Birime Dönüştür
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSequaQuickAction(task._id, 'approve', {
                                                            note: 'Veteriner Hekim tarafından incelendi ve çözüldü.'
                                                        })
                                                    }
                                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]"
                                                >
                                                    ✓ Çözüldü
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. REVIEWER (Technician / Vet): Pending Review Queue */}
            {(isTechnician || isVet) && pendingMyReviewRuns.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-indigo-200 p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                                <UserCheck size={18} />
                            </span>
                            <div>
                                <h2 className="text-sm font-extrabold text-slate-900">
                                    Denetiminizi Bekleyen Ritus Görevleri ({pendingMyReviewRuns.length})
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Bakıcı veya tekniker tarafından tamamlanıp kontrolünüze gönderilen işler. Eksikse tekrarlatabilir veya hekime bildirebilirsiniz.
                                </p>
                            </div>
                        </div>
                        <Link
                            to="/ritus"
                            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                            Tüm Ritus Panosu <ArrowRight size={14} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pendingMyReviewRuns.map(run => (
                            <div
                                key={run._id}
                                className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-200 flex flex-col justify-between gap-3"
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-indigo-700 mb-1">
                                        <span>{formatScheduledBadge(run.scheduledDate, run.scheduledTime)}</span>
                                        <span>Yapan: {getMemberName(run.effectiveAssignee, members)}</span>
                                    </div>
                                    <div className="text-sm font-bold text-slate-900">{run.title}</div>
                                    {run.checklist?.length > 0 && (
                                        <div className="text-[11px] text-slate-600 mt-1">
                                            Kontrol Listesi:{' '}
                                            {run.checklist.filter(c => c.done).length}/{run.checklist.length} adım tamamlandı
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-indigo-100">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleRitusQuickAction(run._id, 'approve', {
                                                note: 'Denetimden geçti, onaylandı.'
                                            })
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                    >
                                        ✅ Onayla
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setActionModal({
                                                open: true,
                                                run,
                                                actionType: 'request_revision'
                                            })
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                                    >
                                        🔄 Tekrarlat
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setActionModal({
                                                open: true,
                                                run,
                                                actionType: 'escalate_to_vet'
                                            })
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                                    >
                                        ⚠️ Hekime Bildir
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. REPEATED (NEEDS REVISION) CALLOUT FOR ASSIGNEE */}
            {myRepeatedRuns.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                        <RotateCcw size={18} className="text-amber-700" />
                        🔄 Denetçi Tarafından Tekrarlatılan (Revizyon Bekleyen) Görevleriniz ({myRepeatedRuns.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {myRepeatedRuns.map(run => (
                            <div
                                key={run._id}
                                className="bg-white rounded-xl p-3.5 border border-amber-300 flex flex-col justify-between gap-2"
                            >
                                <div>
                                    <div className="flex items-center justify-between text-xs font-bold text-amber-800">
                                        <span>{run.title}</span>
                                        <span>{run.revisionCount}. Kez Tekrarlatıldı</span>
                                    </div>
                                    {run.lastRevisionNote && (
                                        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 mt-1.5">
                                            <strong>Denetçi Notu:</strong> {run.lastRevisionNote}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleRitusQuickAction(run._id, 'submit_for_review', {
                                                note: 'Eksiklikler giderilerek tekrar kontrole gönderildi.'
                                            })
                                        }
                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                                    >
                                        Eksikleri Giderdim &amp; Tekrar Kontrole Gönder
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* UNIFIED DUAL-ENGINE PERSONAL KANBAN: Ritus (Left) + Sequa (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Active Ritus Tasks */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                <CalendarClock size={18} />
                            </span>
                            <div>
                                <h2 className="text-sm font-extrabold text-slate-900">
                                    {isCaretaker
                                        ? `Rutin Görevlerim (${myRitusRuns.length})`
                                        : `Ritus — Rutin Görevlerim (${myRitusRuns.length})`}
                                </h2>
                                <p className="text-[11px] text-slate-500">
                                    Üzerinize atanan veya yedek olarak devraldığınız periyodik işler
                                </p>
                            </div>
                        </div>
                        {!isCaretaker && (
                            <Link
                                to="/ritus"
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                            >
                                Ritus Panosu <ArrowRight size={13} />
                            </Link>
                        )}
                    </div>

                    <div className="p-4 space-y-3 flex-1">
                        {myRitusRuns.length === 0 ? (
                            <div className="py-10 text-center text-xs text-slate-400">
                                Bu hafta için bekleyen rutin göreviniz bulunmuyor.
                            </div>
                        ) : (
                            myRitusRuns.map(run => {
                                const cat = RITUS_CATEGORIES[run.category] || RITUS_CATEGORIES.other;
                                const freq = RITUS_FREQUENCIES[run.frequency] || RITUS_FREQUENCIES.weekly;
                                return (
                                    <div
                                        key={run._id}
                                        className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all bg-slate-50/50 space-y-2.5 border-l-4 border-l-indigo-600"
                                    >
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {!isCaretaker && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-600 text-white">
                                                        RITUS
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${freq.badge}`}>
                                                    {freq.label}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cat.color}`}>
                                                    {cat.label}
                                                </span>
                                            </div>
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                                                <Clock size={12} className="text-indigo-600" />
                                                {formatScheduledBadge(run.scheduledDate, run.scheduledTime)}
                                            </span>
                                        </div>

                                        <div className="text-sm font-bold text-slate-900">{run.title}</div>
                                        {run.description && (
                                            <p className="text-xs text-slate-600">{run.description}</p>
                                        )}

                                        {/* Interactive Checklist directly on Pulsus Dashboard */}
                                        {run.checklist?.length > 0 && (
                                            <div className="space-y-1.5 pt-1.5 border-t border-slate-200/70">
                                                {run.checklist.map((item, idx) => (
                                                    <button
                                                        key={item.id ?? idx}
                                                        type="button"
                                                        onClick={() =>
                                                            handleRitusQuickAction(
                                                                run._id,
                                                                'toggle_checklist',
                                                                { checklistItemId: item.id ?? idx }
                                                            )
                                                        }
                                                        className="w-full flex items-start gap-2 text-left text-xs text-slate-700 hover:text-indigo-700 py-0.5"
                                                    >
                                                        {item.done ? (
                                                            <CheckSquare
                                                                size={14}
                                                                className="text-emerald-600 shrink-0 mt-0.5"
                                                            />
                                                        ) : (
                                                            <Square
                                                                size={14}
                                                                className="text-slate-400 shrink-0 mt-0.5"
                                                            />
                                                        )}
                                                        <span
                                                            className={
                                                                item.done
                                                                    ? 'line-through text-slate-400'
                                                                    : 'font-medium'
                                                            }
                                                        >
                                                            {item.text}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Backup / Leave Delegation Badge */}
                                        {run.assignmentStatus === 'backup' && (
                                            <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
                                                🏖️ İzin Devri: {getMemberName(run.delegatedFrom, members)} izinli olduğu için yedek olarak size devredildi.
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                                            <span>
                                                Denetçi:{' '}
                                                <strong className="text-slate-700">
                                                    {getMemberName(run.effectiveReviewer, members)}
                                                </strong>
                                            </span>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSourceRitusForSequa(run);
                                                        setSequaModalInitialType(
                                                            isCaretaker ? 'issue_report' : 'vet_request'
                                                        );
                                                        setSequaModalOpen(true);
                                                    }}
                                                    className="px-2 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1"
                                                    title="Bu rutinde karşılaşılan sorunu bildir"
                                                >
                                                    <Link2 size={12} />
                                                    {isCaretaker ? 'Sorun Bildir' : 'Sorun / Sequa Aç'}
                                                </button>

                                                {run.status === 'todo' && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleRitusQuickAction(run._id, 'start')
                                                        }
                                                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                                    >
                                                        Başlat
                                                    </button>
                                                )}

                                                {(run.status === 'todo' ||
                                                    run.status === 'in_progress' ||
                                                    run.status === 'needs_revision') && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleRitusQuickAction(
                                                                run._id,
                                                                'submit_for_review'
                                                            )
                                                        }
                                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1"
                                                    >
                                                        <CheckCircle2 size={12} />
                                                        Kontrole Gönder
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Column: Active Sequa Tasks */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                                <Zap size={18} />
                            </span>
                            <div>
                                <h2 className="text-sm font-extrabold text-slate-900">
                                    {isCaretaker
                                        ? `Atanan Ek Görevlerim (${mySequaTasks.length})`
                                        : `Sequa — Kişi Bazlı Görev & Taleplerim (${mySequaTasks.length})`}
                                </h2>
                                <p className="text-[11px] text-slate-500">
                                    Rutin dışı atanan görevler ve arıza bildirimleri
                                </p>
                            </div>
                        </div>
                        {!isCaretaker && (
                            <Link
                                to="/sequa"
                                className="text-xs font-bold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1"
                            >
                                Sequa Panosu <ArrowRight size={13} />
                            </Link>
                        )}
                    </div>

                    <div className="p-4 space-y-3 flex-1">
                        {mySequaTasks.length === 0 ? (
                            <div className="py-10 text-center text-xs text-slate-400">
                                Üzerinize atanmış açık bir ek görev bulunmuyor.
                            </div>
                        ) : (
                            mySequaTasks.map(task => {
                                const prio =
                                    SEQUA_PRIORITIES[task.priority] || SEQUA_PRIORITIES.medium;
                                const tType =
                                    SEQUA_TASK_TYPES[task.taskType] || SEQUA_TASK_TYPES.task;
                                return (
                                    <div
                                        key={task._id}
                                        className="p-4 rounded-xl border border-slate-200 hover:border-rose-300 transition-all bg-slate-50/50 space-y-2.5 border-l-4 border-l-rose-600"
                                    >
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {!isCaretaker && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-600 text-white">
                                                        SEQUA
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${tType.badge}`}>
                                                    {tType.shortLabel}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] border ${prio.badge}`}>
                                                    {prio.label}
                                                </span>
                                            </div>
                                            {task.dueDate && (
                                                <span className="text-[11px] font-semibold text-slate-600">
                                                    Termin: {task.dueDate}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-sm font-bold text-slate-900">
                                            {task.title}
                                        </div>
                                        {task.description && (
                                            <p className="text-xs text-slate-600">{task.description}</p>
                                        )}

                                        {task.externalUnit && (
                                            <div className="px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-[11px] font-semibold text-purple-900">
                                                🏛️ Dış Birim: {task.externalUnit}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                                            <span>
                                                Oluşturan:{' '}
                                                <strong className="text-slate-700">
                                                    {task.createdByName ||
                                                        getMemberName(task.createdBy, members)}
                                                </strong>
                                            </span>

                                            <div className="flex items-center gap-1.5">
                                                {task.status === 'reported' && !isCaretaker && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConvertModal({ open: true, task })
                                                        }
                                                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold"
                                                    >
                                                        Göreve Dönüştür
                                                    </button>
                                                )}
                                                {task.status === 'todo' && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleSequaQuickAction(
                                                                task._id,
                                                                'move_status',
                                                                { status: 'in_progress' }
                                                            )
                                                        }
                                                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold"
                                                    >
                                                        İşleme Al
                                                    </button>
                                                )}
                                                {task.status === 'in_progress' && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleSequaQuickAction(
                                                                task._id,
                                                                'move_status',
                                                                { status: 'review' }
                                                            )
                                                        }
                                                        className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold"
                                                    >
                                                        Kontrole Gönder
                                                    </button>
                                                )}
                                                {(task.status === 'review' || isVet) && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleSequaQuickAction(
                                                                task._id,
                                                                'approve'
                                                            )
                                                        }
                                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                                                    >
                                                        ✓ Tamamla
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <CreateSequaModal
                isOpen={sequaModalOpen}
                onClose={() => setSequaModalOpen(false)}
                onSubmit={handleCreateSequa}
                user={user}
                members={members}
                sourceRitusRun={sourceRitusForSequa}
                initialTaskType={sequaModalInitialType}
            />

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
                    await loadAll(true);
                }}
            />

            <ConvertIssueModal
                isOpen={convertModal.open}
                onClose={() => setConvertModal({ open: false, task: null })}
                task={convertModal.task}
                members={members}
                onSubmit={async payload => {
                    await apiFetch('/api/sequa/tasks', {
                        method: 'PATCH',
                        body: JSON.stringify(payload)
                    });
                    await loadAll(true);
                }}
            />
        </div>
    );
}
