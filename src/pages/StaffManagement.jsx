import React, { useState, useEffect, useCallback } from 'react';
import {
    Search,
    User,
    Shield,
    Stethoscope,
    Wrench,
    UserCheck,
    Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, DEFAULT_STAFF_DIRECTORY } from '../utils/pulsusHelpers';

const ROLE_OPTIONS = [
    {
        value: 'vet',
        label: 'Sorumlu Vet. Hekim',
        defaultTitle: 'Sorumlu Veteriner Hekim',
        icon: Stethoscope,
        activeClass: 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-500/30',
        inactiveClass: 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
    },
    {
        value: 'technician',
        label: 'Tekniker / Denetçi',
        defaultTitle: 'Veteriner Sağlık Teknikeri',
        icon: Wrench,
        activeClass: 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-500/30',
        inactiveClass: 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
    },
    {
        value: 'caretaker',
        label: 'Bakıcı / Temizlik',
        defaultTitle: 'Hayvan Bakıcısı / Temizlik Görevlisi',
        icon: UserCheck,
        activeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-500/30',
        inactiveClass: 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
    }
];

const TITLE_OPTIONS = [
    'Sorumlu Veteriner Hekim',
    'Veteriner Sağlık Teknikeri',
    'Laboratuvar Teknikeri',
    'Hayvan Bakıcısı / Temizlik Görevlisi'
];

export default function StaffManagement() {
    const { isVet, refreshUser } = useAuth();
    const [members, setMembers] = useState(DEFAULT_STAFF_DIRECTORY);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [savingEmail, setSavingEmail] = useState(null);
    const [savedEmail, setSavedEmail] = useState(null);

    const loadMembers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/members');
            if (res?.members?.length) {
                setMembers(res.members);
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

    const handleQuickUpdate = async (member, updates) => {
        if (!isVet) return;
        const nextRole = updates.pulsusRole ?? member.pulsusRole;
        let nextTitle = updates.title ?? member.title;

        // If role changed and title wasn't explicitly changed, auto-pick matching title
        if (updates.pulsusRole && !updates.title) {
            const matchedRole = ROLE_OPTIONS.find(r => r.value === updates.pulsusRole);
            if (matchedRole) {
                nextTitle = matchedRole.defaultTitle;
            }
        }

        const nextBackup =
            updates.defaultBackupEmail !== undefined
                ? updates.defaultBackupEmail
                : member.defaultBackupEmail || '';

        // Optimistic UI update
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

        setSavingEmail(member.email);
        setSavedEmail(null);
        try {
            await apiFetch('/api/members', {
                method: 'PUT',
                body: JSON.stringify({
                    email: member.email,
                    name: member.name,
                    pulsusRole: nextRole,
                    title: nextTitle,
                    defaultBackupEmail: nextBackup || null,
                    isActive: true
                })
            });
            setSavedEmail(member.email);
            if (refreshUser) await refreshUser();
            setTimeout(() => {
                setSavedEmail(prev => (prev === member.email ? null : prev));
            }, 2000);
        } catch (err) {
            alert(err.message || 'Güncelleme kaydedilemedi.');
            await loadMembers();
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
                        Veritabanındaki kullanıcıların yetki rollerini, görev ünvanlarını ve yedek sorumlularını tek tıkla yönetin
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700">
                    <Shield size={15} />
                    <span>Değişiklikler seçtiğiniz anda otomatik kaydedilir</span>
                </div>
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
                                <th className="px-6 py-4">Kullanıcı</th>
                                <th className="px-6 py-4">Yetki Rolü (Tıklayarak Seçin)</th>
                                <th className="px-6 py-4">Görev Ünvanı</th>
                                <th className="px-6 py-4">Yedek Sorumlu</th>
                                <th className="px-6 py-4 text-right">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-6 py-10 text-center text-xs text-slate-400"
                                    >
                                        Veritabanından personel listesi yükleniyor...
                                    </td>
                                </tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-6 py-10 text-center text-sm text-slate-500"
                                    >
                                        Arama kriterine uygun personel bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map(member => {
                                    const isSaving = savingEmail === member.email;
                                    const isSaved = savedEmail === member.email;
                                    const currentTitle =
                                        member.title ||
                                        ROLE_OPTIONS.find(r => r.value === member.pulsusRole)
                                            ?.defaultTitle ||
                                        'Hayvan Bakıcısı / Temizlik Görevlisi';

                                    const titleList = TITLE_OPTIONS.includes(currentTitle)
                                        ? TITLE_OPTIONS
                                        : [currentTitle, ...TITLE_OPTIONS];

                                    return (
                                        <tr
                                            key={member.email}
                                            className="hover:bg-slate-50/80 transition-colors"
                                        >
                                            {/* User Info */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                                        <User size={17} />
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

                                            {/* Apex-style Clickable Role Pills */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {ROLE_OPTIONS.map(opt => {
                                                        const IconComp = opt.icon;
                                                        const active =
                                                            member.pulsusRole === opt.value;
                                                        return (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                disabled={!isVet || isSaving}
                                                                onClick={() => {
                                                                    if (!active) {
                                                                        handleQuickUpdate(member, {
                                                                            pulsusRole: opt.value
                                                                        });
                                                                    }
                                                                }}
                                                                aria-pressed={active}
                                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                                                                    active
                                                                        ? opt.activeClass
                                                                        : opt.inactiveClass
                                                                } disabled:opacity-60`}
                                                            >
                                                                <IconComp size={13} />
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </td>

                                            {/* Duty Title Select */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <select
                                                    disabled={!isVet || isSaving}
                                                    value={currentTitle}
                                                    onChange={e =>
                                                        handleQuickUpdate(member, {
                                                            title: e.target.value
                                                        })
                                                    }
                                                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                >
                                                    {titleList.map(t => (
                                                        <option key={t} value={t}>
                                                            {t}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Default Backup Select */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <select
                                                    disabled={!isVet || isSaving}
                                                    value={member.defaultBackupEmail || ''}
                                                    onChange={e =>
                                                        handleQuickUpdate(member, {
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

                                            {/* Save / Leave Status */}
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                {isSaving ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                                        Kaydediliyor...
                                                    </span>
                                                ) : isSaved ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                                        <Check size={13} />
                                                        Kaydedildi
                                                    </span>
                                                ) : member.onLeaveToday ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                        🏖️ Bugün İzinli
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                        Aktif
                                                    </span>
                                                )}
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
