import React, { useState, useEffect, useCallback } from 'react';
import {
    Search,
    User,
    Stethoscope,
    Syringe,
    UserCheck,
    Check,
    Trash2,
    Save,
    RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, DEFAULT_STAFF_DIRECTORY } from '../utils/pulsusHelpers';

const ROLE_OPTIONS = [
    {
        value: 'vet',
        label: 'Vet. Hekim',
        defaultTitle: 'Sorumlu Veteriner Hekim',
        icon: Stethoscope,
        activeClass: 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-500/30',
        inactiveClass: 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
    },
    {
        value: 'technician',
        label: 'Veteriner Teknikeri',
        defaultTitle: 'Veteriner Teknikeri',
        icon: Syringe,
        activeClass: 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-500/30',
        inactiveClass: 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
    },
    {
        value: 'caretaker',
        label: 'Bakıcı',
        defaultTitle: 'Hayvan Bakıcısı / Temizlik Görevlisi',
        icon: UserCheck,
        activeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-500/30',
        inactiveClass: 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
    }
];

export default function StaffManagement() {
    const { user, isVet, refreshUser } = useAuth();
    const [members, setMembers] = useState(DEFAULT_STAFF_DIRECTORY);
    const [initialMembers, setInitialMembers] = useState(DEFAULT_STAFF_DIRECTORY);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [savingEmail, setSavingEmail] = useState(null);
    const [savedBanner, setSavedBanner] = useState(false);

    const loadMembers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/members');
            if (res?.members) {
                setMembers(res.members);
                setInitialMembers(res.members);
            }
        } catch (err) {
            console.error('Personel listesi yüklenemedi:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMembers();
    }, [loadMembers]);

    const isMemberDirty = useCallback(
        member => {
            const orig = initialMembers.find(
                m => String(m.email).toLowerCase() === String(member.email).toLowerCase()
            );
            if (!orig) return true;
            return (
                orig.pulsusRole !== member.pulsusRole ||
                (orig.defaultBackupEmail || '') !== (member.defaultBackupEmail || '')
            );
        },
        [initialMembers]
    );

    const dirtyMembers = members.filter(isMemberDirty);
    const hasUnsavedChanges = dirtyMembers.length > 0;

    const handleStageUpdate = (member, updates) => {
        if (!isVet) return;
        const nextRole = updates.pulsusRole ?? member.pulsusRole;
        const matchedRole = ROLE_OPTIONS.find(r => r.value === nextRole);
        const nextTitle = matchedRole ? matchedRole.defaultTitle : member.title;

        const nextBackup =
            updates.defaultBackupEmail !== undefined
                ? updates.defaultBackupEmail
                : member.defaultBackupEmail || '';

        setSavedBanner(false);
        setMembers(prev =>
            prev.map(m =>
                m.email === member.email
                    ? {
                          ...m,
                          pulsusRole: nextRole,
                          title: nextTitle,
                          defaultBackupEmail: nextBackup || null
                      }
                    : m
            )
        );
    };

    const handleSaveChanges = async (targetMembers = dirtyMembers) => {
        if (!isVet || targetMembers.length === 0) return;
        setSaving(true);
        setSavedBanner(false);
        try {
            for (const member of targetMembers) {
                const matchedRole = ROLE_OPTIONS.find(r => r.value === member.pulsusRole);
                const resolvedTitle =
                    matchedRole?.defaultTitle ||
                    member.title ||
                    'Hayvan Bakıcısı / Temizlik Görevlisi';

                await apiFetch('/api/members', {
                    method: 'PUT',
                    body: JSON.stringify({
                        email: member.email,
                        name: member.name,
                        pulsusRole: member.pulsusRole,
                        title: resolvedTitle,
                        defaultBackupEmail: member.defaultBackupEmail || null,
                        isActive: true
                    })
                });
            }
            await loadMembers();
            if (refreshUser) await refreshUser();
            setSavedBanner(true);
            setTimeout(() => setSavedBanner(false), 3000);
        } catch (err) {
            alert(err.message || 'Değişiklikler kaydedilirken hata oluştu.');
        } finally {
            setSaving(false);
        }
    };

    const handleResetChanges = () => {
        setMembers(initialMembers);
        setSavedBanner(false);
    };

    const handleRemoveFromPulsus = async member => {
        if (!isVet) return;
        if (String(member.email).toLowerCase() === String(user?.email || '').toLowerCase()) {
            alert('Kendi aktif yönetici hesabınızı listeden çıkaramazsınız.');
            return;
        }
        if (
            !window.confirm(
                `${member.name || member.email} adlı kişiyi Pulsus personel listesinden çıkarmak istediğinize emin misiniz?`
            )
        ) {
            return;
        }

        setSavingEmail(member.email);
        try {
            await apiFetch(`/api/members?email=${encodeURIComponent(member.email)}`, {
                method: 'DELETE'
            });
            setMembers(prev => prev.filter(m => m.email !== member.email));
        } catch (err) {
            alert(err.message || 'Personel listeden çıkarılamadı.');
        } finally {
            setSavingEmail(null);
        }
    };

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredMembers = members.filter(m => {
        if (!normalizedQuery) return true;
        const nameMatch = (m.name || '').toLowerCase().includes(normalizedQuery);
        const emailMatch = (m.email || '').toLowerCase().includes(normalizedQuery);
        const titleMatch = (m.title || '').toLowerCase().includes(normalizedQuery);
        return nameMatch || emailMatch || titleMatch;
    });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                        Personel ve Rol Yönetimi
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Personelin görev rollerini ve yedek sorumlularını yönetin
                    </p>
                </div>

                {isVet && (
                    <div className="flex items-center gap-2">
                        {savedBanner && !hasUnsavedChanges && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check size={14} />
                                Değişiklikler kaydedildi
                            </span>
                        )}
                        {hasUnsavedChanges && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleResetChanges}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                            >
                                <RotateCcw size={14} />
                                Vazgeç
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={!hasUnsavedChanges || saving}
                            onClick={() => handleSaveChanges(dirtyMembers)}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                                hasUnsavedChanges
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            }`}
                        >
                            <Save size={14} />
                            {saving
                                ? 'Kaydediliyor...'
                                : hasUnsavedChanges
                                  ? `Değişiklikleri Kaydet (${dirtyMembers.length})`
                                  : 'Değişiklikleri Kaydet'}
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                        />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Ad soyad, e-posta veya görev ünvanı ile personel ara..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-5 py-3.5">Kullanıcı</th>
                                <th className="px-5 py-3.5">Görev Rolü</th>
                                <th className="px-5 py-3.5">Yedek Sorumlu</th>
                                <th className="px-5 py-3.5 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-6 py-10 text-center text-xs text-slate-400"
                                    >
                                        Veritabanından personel listesi yükleniyor...
                                    </td>
                                </tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-6 py-10 text-center text-sm text-slate-500"
                                    >
                                        Arama kriterine uygun personel bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map(member => {
                                    const isRowSaving = savingEmail === member.email || saving;
                                    const isDirty = isMemberDirty(member);
                                    const isSelf =
                                        String(member.email).toLowerCase() ===
                                        String(user?.email || '').toLowerCase();

                                    return (
                                        <tr
                                            key={member.email}
                                            className={`transition-colors ${
                                                isDirty
                                                    ? 'bg-indigo-50/40 hover:bg-indigo-50/60'
                                                    : 'hover:bg-slate-50/80'
                                            }`}
                                        >
                                            {/* User Info */}
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                                        <User size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900">
                                                            {member.name || member.email}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {member.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Single-line Clickable Role Pills */}
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1.5">
                                                    {ROLE_OPTIONS.map(opt => {
                                                        const IconComp = opt.icon;
                                                        const active =
                                                            member.pulsusRole === opt.value;
                                                        return (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                disabled={!isVet || isRowSaving}
                                                                onClick={() => {
                                                                    if (!active) {
                                                                        handleStageUpdate(member, {
                                                                            pulsusRole: opt.value
                                                                        });
                                                                    }
                                                                }}
                                                                aria-pressed={active}
                                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                                                                    active
                                                                        ? opt.activeClass
                                                                        : opt.inactiveClass
                                                                } disabled:opacity-60`}
                                                            >
                                                                <IconComp size={12} />
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </td>

                                            {/* Yedek Sorumlu Select */}
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <select
                                                    disabled={!isVet || isRowSaving}
                                                    value={member.defaultBackupEmail || ''}
                                                    onChange={e =>
                                                        handleStageUpdate(member, {
                                                            defaultBackupEmail:
                                                                e.target.value || null
                                                        })
                                                    }
                                                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                >
                                                    <option value="">
                                                        Yedek Yok (Vet. Hekime Düşer)
                                                    </option>
                                                    {members
                                                        .filter(
                                                            m =>
                                                                String(m.email).toLowerCase() !==
                                                                String(member.email).toLowerCase()
                                                        )
                                                        .map(m => (
                                                            <option key={m.email} value={m.email}>
                                                                {m.name}
                                                            </option>
                                                        ))}
                                                </select>
                                            </td>

                                            {/* Status + Remove Action */}
                                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center justify-end gap-2">
                                                    {member.onLeaveToday && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                            🏖️ İzinli
                                                        </span>
                                                    )}

                                                    {isVet && (
                                                        <button
                                                            type="button"
                                                            disabled={isSelf || isRowSaving}
                                                            onClick={() =>
                                                                handleRemoveFromPulsus(member)
                                                            }
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                            title={
                                                                isSelf
                                                                    ? 'Kendi hesabınızı listeden çıkaramazsınız'
                                                                    : 'Listeden çıkar (Pulsus erişimini kaldır)'
                                                            }
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
