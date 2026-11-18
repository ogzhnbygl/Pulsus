import React, { useState, useEffect, useCallback } from 'react';
import {
    Zap,
    Plus,
    Stethoscope,
    AlertTriangle,
    Building2,
    CheckCircle2,
    RotateCcw,
    SlidersHorizontal,
    Link2,
    Trash2,
    Edit3,
    AlertCircle,
    Clock,
    ChevronRight,
    ListTodo,
    X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    apiFetch,
    DEFAULT_STAFF_DIRECTORY,
    SEQUA_PRIORITIES,
    SEQUA_TASK_TYPES,
    formatSequaDateTimeBadge,
    getMemberName,
    VET_EMAIL
} from '../utils/pulsusHelpers';
import {
    CreateSequaModal,
    ConvertIssueModal,
    SequaRevisionModal,
    CompletedTaskDetailModal,
    PlannedTaskDetailModal
} from '../components/TaskModals';
import ConfirmModal from '../components/ConfirmModal';

export default function SequaBoard() {
    const { user, isVet, isTechnician, isCaretaker } = useAuth();
    const userEmail = (user?.email || '').trim().toLowerCase();
    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState(DEFAULT_STAFF_DIRECTORY);
    const [loading, setLoading] = useState(true);

    // Filters: non-vet staff default to 'mine' (person-specific queue)
    const [filterScope, setFilterScope] = useState(isVet ? 'all' : 'mine');
    const [filterType, setFilterType] = useState('ALL');
    const [filterAssignee, setFilterAssignee] = useState('ALL');

    // Modals
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [initialModalType, setInitialModalType] = useState(null);
    const [convertModal, setConvertModal] = useState({ open: false, task: null });
    const [revisionModal, setRevisionModal] = useState({ open: false, task: null });
    const [completedDetailTask, setCompletedDetailTask] = useState(null);
    const [todoDetailTask, setTodoDetailTask] = useState(null);
    const [notification, setNotification] = useState(null);
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '',
        variant: 'danger',
        hideCancel: false,
        isLoading: false,
        onConfirm: null
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [tasksRes, memRes] = await Promise.all([
                apiFetch('/api/sequa/tasks'),
                apiFetch('/api/members').catch(() => ({ members: DEFAULT_STAFF_DIRECTORY }))
            ]);
            setTasks(tasksRes.tasks || []);
            if (memRes?.members?.length) {
                setMembers(memRes.members);
            }
        } catch (err) {
            console.error('Sequa verileri yüklenemedi:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handlePatchTask = async (taskId, action, extra = {}) => {
        try {
            const res = await apiFetch('/api/sequa/tasks', {
                method: 'PATCH',
                body: JSON.stringify({ id: String(taskId), action, ...extra })
            });
            if (res?.task) {
                setTasks(prev =>
                    prev.map(t => (String(t._id) === String(taskId) ? res.task : t))
                );
            }
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'İşlem başarısız oldu.' });
            setTimeout(() => setNotification(null), 5000);
        }
    };

    const handleDeleteTask = taskId => {
        setConfirmModal({
            isOpen: true,
            title: 'Sequa Görev Kaydını Sil',
            message: 'Bu Sequa görev kaydını silmek istediğinize emin misiniz?',
            confirmText: 'Evet, Görevi Sil',
            variant: 'danger',
            hideCancel: false,
            isLoading: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isLoading: true }));
                try {
                    await apiFetch(`/api/sequa/tasks?id=${taskId}`, { method: 'DELETE' });
                    setTasks(prev => prev.filter(t => String(t._id) !== String(taskId)));
                    setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
                } catch (err) {
                    setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
                    setNotification({ type: 'error', message: err.message || 'Görev silinemedi.' });
                    setTimeout(() => setNotification(null), 5000);
                }
            }
        });
    };

    const myTasksCount = tasks.filter(t => {
        const isTaskForVet =
            t.taskType === 'vet_request' ||
            String(t.assignedTo || '').toLowerCase() === VET_EMAIL.toLowerCase();

        const isAssigned = String(t.assignedTo || '').toLowerCase() === userEmail;
        const isReviewer = String(t.reviewerEmail || '').toLowerCase() === userEmail;
        const isCreator =
            String(t.createdBy || '').toLowerCase() === userEmail ||
            String(t.convertedBy || '').toLowerCase() === userEmail;

        if (isVet) {
            return isAssigned || isReviewer || isCreator || isTaskForVet || t.status === 'reported';
        }
        const isTechReported =
            isTechnician &&
            t.status === 'reported' &&
            (!t.assignedTo || String(t.assignedTo).toLowerCase() === userEmail);
        return isAssigned || isReviewer || isCreator || isTechReported;
    }).length;

    const vetTasksCount = tasks.filter(
        t =>
            t.taskType === 'vet_request' ||
            String(t.assignedTo || '').toLowerCase() === VET_EMAIL.toLowerCase()
    ).length;

    const filteredTasks = tasks.filter(t => {
        const isTaskForVet =
            t.taskType === 'vet_request' ||
            String(t.assignedTo || '').toLowerCase() === VET_EMAIL.toLowerCase();

        if (filterScope === 'mine') {
            const isAssigned = String(t.assignedTo || '').toLowerCase() === userEmail;
            const isReviewer = String(t.reviewerEmail || '').toLowerCase() === userEmail;
            const isCreator =
                String(t.createdBy || '').toLowerCase() === userEmail ||
                String(t.convertedBy || '').toLowerCase() === userEmail;

            if (isVet) {
                if (!isAssigned && !isReviewer && !isCreator && !isTaskForVet && t.status !== 'reported') {
                    return false;
                }
            } else {
                const isTechReported =
                    isTechnician &&
                    t.status === 'reported' &&
                    (!t.assignedTo || String(t.assignedTo).toLowerCase() === userEmail);
                if (!isAssigned && !isReviewer && !isCreator && !isTechReported) return false;
            }
        } else if (filterScope === 'vet_requests') {
            if (!isTaskForVet) return false;
        }

        if (filterType !== 'ALL' && t.taskType !== filterType) return false;
        if (
            filterAssignee !== 'ALL' &&
            String(t.assignedTo || '').toLowerCase() !== filterAssignee.toLowerCase()
        ) {
            return false;
        }
        return true;
    });

    const columns = [
        {
            key: 'reported',
            title: 'Gelen Bildirim & Talepler',
            headerClass: 'bg-amber-50 text-amber-900 border-amber-200',
            items: filteredTasks.filter(t => t.status === 'reported')
        },
        {
            key: 'todo',
            title: 'Yapılacak / Atandı',
            headerClass: 'bg-slate-100 text-slate-800 border-slate-200',
            items: filteredTasks.filter(t => t.status === 'todo')
        },
        {
            key: 'in_progress',
            title: 'İşlemde / Dış Birimde',
            headerClass: 'bg-indigo-50 text-indigo-900 border-indigo-200',
            items: filteredTasks.filter(t => t.status === 'in_progress')
        },
        {
            key: 'review',
            title: 'Kontrolde (Onay Bekleyen)',
            headerClass: 'bg-rose-50 text-rose-900 border-rose-200',
            items: filteredTasks.filter(t => t.status === 'review')
        },
        {
            key: 'done',
            title: 'Çözüldü / Tamamlandı',
            headerClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
            items: filteredTasks.filter(t => t.status === 'done')
        }
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
            {notification && (
                <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in ${
                        notification.type === 'error'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                    role="alert"
                >
                    <div className="flex items-center gap-2.5">
                        <AlertCircle size={18} className="shrink-0 text-rose-600" />
                        <span className="text-sm font-semibold">{notification.message}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setNotification(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-black/5"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-rose-600 text-white">
                            SEQUA MOTORU
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                            Kişi Bazlı Görevler, Yukarı Yönlü Bildirimler &amp; Üniversite Dış Birim Takibi
                        </span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
                        Rutin Olmayan İşler, Hekim Muayene Talepleri ve Arıza Yönetimi
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {isCaretaker ? (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingTask(null);
                                setInitialModalType('issue_report');
                                setCreateModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700"
                        >
                            <AlertTriangle size={15} />
                            ⚠️ Problem / Arıza Bildir
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingTask(null);
                                setInitialModalType('task');
                                setCreateModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700"
                        >
                            <Plus size={15} />
                            Yeni Sequa Görevi / Kaydı
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                {/* Scope Selection Tabs */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                    <button
                        type="button"
                        onClick={() => setFilterScope('mine')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            filterScope === 'mine'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <span>📌 Bana Atanan Görevler</span>
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                filterScope === 'mine'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-700'
                            }`}
                        >
                            {myTasksCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setFilterScope('all')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            filterScope === 'all'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <span>🌐 Tüm Laboratuvar Panosu</span>
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                filterScope === 'all'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-700'
                            }`}
                        >
                            {tasks.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setFilterScope('vet_requests')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                            filterScope === 'vet_requests'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <span>🩺 Hekim Muayene &amp; Sevkler</span>
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                filterScope === 'vet_requests'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-700'
                            }`}
                        >
                            {vetTasksCount}
                        </span>
                    </button>
                </div>

                {/* Sub-Filters: Type and Assignee */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {[
                            { key: 'ALL', label: 'Tümü' },
                            { key: 'task', label: '📋 Personel Görevleri' },
                            { key: 'vet_request', label: '🩺 Hekim Muayene Talepleri' },
                            { key: 'issue_report', label: '⚠️ Problem Bildirimleri' },
                            { key: 'external', label: '🏛️ Üniversite / Dış Birim' }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setFilterType(tab.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                    filterType === tab.key
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <SlidersHorizontal size={14} className="text-slate-400" />
                        <select
                            value={filterAssignee}
                            onChange={e => setFilterAssignee(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50"
                        >
                            <option value="ALL">Tüm Sorumlular</option>
                            {members.map(m => (
                                <option key={m.email} value={m.email}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 5-Column Sequa Kanban */}
            {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                    Sequa görev kartları yükleniyor...
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

                            <div className={(col.key === 'done' || col.key === 'todo') ? 'space-y-2 max-h-[540px] overflow-y-auto pr-1' : 'space-y-3'}>
                                {col.items.length === 0 ? (
                                    <div className="py-8 text-center text-[11px] text-slate-400">
                                        Kart bulunmuyor
                                    </div>
                                ) : col.key === 'done' ? (
                                    /* Item 7: Compact name-only view for completed/approved tasks */
                                    col.items.map(task => (
                                        <button
                                            key={task._id}
                                            type="button"
                                            onClick={() => setCompletedDetailTask(task)}
                                            className="w-full text-left bg-white hover:bg-emerald-50/70 rounded-xl px-3 py-2.5 border border-emerald-200/80 hover:border-emerald-400 shadow-2xs transition-all flex items-center justify-between gap-2 group cursor-pointer"
                                            title="Detayları görüntülemek için tıklayın"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <CheckCircle2
                                                    size={14}
                                                    className="text-emerald-600 shrink-0"
                                                />
                                                <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-950 truncate">
                                                    {task.title}
                                                </span>
                                            </div>
                                            <ChevronRight
                                                size={14}
                                                className="text-slate-400 group-hover:text-emerald-700 shrink-0"
                                            />
                                        </button>
                                    ))
                                ) : col.key === 'todo' ? (
                                    /* Compact stack view for pending/todo Sequa tasks */
                                    col.items.map(task => {
                                        const prio =
                                            SEQUA_PRIORITIES[task.priority] ||
                                            SEQUA_PRIORITIES.medium;
                                        return (
                                            <button
                                                key={task._id}
                                                type="button"
                                                onClick={() => setTodoDetailTask(task)}
                                                className="w-full text-left bg-white hover:bg-indigo-50/70 rounded-xl px-3 py-2.5 border border-slate-200/90 hover:border-indigo-400 shadow-2xs transition-all flex items-center justify-between gap-2 group cursor-pointer"
                                                title="Görevi incelemek ve başlatmak için tıklayın"
                                            >
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <ListTodo
                                                        size={14}
                                                        className="text-indigo-500 shrink-0"
                                                    />
                                                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-950 truncate">
                                                        {task.title}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {task.dueDate && (
                                                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                            {task.dueDate.slice(5)}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`w-2 h-2 rounded-full ${
                                                            task.priority === 'urgent'
                                                                ? 'bg-rose-500'
                                                                : task.priority === 'high'
                                                                  ? 'bg-amber-500'
                                                                  : 'bg-slate-400'
                                                        }`}
                                                        title={prio.label}
                                                    />
                                                    <ChevronRight
                                                        size={14}
                                                        className="text-slate-400 group-hover:text-indigo-700 shrink-0"
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    col.items.map(task => {
                                        const prio =
                                            SEQUA_PRIORITIES[task.priority] ||
                                            SEQUA_PRIORITIES.medium;
                                        const tType =
                                            SEQUA_TASK_TYPES[task.taskType] ||
                                            SEQUA_TASK_TYPES.task;

                                        const isTaskForVet =
                                            task.taskType === 'vet_request' ||
                                            String(task.assignedTo || '').toLowerCase() ===
                                                VET_EMAIL.toLowerCase();

                                        const isAssigned =
                                            String(task.assignedTo || '').toLowerCase() ===
                                            userEmail;
                                        const isReviewer =
                                            String(task.reviewerEmail || '').toLowerCase() ===
                                            userEmail;
                                        const isCreator =
                                            String(task.createdBy || '').toLowerCase() ===
                                                userEmail ||
                                            String(task.convertedBy || '').toLowerCase() ===
                                                userEmail;

                                        const canStart = !isTaskForVet
                                            ? isAssigned || isVet
                                            : isVet;
                                        const canSendReview = !isTaskForVet
                                            ? isAssigned || isVet
                                            : isVet;
                                        // Item 8: Reviewer (creator of the task) or Vet can approve when in 'review'
                                        const canApprove = isReviewer || isCreator || isVet;

                                        // Item 1 & Item 4: Only task creator or Vet can edit/delete, and NEVER edit when in 'review' or 'done'
                                        const canEdit =
                                            !['review', 'done'].includes(task.status) &&
                                            (isVet ||
                                                (isCreator &&
                                                    ['reported', 'todo'].includes(task.status)));

                                        const canDelete =
                                            isVet ||
                                            (isCreator &&
                                                ['reported', 'todo'].includes(task.status));

                                        const dateTimeBadge = formatSequaDateTimeBadge(
                                            task.dueDate,
                                            task.startTime,
                                            task.endTime
                                        );

                                        return (
                                            <div
                                                key={task._id}
                                                className={`bg-white rounded-xl p-3.5 border shadow-2xs space-y-2.5 ${
                                                    task.revisionCount > 0 && task.status === 'in_progress'
                                                        ? 'border-2 border-amber-400'
                                                        : 'border-slate-200'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-1 flex-wrap">
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${tType.badge}`}
                                                    >
                                                        {tType.shortLabel}
                                                    </span>
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] border ${prio.badge}`}
                                                    >
                                                        {prio.label}
                                                    </span>
                                                </div>

                                                {dateTimeBadge && (
                                                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                                        <Clock size={11} className="text-rose-600" />
                                                        {dateTimeBadge}
                                                    </div>
                                                )}

                                                {task.incompleteAtDayEnd && task.status === 'todo' && (
                                                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-[10px] font-bold text-amber-900">
                                                        ⏰ Gün Sonu Tamamlanmadı — Yapılmamış Olarak Tekrar Atandı
                                                    </div>
                                                )}

                                                {task.revisionCount > 0 && task.lastRevisionNote && task.status === 'in_progress' && (
                                                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-[10px] text-amber-950">
                                                        <div className="font-extrabold">
                                                            🔄 Tekrarlatıldı ({task.revisionCount}. kez)
                                                        </div>
                                                        <div className="text-rose-800 mt-0.5">
                                                            Not: {task.lastRevisionNote}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="text-xs font-extrabold text-slate-900">
                                                    {task.title}
                                                </div>

                                                {task.description && (
                                                    <p className="text-[11px] text-slate-600">
                                                        {task.description}
                                                    </p>
                                                )}

                                                {task.sourceRitusRunId && (
                                                    <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-[10px] font-semibold text-indigo-800 flex items-center gap-1">
                                                        <Link2 size={11} />
                                                        Ritus Rutininden Doğdu
                                                    </div>
                                                )}

                                                {task.externalUnit && (
                                                    <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-[10px] font-semibold text-purple-900">
                                                        🏛️ {task.externalUnit}
                                                        {task.externalTicketNo && (
                                                            <span className="block text-purple-700">
                                                                Evrak/Takip: {task.externalTicketNo}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {task.contextRef?.label && (
                                                    <div className="text-[10px] font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                                        📍 Konum: {task.contextRef.label}
                                                    </div>
                                                )}

                                                <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
                                                    <div>
                                                        Oluşturan:{' '}
                                                        <strong className="text-slate-800">
                                                            {task.createdByName ||
                                                                getMemberName(
                                                                    task.createdBy,
                                                                    members
                                                                )}
                                                        </strong>
                                                    </div>
                                                    <div>
                                                        Sorumlu:{' '}
                                                        <strong className="text-slate-800">
                                                            {getMemberName(
                                                                task.assignedTo,
                                                                members
                                                            )}
                                                        </strong>
                                                    </div>
                                                    <div>
                                                        Kontrolcü:{' '}
                                                        <strong className="text-slate-800">
                                                            {getMemberName(
                                                                task.reviewerEmail || task.createdBy,
                                                                members
                                                            )}
                                                        </strong>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                                                    {isTaskForVet &&
                                                        !isVet &&
                                                        task.status !== 'review' && (
                                                            <div className="px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-center gap-1.5 w-full">
                                                                <Stethoscope
                                                                    size={13}
                                                                    className="text-rose-600 shrink-0"
                                                                />
                                                                <span>
                                                                    Sorumlu Veteriner Hekim Yürütmesinde
                                                                </span>
                                                            </div>
                                                        )}

                                                    {task.status === 'reported' &&
                                                        !isCaretaker && (
                                                            <>
                                                                {(isAssigned || isVet) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handlePatchTask(
                                                                                task._id,
                                                                                'move_status',
                                                                                {
                                                                                    status: 'in_progress'
                                                                                }
                                                                            )
                                                                        }
                                                                        className="min-h-[40px] inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                                                    >
                                                                        Üstlen &amp; Başlat
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setConvertModal({
                                                                            open: true,
                                                                            task
                                                                        })
                                                                    }
                                                                    className="min-h-[40px] inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                                                                >
                                                                    Göreve Dönüştür &amp; Ata
                                                                </button>
                                                            </>
                                                        )}

                                                    {task.status === 'todo' &&
                                                        canStart && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handlePatchTask(
                                                                        task._id,
                                                                        'move_status',
                                                                        {
                                                                            status: 'in_progress'
                                                                        }
                                                                    )
                                                                }
                                                                className="min-h-[40px] inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                                                            >
                                                                Başlat
                                                            </button>
                                                        )}

                                                    {task.status === 'in_progress' &&
                                                        canSendReview && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handlePatchTask(
                                                                            task._id,
                                                                            'move_status',
                                                                            {
                                                                                status: 'review'
                                                                            }
                                                                        )
                                                                    }
                                                                    className="min-h-[40px] inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                                                                >
                                                                    Kontrole Gönder
                                                                </button>
                                                                {task.taskType !== 'external' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handlePatchTask(
                                                                                task._id,
                                                                                'revert_to_todo'
                                                                            )
                                                                        }
                                                                        className="min-h-[40px] inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                                                                        title="Görevi yarıda bırak ve yapılacaklara geri al"
                                                                    >
                                                                        <RotateCcw size={12} />
                                                                        Geri Bırak
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}

                                                    {task.status === 'review' &&
                                                        canApprove &&
                                                        !isCaretaker && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handlePatchTask(
                                                                            task._id,
                                                                            'approve'
                                                                        )
                                                                    }
                                                                    className="min-h-[40px] inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
                                                                >
                                                                    <CheckCircle2 size={13} />
                                                                    Onayla &amp; Kapat
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setRevisionModal({
                                                                            open: true,
                                                                            task
                                                                        })
                                                                    }
                                                                    className="min-h-[40px] inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1"
                                                                >
                                                                    <RotateCcw size={12} />
                                                                    Tekrarlat
                                                                </button>
                                                            </>
                                                        )}

                                                    {(canEdit || canDelete) && (
                                                        <div className="flex items-center gap-1.5 ml-auto">
                                                            {canEdit && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingTask(task);
                                                                        setCreateModalOpen(true);
                                                                    }}
                                                                    className="min-h-[38px] inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                                                                    title="Görevi düzenle"
                                                                >
                                                                    <Edit3 size={13} />
                                                                    Düzenle
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleDeleteTask(task._id)
                                                                    }
                                                                    className="min-h-[38px] inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold"
                                                                    title="Görevi sil"
                                                                >
                                                                    <Trash2 size={13} />
                                                                    Sil
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
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

            {createModalOpen && (
                <CreateSequaModal
                    key={editingTask?._id ? `edit-${editingTask._id}` : (initialModalType ? `create-sequa-${initialModalType}` : 'create-sequa-modal')}
                    isOpen={createModalOpen}
                    onClose={() => {
                        setCreateModalOpen(false);
                        setEditingTask(null);
                    }}
                    user={user}
                    members={members}
                    initialTaskType={initialModalType}
                    initialTask={editingTask}
                    onSubmit={async payload => {
                        const res = await apiFetch('/api/sequa/tasks', {
                            method: editingTask ? 'PATCH' : 'POST',
                            body: JSON.stringify(payload)
                        });
                        if (res?.task) {
                            setTasks(prev =>
                                editingTask
                                    ? prev.map(t =>
                                          String(t._id) === String(res.task._id) ? res.task : t
                                      )
                                    : [res.task, ...prev]
                            );
                        }
                    }}
                />
            )}

            <ConvertIssueModal
                key={convertModal.task?._id || 'convert-modal'}
                isOpen={convertModal.open}
                onClose={() => setConvertModal({ open: false, task: null })}
                task={convertModal.task}
                members={members}
                onSubmit={async payload => {
                    const res = await apiFetch('/api/sequa/tasks', {
                        method: 'PATCH',
                        body: JSON.stringify(payload)
                    });
                    if (res?.task) {
                        setTasks(prev =>
                            prev.map(t =>
                                String(t._id) === String(res.task._id) ? res.task : t
                            )
                        );
                    }
                }}
            />

            <SequaRevisionModal
                key={revisionModal.task?._id || 'sequa-revision-modal'}
                isOpen={revisionModal.open}
                onClose={() => setRevisionModal({ open: false, task: null })}
                task={revisionModal.task}
                onSubmit={async payload => {
                    const res = await apiFetch('/api/sequa/tasks', {
                        method: 'PATCH',
                        body: JSON.stringify(payload)
                    });
                    if (res?.task) {
                        setTasks(prev =>
                            prev.map(t =>
                                String(t._id) === String(res.task._id) ? res.task : t
                            )
                        );
                    }
                }}
            />

            <CompletedTaskDetailModal
                isOpen={Boolean(completedDetailTask)}
                onClose={() => setCompletedDetailTask(null)}
                item={completedDetailTask}
                mode="sequa"
                members={members}
                canDelete={isVet}
                onDelete={handleDeleteTask}
            />

            <PlannedTaskDetailModal
                isOpen={Boolean(todoDetailTask)}
                onClose={() => setTodoDetailTask(null)}
                item={
                    todoDetailTask
                        ? (tasks || []).find(t => String(t._id) === String(todoDetailTask._id)) || todoDetailTask
                        : null
                }
                mode="sequa"
                members={members}
                currentUser={user}
                onStart={async id => {
                    await handlePatchTask(id, 'start');
                }}
                canEdit={
                    todoDetailTask &&
                    (isVet ||
                        (String(todoDetailTask.createdBy || '').toLowerCase() === userEmail &&
                            ['reported', 'todo'].includes(todoDetailTask.status)))
                }
                onEdit={task => {
                    setEditingTask(task);
                    setCreateModalOpen(true);
                }}
                canDelete={
                    todoDetailTask &&
                    (isVet ||
                        (String(todoDetailTask.createdBy || '').toLowerCase() === userEmail &&
                            ['reported', 'todo'].includes(todoDetailTask.status)))
                }
                onDelete={handleDeleteTask}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                variant={confirmModal.variant}
                hideCancel={confirmModal.hideCancel}
                isLoading={confirmModal.isLoading}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
