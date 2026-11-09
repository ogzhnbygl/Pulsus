import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Activity,
    CalendarClock,
    Zap,
    BarChart3,
    Users,
    LayoutGrid,
    LogOut,
    Stethoscope,
    Wrench,
    UserCheck,
    Settings
} from 'lucide-react';
import { useAuth, getApexUrl, isPreviewHost } from '../context/AuthContext';
import { getRoleBadgeInfo } from '../utils/pulsusHelpers';

export default function Navbar() {
    const { user, logout, isVet, isTechnician, switchDevProfile, devProfiles } = useAuth();
    const navigate = useNavigate();
    const roleBadge = getRoleBadgeInfo(user?.pulsusRole);

    const navItems = [
        {
            to: '/',
            label: 'Pulsus',
            subtitle: 'Birleşik Pano & Odak',
            icon: Activity,
            activeColor: 'border-rose-600 text-rose-700 bg-rose-50/70'
        },
        {
            to: '/ritus',
            label: 'Ritus',
            subtitle: 'Periyodik Görevler & Şablonlar',
            icon: CalendarClock,
            activeColor: 'border-indigo-600 text-indigo-700 bg-indigo-50/70'
        },
        {
            to: '/sequa',
            label: 'Sequa',
            subtitle: 'Anlık Görev, Talep & Dış Birim',
            icon: Zap,
            activeColor: 'border-emerald-600 text-emerald-700 bg-emerald-50/70'
        },
        {
            to: '/reports',
            label: 'Raporlar & Ekip',
            subtitle: 'Performans & Circa İzin Durumu',
            icon: BarChart3,
            activeColor: 'border-violet-600 text-violet-700 bg-violet-50/70'
        },
        ...(isVet
            ? [
                  {
                      to: '/staff',
                      label: 'Personel & Rol Yönetimi',
                      subtitle: 'Yetki, Görev & Yedek Ayarları',
                      icon: Users,
                      activeColor: 'border-slate-900 text-slate-900 bg-slate-100'
                  }
              ]
            : [])
    ];

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Top Row: Brand & User Profile / Actions */}
                <div className="h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-gradient-to-br from-rose-600 via-rose-500 to-indigo-600 p-2.5 rounded-xl text-white shadow-sm shrink-0">
                            <Activity size={22} className="stroke-[2.5]" />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                                Pulsus
                            </span>
                            {isPreviewHost() && (
                                <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 rounded-full">
                                    Test Ortamı
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right side: Role Banner, Dev Switcher (if DEV), Apex Link, Logout */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {import.meta.env.DEV && devProfiles?.length > 0 && (
                            <div className="hidden xl:flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Rol Simülasyonu:
                                </span>
                                <select
                                    value={user?.email || ''}
                                    onChange={e => switchDevProfile(e.target.value)}
                                    className="text-xs font-semibold bg-transparent text-slate-700 focus:outline-none cursor-pointer"
                                    title="Geliştirici Modu Rol Değiştirici"
                                >
                                    {devProfiles.map(p => (
                                        <option key={p.email} value={p.email}>
                                            {p.name} ({p.pulsusRole === 'vet' ? 'Vet. Hekim' : p.pulsusRole === 'technician' ? 'Tekniker' : 'Bakıcı'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {user && (
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5">
                                <span className="hidden sm:inline text-xs sm:text-sm font-bold text-slate-800">
                                    {user.name || user.email}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => navigate(isVet ? '/staff' : '/reports')}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-opacity hover:opacity-85 ${roleBadge.className}`}
                                    title={
                                        isVet
                                            ? 'Personel & Rol Yönetimi sayfasını aç'
                                            : 'Ekip ve görev listesini görüntüle'
                                    }
                                >
                                    {isVet ? (
                                        <Stethoscope size={13} />
                                    ) : isTechnician ? (
                                        <Wrench size={13} />
                                    ) : (
                                        <UserCheck size={13} />
                                    )}
                                    <span className="hidden md:inline">
                                        {user.title || roleBadge.label}
                                    </span>
                                    <span className="md:hidden">{roleBadge.shortLabel}</span>
                                    {isVet && <Settings size={12} className="ml-0.5 opacity-75" />}
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-1 pl-1 sm:pl-2 border-l border-slate-200">
                            <a
                                href={getApexUrl()}
                                className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Apex Ana Ekrana Dön"
                            >
                                <LayoutGrid size={18} />
                                <span className="hidden lg:inline">Apex Hub</span>
                            </a>
                            <button
                                type="button"
                                onClick={logout}
                                className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Çıkış Yap"
                            >
                                <LogOut size={18} />
                                <span className="hidden lg:inline">Çıkış Yap</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Row: 4 Navigation Tabs */}
                <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar -mb-px pt-1">
                    {navItems.map(item => {
                        const IconComponent = item.icon;
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    `group flex items-center gap-2.5 px-3.5 py-2.5 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap rounded-t-lg ${
                                        isActive
                                            ? item.activeColor
                                            : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                    }`
                                }
                            >
                                <IconComponent size={17} className="shrink-0" />
                                <div className="flex flex-col text-left">
                                    <span className="leading-none">{item.label}</span>
                                    <span className="hidden sm:inline text-[10px] font-normal text-slate-400 mt-0.5">
                                        {item.subtitle}
                                    </span>
                                </div>
                            </NavLink>
                        );
                    })}
                </nav>
            </div>
        </header>
    );
}
