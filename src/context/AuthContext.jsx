import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const isPreviewHost = () => {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    return h === 'test.wildtype.app' || h.startsWith('test-') || h.endsWith('.vercel.app');
};

export const getApexUrl = () => {
    if (typeof window !== 'undefined') {
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:5173';
        if (isPreviewHost()) return 'https://test.wildtype.app';
    }
    return 'https://wildtype.app';
};

export const DEV_PROFILES = [
    {
        email: 'oguzhan.baygul@medeniyet.edu.tr',
        name: 'Oğuzhan Baygül',
        role: 'admin',
        apps: ['circa', 'silo', 'dispo', 'locus', 'pulsus'],
        pulsusRole: 'vet',
        title: 'Sorumlu Veteriner Hekim'
    },
    {
        email: 'kubra.celik@medeniyet.edu.tr',
        name: 'Kübra Çelik',
        role: 'staff',
        apps: ['circa', 'silo', 'dispo', 'locus', 'pulsus'],
        pulsusRole: 'technician',
        title: 'Veteriner Sağlık Teknikeri'
    },
    {
        email: 'gamze.demir@medeniyet.edu.tr',
        name: 'Gamze Demir',
        role: 'staff',
        apps: ['circa', 'silo', 'dispo', 'locus', 'pulsus'],
        pulsusRole: 'technician',
        title: 'Laboratuvar Teknikeri'
    },
    {
        email: 'gokhan.sert@medeniyet.edu.tr',
        name: 'Gökhan Sert',
        role: 'staff',
        apps: ['circa', 'pulsus'],
        pulsusRole: 'caretaker',
        title: 'Hayvan Bakıcısı / Temizlik Görevlisi'
    },
    {
        email: 'yusufenes.isik@medeniyet.edu.tr',
        name: 'Yusuf Enes Işık',
        role: 'staff',
        apps: ['circa', 'pulsus'],
        pulsusRole: 'caretaker',
        title: 'Hayvan Bakıcısı / Temizlik Görevlisi'
    }
];

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            const contentType = response.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');

            if (response.ok && isJson) {
                const data = await response.json();
                setUser({
                    ...data,
                    pulsusRole: data.pulsusRole || (data.role === 'admin' ? 'vet' : 'caretaker'),
                    title:
                        data.title ||
                        (data.pulsusRole === 'vet' || data.role === 'admin'
                            ? 'Sorumlu Veteriner Hekim'
                            : data.pulsusRole === 'technician'
                              ? 'Tekniker'
                              : 'Hayvan Bakıcısı / Temizlik Görevlisi')
                });
                setLoading(false);
                return;
            }

            if (import.meta.env.DEV) {
                const savedDevEmail = localStorage.getItem('pulsus_dev_email');
                const matchedProfile =
                    DEV_PROFILES.find(p => p.email === savedDevEmail) || DEV_PROFILES[0];
                setUser(matchedProfile);
                setLoading(false);
                return;
            }

            if (response.status === 403) {
                const errorData = isJson ? await response.json().catch(() => ({})) : {};
                console.error('Access Forbidden:', errorData.error);
                alert(errorData.error || 'Bu uygulamaya erişim yetkiniz bulunmamaktadır.');
                window.location.href = getApexUrl();
            } else {
                console.warn('Authentication failed, redirecting to login...');
                window.location.href = `${getApexUrl()}/login`;
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                const savedDevEmail = localStorage.getItem('pulsus_dev_email');
                const matchedProfile =
                    DEV_PROFILES.find(p => p.email === savedDevEmail) || DEV_PROFILES[0];
                setUser(matchedProfile);
                setLoading(false);
                return;
            }
            console.error('Auth check error:', error);
            window.location.href = `${getApexUrl()}/login`;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        window.location.href = `${getApexUrl()}/login`;
    };

    const switchDevProfile = profileEmail => {
        const found = DEV_PROFILES.find(p => p.email === profileEmail);
        if (found) {
            localStorage.setItem('pulsus_dev_email', found.email);
            setUser(found);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md animate-pulse">
                    P
                </div>
                <div className="text-sm font-medium text-slate-500 animate-pulse">
                    Pulsus Operasyon Merkezi yükleniyor...
                </div>
            </div>
        );
    }

    const isVet = user?.pulsusRole === 'vet' || user?.role === 'admin';
    const isTechnician = user?.pulsusRole === 'technician';
    const isCaretaker = user?.pulsusRole === 'caretaker';

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                logout,
                refreshUser: checkAuth,
                isVet,
                isTechnician,
                isCaretaker,
                switchDevProfile,
                devProfiles: DEV_PROFILES
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
