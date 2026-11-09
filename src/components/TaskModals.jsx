import React, { useState } from 'react';
import {
    X,
    AlertTriangle,
    Stethoscope,
    Building2,
    ClipboardList,
    RotateCcw,
    Send,
    Link2,
    UserCheck
} from 'lucide-react';
import {
    VET_EMAIL,
    SEQUA_PRIORITIES,
    UNIVERSITY_EXTERNAL_UNITS,
    DEFAULT_STAFF_DIRECTORY,
    getMemberName
} from '../utils/pulsusHelpers';

/**
 * Role-aware Sequa creation modal (also used when spawning a Sequa task from a Ritus routine run)
 */
export function CreateSequaModal({
    isOpen,
    onClose,
    onSubmit,
    user,
    members = DEFAULT_STAFF_DIRECTORY,
    sourceRitusRun = null,
    initialTaskType = null,
    initialTask = null
}) {
    const isEdit = Boolean(initialTask?._id);
    const userRole = user?.pulsusRole || 'caretaker';
    const isVet = userRole === 'vet' || user?.role === 'admin';
    const isTechnician = userRole === 'technician';
    const isCaretaker = !isVet && !isTechnician;

    const defaultType =
        initialTask?.taskType ||
        initialTaskType ||
        (isCaretaker ? 'issue_report' : sourceRitusRun ? 'issue_report' : 'task');

    const staffList = members.length > 0 ? members : DEFAULT_STAFF_DIRECTORY;
    const supervisorsOnly = staffList.filter(
        m => m.pulsusRole === 'technician' || m.pulsusRole === 'vet'
    );

    const [taskType, setTaskType] = useState(defaultType);
    const [title, setTitle] = useState(
        initialTask?.title || (sourceRitusRun ? `[Rutin Bildirimi] ${sourceRitusRun.title}` : '')
    );
    const [description, setDescription] = useState(initialTask?.description || '');
    const [priority, setPriority] = useState(
        initialTask?.priority || (defaultType === 'vet_request' ? 'high' : 'medium')
    );
    const [assignedTo, setAssignedTo] = useState(() => {
        if (initialTask?.assignedTo) return initialTask.assignedTo;
        if (defaultType === 'vet_request') return VET_EMAIL;
        if (isCaretaker) {
            const firstTech = supervisorsOnly.find(m => m.pulsusRole === 'technician');
            return firstTech?.email || VET_EMAIL;
        }
        const firstCaretaker = staffList.find(m => m.pulsusRole === 'caretaker');
        return firstCaretaker?.email || staffList[0]?.email || VET_EMAIL;
    });
    const [externalUnit, setExternalUnit] = useState(
        initialTask?.externalUnit || UNIVERSITY_EXTERNAL_UNITS[0]
    );
    const [externalTicketNo, setExternalTicketNo] = useState(initialTask?.externalTicketNo || '');
    const [dueDate, setDueDate] = useState(initialTask?.dueDate || '');
    const [contextLabel, setContextLabel] = useState(
        initialTask?.contextRef?.label || sourceRitusRun?.contextRef?.label || ''
    );
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleTypeSwitch = newType => {
        setTaskType(newType);
        if (newType === 'vet_request') {
            setAssignedTo(VET_EMAIL);
            setPriority('high');
        } else if (newType === 'issue_report' && isCaretaker) {
            const firstTech = supervisorsOnly.find(m => m.pulsusRole === 'technician');
            setAssignedTo(firstTech?.email || VET_EMAIL);
        } else if (newType === 'external') {
            const firstTech = staffList.find(m => m.pulsusRole === 'technician');
            setAssignedTo(firstTech?.email || VET_EMAIL);
        }
    };

    const handleFormSubmit = async e => {
        e.preventDefault();
        setError('');
        if (!title || title.trim().length < 2) {
            setError('Lütfen en az 2 karakterli bir başlık giriniz.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...(isEdit ? { id: String(initialTask._id), action: 'edit_task' } : {}),
                title: title.trim(),
                description: description.trim(),
                taskType: isCaretaker ? 'issue_report' : taskType,
                priority,
                assignedTo: taskType === 'vet_request' ? VET_EMAIL : assignedTo,
                externalUnit: taskType === 'external' ? externalUnit.trim() : null,
                externalTicketNo:
                    taskType === 'external' && externalTicketNo.trim()
                        ? externalTicketNo.trim()
                        : null,
                dueDate: dueDate || null,
                sourceRitusRunId: sourceRitusRun?._id ? String(sourceRitusRun._id) : initialTask?.sourceRitusRunId || null,
                contextRef: contextLabel.trim()
                    ? {
                          module: sourceRitusRun?.contextRef?.module || initialTask?.contextRef?.module || 'Locus',
                          entityType: sourceRitusRun?.contextRef?.entityType || initialTask?.contextRef?.entityType || 'location',
                          entityId: sourceRitusRun?.contextRef?.entityId || initialTask?.contextRef?.entityId || null,
                          label: contextLabel.trim()
                      }
                    : sourceRitusRun?.contextRef || null
            };
            await onSubmit(payload);
            onClose();
        } catch (err) {
            setError(err.message || 'Kayıt kaydedilirken hata oluştu.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="shrink-0 px-5 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                            {isEdit ? (
                                <>
                                    <ClipboardList size={18} className="text-indigo-400" />
                                    Sequa Görevini Düzenle
                                </>
                            ) : isCaretaker ? (
                                <>
                                    <AlertTriangle size={18} className="text-amber-400" />
                                    Problem / Arıza Bildir (Sequa)
                                </>
                            ) : (
                                <>
                                    <ClipboardList size={18} className="text-rose-400" />
                                    Yeni Sequa Kaydı Oluştur
                                </>
                            )}
                        </h3>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                            {isCaretaker
                                ? 'Bakıcı/Temizlik personeli olarak karşılaştığınız aksaklıkları Teknikere veya Veteriner Hekime bildirin.'
                                : 'Anlık görev ataması, hekim muayene talebi veya dış birim arıza takibi başlatın.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-5 space-y-3.5 overflow-y-auto flex-1">
                    {sourceRitusRun && (
                        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-start gap-2.5 text-xs text-indigo-900">
                            <Link2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold block">
                                    Bağlı Ritus Rutini: {sourceRitusRun.title}
                                </span>
                                <span className="text-indigo-700">
                                    Planlanan Tarih: {sourceRitusRun.scheduledDate} •{' '}
                                    {sourceRitusRun.scheduledTime}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Task Type Selector for Vet & Technician */}
                    {!isCaretaker && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Kayıt Türü Seçin
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleTypeSwitch('task')}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                                        taskType === 'task'
                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500'
                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <ClipboardList size={16} className="text-indigo-600 shrink-0" />
                                    <div>
                                        <div className="font-bold">Personel Görevi</div>
                                        <div className="text-[10px] text-slate-500">Ekibe iş ata</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleTypeSwitch('vet_request')}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                                        taskType === 'vet_request'
                                            ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500'
                                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <Stethoscope size={16} className="text-rose-600 shrink-0" />
                                    <div>
                                        <div className="font-bold">Hekime Danış / Muayene</div>
                                        <div className="text-[10px] text-slate-500">
                                            Klinik karar &amp; kontrol
                                        </div>
                                    </div>
                                </button>

                                {isVet ? (
                                    <button
                                        type="button"
                                        onClick={() => handleTypeSwitch('external')}
                                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                                            taskType === 'external'
                                                ? 'bg-purple-50 border-purple-500 text-purple-900 ring-1 ring-purple-500'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Building2 size={16} className="text-purple-600 shrink-0" />
                                        <div>
                                            <div className="font-bold">Üniversite / Dış Birim</div>
                                            <div className="text-[10px] text-slate-500">
                                                Yapı İşleri / Servis
                                            </div>
                                        </div>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleTypeSwitch('issue_report')}
                                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                                            taskType === 'issue_report'
                                                ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                                        <div>
                                            <div className="font-bold">Problem Bildir</div>
                                            <div className="text-[10px] text-slate-500">
                                                Arıza / Eksik kaydı
                                            </div>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Quick helper template when Technician selects vet_request */}
                    {taskType === 'vet_request' && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
                            <div className="font-bold flex items-center gap-1.5">
                                <Stethoscope size={14} className="text-rose-600" />
                                Sorumlu Veteriner Hekime (Oğuzhan Baygül) Doğrudan Muayene / Karar Çağrısı
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!title) {
                                        setTitle('Kafes Değişimi Sırasında Klinik Muayene Talebi');
                                    }
                                    if (!description) {
                                        setDescription(
                                            'X kafesinde değişim yaparken bir hayvanın genel durumu kötü (letarji / piloereksiyon) gözlemlendi, hocam gelip bakar mısınız?'
                                        );
                                    }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-rose-300 text-rose-700 font-semibold hover:bg-rose-100 transition-colors"
                            >
                                + Örnek Muayene Metnini Doldur
                            </button>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Başlık *
                        </label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={
                                isCaretaker
                                    ? 'Örn: Yıkama odası gider tıkanıklığı / Kafes suluk sızıntısı'
                                    : taskType === 'vet_request'
                                      ? 'Örn: Fare Odası-1 Raf B3 Kafes #14 Klinik Muayene Talebi'
                                      : 'Görev veya bildirim başlığı...'
                            }
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Detaylı Açıklama / Gözlem Notu
                        </label>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Gözlemlenen durumu, kafes/oda bilgisini veya yapılması gereken işlemi açıklayın..."
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                    </div>

                    {/* External University Unit Fields */}
                    {taskType === 'external' && (
                        <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-purple-900 mb-1">
                                    İlgili Üniversite / Dış Kaynak Birimi *
                                </label>
                                <select
                                    value={
                                        UNIVERSITY_EXTERNAL_UNITS.includes(externalUnit)
                                            ? externalUnit
                                            : '__custom__'
                                    }
                                    onChange={e => {
                                        if (e.target.value !== '__custom__') {
                                            setExternalUnit(e.target.value);
                                        } else {
                                            setExternalUnit('');
                                        }
                                    }}
                                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-purple-300 rounded-lg mb-2"
                                >
                                    {UNIVERSITY_EXTERNAL_UNITS.map(u => (
                                        <option key={u} value={u}>
                                            {u}
                                        </option>
                                    ))}
                                    <option value="__custom__">Diğer Birim (Elle Yazın)...</option>
                                </select>
                                <input
                                    type="text"
                                    value={externalUnit}
                                    onChange={e => setExternalUnit(e.target.value)}
                                    placeholder="Birim veya firma adı..."
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-purple-900 mb-1">
                                    Üniversite İş Emri / Evrak Takip No (Opsiyonel)
                                </label>
                                <input
                                    type="text"
                                    value={externalTicketNo}
                                    onChange={e => setExternalTicketNo(e.target.value)}
                                    placeholder="Örn: YIT-2026-418 veya EBYS-9021"
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Assignee / Target Selector */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                {isCaretaker
                                    ? 'Bildirilecek Üst Sorumlu (Tekniker / Hekim) *'
                                    : taskType === 'vet_request'
                                      ? 'Muayene / Karar Merci'
                                      : taskType === 'external'
                                        ? 'İç Takip Sorumlusu'
                                        : 'Atanan Personel *'}
                            </label>
                            <select
                                value={taskType === 'vet_request' ? VET_EMAIL : assignedTo}
                                disabled={taskType === 'vet_request'}
                                onChange={e => setAssignedTo(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl disabled:bg-slate-100"
                            >
                                {(isCaretaker ? supervisorsOnly : staffList).map(m => (
                                    <option key={m.email} value={m.email}>
                                        {m.name} (
                                        {m.pulsusRole === 'vet'
                                            ? 'Vet. Hekim'
                                            : m.pulsusRole === 'technician'
                                              ? 'Tekniker'
                                              : 'Bakıcı'}
                                        {m.onLeaveToday ? ' - 🏖️ İzinli (Yedeğe Devredilir)' : ''})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Öncelik Derecesi
                            </label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl"
                            >
                                {Object.entries(SEQUA_PRIORITIES).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Oda / Kafes / Cihaz Konumu (Opsiyonel)
                            </label>
                            <input
                                type="text"
                                value={contextLabel}
                                onChange={e => setContextLabel(e.target.value)}
                                placeholder="Örn: Fare Odası-1 / Raf B3 Kafes #14"
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Hedef Bitiş Tarihi (Opsiyonel)
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                            Vazgeç
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 shadow-sm disabled:opacity-50"
                        >
                            <Send size={14} />
                            {submitting
                                ? 'Kaydediliyor...'
                                : isCaretaker
                                  ? 'Problemi Bildir'
                                  : taskType === 'vet_request'
                                    ? 'Hekime Muayene Talebi Gönder'
                                    : 'Sequa Kaydını Oluştur'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * Modal for Ritus Run actions:
 * - 'request_revision' (Tekrarlat)
 * - 'escalate_to_vet' (Hekime Bildir + optional spawnSequa)
 * - 'vet_reassign' (Personele Yönlendir / Yeniden Ata)
 */
export function RitusActionModal({
    isOpen,
    onClose,
    run,
    actionType,
    members = DEFAULT_STAFF_DIRECTORY,
    onSubmit
}) {
    const [note, setNote] = useState('');
    const [spawnSequa, setSpawnSequa] = useState(true);
    const [sequaTitle, setSequaTitle] = useState(
        run ? `[Ritus Eskalasyon] ${run.title}` : ''
    );
    const [sequaPriority, setSequaPriority] = useState('high');
    const [newAssigneeEmail, setNewAssigneeEmail] = useState(
        run?.effectiveAssignee || DEFAULT_STAFF_DIRECTORY[1]?.email || ''
    );
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !run) return null;

    const staffList = members.length > 0 ? members : DEFAULT_STAFF_DIRECTORY;

    const handleFormSubmit = async e => {
        e.preventDefault();
        setError('');

        if (
            (actionType === 'request_revision' || actionType === 'escalate_to_vet') &&
            (!note || note.trim().length < 2)
        ) {
            setError('Lütfen en az 2 karakterli bir açıklama/gerekçe notu giriniz.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                id: String(run._id),
                action: actionType,
                note: note.trim()
            };

            if (actionType === 'escalate_to_vet') {
                payload.spawnSequa = spawnSequa;
                payload.sequaTitle = sequaTitle.trim() || `[Ritus Eskalasyon] ${run.title}`;
                payload.sequaPriority = sequaPriority;
            }

            if (actionType === 'vet_reassign') {
                payload.newAssigneeEmail = newAssigneeEmail;
            }

            await onSubmit(payload);
            onClose();
        } catch (err) {
            setError(err.message || 'İşlem sırasında bir hata oluştu.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
                <div
                    className={`px-6 py-4 text-white flex items-center justify-between ${
                        actionType === 'request_revision'
                            ? 'bg-amber-600'
                            : actionType === 'escalate_to_vet'
                              ? 'bg-rose-600'
                              : 'bg-indigo-600'
                    }`}
                >
                    <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                        {actionType === 'request_revision' && (
                            <>
                                <RotateCcw size={18} />
                                Rutin Görevi Tekrarlat (Revizyon İste)
                            </>
                        )}
                        {actionType === 'escalate_to_vet' && (
                            <>
                                <AlertTriangle size={18} />
                                Sorumlu Veteriner Hekime Eskale Et (Bildir)
                            </>
                        )}
                        {actionType === 'vet_reassign' && (
                            <>
                                <UserCheck size={18} />
                                Görevi Başka Personele Yönlendir / Ata
                            </>
                        )}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-black/10"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="font-bold text-slate-800">{run.title}</div>
                        <div className="text-slate-500 mt-0.5">
                            Tarih: {run.scheduledDate} • {run.scheduledTime} | Mevcut Sorumlu:{' '}
                            <span className="font-semibold text-slate-700">
                                {getMemberName(run.effectiveAssignee, staffList)}
                            </span>
                        </div>
                    </div>

                    {actionType === 'vet_reassign' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Yeni Sorumlu Personel Seçin *
                            </label>
                            <select
                                value={newAssigneeEmail}
                                onChange={e => setNewAssigneeEmail(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl"
                            >
                                {staffList.map(m => (
                                    <option key={m.email} value={m.email}>
                                        {m.name} ({m.title || m.pulsusRole}
                                        {m.onLeaveToday ? ' - 🏖️ Bugün İzinli' : ' - 🟢 Görevde'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            {actionType === 'request_revision'
                                ? 'Tekrarlatma (Eksiklik / Revizyon) Gerekçesi *'
                                : actionType === 'escalate_to_vet'
                                  ? 'Veteriner Hekime Sevk / Eskalasyon Notu *'
                                  : 'Atama / Yönlendirme Notu (Opsiyonel)'}
                        </label>
                        <textarea
                            rows={3}
                            required={actionType !== 'vet_reassign'}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={
                                actionType === 'request_revision'
                                    ? 'Örn: 3 numaralı kafes rafının altlığı tam temizlenmemiş ve suluk nipeli kontrol edilmemiş, lütfen tekrarlayınız.'
                                    : actionType === 'escalate_to_vet'
                                      ? 'Örn: Otoklav Bowie-Dick testinde renk değişimi homojen değil, cihaz arızası şüphesi var.'
                                      : 'Örn: Circa izin çakışması nedeniyle nöbetçi personele yönlendirildi.'
                            }
                            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {actionType === 'escalate_to_vet' && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
                            <label className="flex items-center gap-2 text-xs font-bold text-rose-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={spawnSequa}
                                    onChange={e => setSpawnSequa(e.target.checked)}
                                    className="rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                                />
                                Aynı zamanda Sequa üzerinde Hekim Takip Görevi oluştur (spawnSequa)
                            </label>

                            {spawnSequa && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-semibold text-rose-800 mb-1">
                                            Sequa Görev Başlığı
                                        </label>
                                        <input
                                            type="text"
                                            value={sequaTitle}
                                            onChange={e => setSequaTitle(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-rose-800 mb-1">
                                            Öncelik
                                        </label>
                                        <select
                                            value={sequaPriority}
                                            onChange={e => setSequaPriority(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-rose-300 rounded-lg"
                                        >
                                            {Object.entries(SEQUA_PRIORITIES).map(([k, v]) => (
                                                <option key={k} value={k}>
                                                    {v.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                            Vazgeç
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50 ${
                                actionType === 'request_revision'
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : actionType === 'escalate_to_vet'
                                      ? 'bg-rose-600 hover:bg-rose-700'
                                      : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {submitting
                                ? 'İşleniyor...'
                                : actionType === 'request_revision'
                                  ? '🔄 Tekrarlatma Kararını Kaydet'
                                  : actionType === 'escalate_to_vet'
                                    ? '⚠️ Veteriner Hekime Bildir'
                                    : 'Atamayı Kaydet'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * Modal for converting a Caretaker's 'reported' issue_report into an actionable Staff Task or External University Task
 */
export function ConvertIssueModal({
    isOpen,
    onClose,
    task,
    members = DEFAULT_STAFF_DIRECTORY,
    onSubmit
}) {
    const staffList = members.length > 0 ? members : DEFAULT_STAFF_DIRECTORY;
    const [targetType, setTargetType] = useState('task');
    const [assignedTo, setAssignedTo] = useState(
        task?.assignedTo || staffList[1]?.email || VET_EMAIL
    );
    const [priority, setPriority] = useState(task?.priority || 'high');
    const [externalUnit, setExternalUnit] = useState(UNIVERSITY_EXTERNAL_UNITS[0]);
    const [externalTicketNo, setExternalTicketNo] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !task) return null;

    const handleFormSubmit = async e => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await onSubmit({
                id: String(task._id),
                action: 'convert_to_task',
                taskType: targetType,
                status: targetType === 'external' ? 'in_progress' : 'todo',
                assignedTo,
                priority,
                externalUnit: targetType === 'external' ? externalUnit : null,
                externalTicketNo:
                    targetType === 'external' && externalTicketNo.trim()
                        ? externalTicketNo.trim()
                        : null,
                note:
                    note.trim() ||
                    `Problem bildirimi ${
                        targetType === 'external' ? 'Üniversite Dış Birim İşine' : 'Personel Görevine'
                    } dönüştürüldü.`
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Dönüştürme işlemi başarısız oldu.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold">
                        Problem Bildirimini Göreve Dönüştür &amp; Ata
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-black/10"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                        <div className="font-bold text-amber-900">{task.title}</div>
                        <div className="text-amber-800 mt-0.5">{task.description}</div>
                        <div className="text-[11px] text-amber-700 mt-1">
                            Bildiren: {task.createdByName || getMemberName(task.createdBy, staffList)}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setTargetType('task')}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-left ${
                                targetType === 'task'
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900'
                                    : 'border-slate-200 text-slate-600'
                            }`}
                        >
                            📋 İç Personel Görevine Dönüştür
                        </button>
                        <button
                            type="button"
                            onClick={() => setTargetType('external')}
                            className={`p-2.5 rounded-xl border text-xs font-bold text-left ${
                                targetType === 'external'
                                    ? 'bg-purple-50 border-purple-500 text-purple-900'
                                    : 'border-slate-200 text-slate-600'
                            }`}
                        >
                            🏛️ Üniversite / Dış Birime Sevk Et
                        </button>
                    </div>

                    {targetType === 'external' && (
                        <div className="space-y-2 p-3 rounded-xl bg-purple-50 border border-purple-200">
                            <label className="block text-xs font-bold text-purple-900">
                                Üniversite / Dış Kaynak Birimi
                            </label>
                            <select
                                value={externalUnit}
                                onChange={e => setExternalUnit(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg"
                            >
                                {UNIVERSITY_EXTERNAL_UNITS.map(u => (
                                    <option key={u} value={u}>
                                        {u}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={externalTicketNo}
                                onChange={e => setExternalTicketNo(e.target.value)}
                                placeholder="İş Emri / EBYS Takip No (Opsiyonel)"
                                className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Atanacak Sorumlu Personel
                            </label>
                            <select
                                value={assignedTo}
                                onChange={e => setAssignedTo(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                            >
                                {staffList.map(m => (
                                    <option key={m.email} value={m.email}>
                                        {m.name} ({m.pulsusRole === 'vet' ? 'Vet. Hekim' : m.pulsusRole === 'technician' ? 'Tekniker' : 'Bakıcı'})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Öncelik
                            </label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                            >
                                {Object.entries(SEQUA_PRIORITIES).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Yönlendirme / Talimat Notu
                        </label>
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Yapılacak işlem talimatı..."
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        />
                    </div>

                    {error && (
                        <div className="p-2.5 rounded-xl bg-rose-50 text-xs font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                            Vazgeç
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            {submitting ? 'Kaydediliyor...' : 'Göreve Dönüştür & Ata'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
