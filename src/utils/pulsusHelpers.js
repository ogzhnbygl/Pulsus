export const VET_EMAIL = 'oguzhan.baygul@medeniyet.edu.tr';

export const DEFAULT_STAFF_DIRECTORY = [
    {
        email: 'oguzhan.baygul@medeniyet.edu.tr',
        name: 'Oğuzhan Baygül',
        pulsusRole: 'vet',
        title: 'Sorumlu Veteriner Hekim',
        defaultBackupEmail: 'kubra.celik@medeniyet.edu.tr'
    },
    {
        email: 'kubra.celik@medeniyet.edu.tr',
        name: 'Kübra Çelik',
        pulsusRole: 'technician',
        title: 'Veteriner Sağlık Teknikeri',
        defaultBackupEmail: 'gamze.demir@medeniyet.edu.tr'
    },
    {
        email: 'gamze.demir@medeniyet.edu.tr',
        name: 'Gamze Demir',
        pulsusRole: 'technician',
        title: 'Laboratuvar Teknikeri',
        defaultBackupEmail: 'kubra.celik@medeniyet.edu.tr'
    },
    {
        email: 'gokhan.sert@medeniyet.edu.tr',
        name: 'Gökhan Sert',
        pulsusRole: 'caretaker',
        title: 'Hayvan Bakıcısı / Temizlik Görevlisi',
        defaultBackupEmail: 'yusufenes.isik@medeniyet.edu.tr'
    },
    {
        email: 'yusufenes.isik@medeniyet.edu.tr',
        name: 'Yusuf Enes Işık',
        pulsusRole: 'caretaker',
        title: 'Hayvan Bakıcısı / Temizlik Görevlisi',
        defaultBackupEmail: 'gokhan.sert@medeniyet.edu.tr'
    }
];

export const DAYS_OF_WEEK = [
    { value: 1, short: 'Pzt', label: 'Pazartesi' },
    { value: 2, short: 'Sal', label: 'Salı' },
    { value: 3, short: 'Çar', label: 'Çarşamba' },
    { value: 4, short: 'Per', label: 'Perşembe' },
    { value: 5, short: 'Cum', label: 'Cuma' },
    { value: 6, short: 'Cmt', label: 'Cumartesi' },
    { value: 7, short: 'Paz', label: 'Pazar' }
];

export const MONTHS_TR = [
    { value: 1, short: 'Oca', label: 'Ocak' },
    { value: 2, short: 'Şub', label: 'Şubat' },
    { value: 3, short: 'Mar', label: 'Mart' },
    { value: 4, short: 'Nis', label: 'Nisan' },
    { value: 5, short: 'May', label: 'Mayıs' },
    { value: 6, short: 'Haz', label: 'Haziran' },
    { value: 7, short: 'Tem', label: 'Temmuz' },
    { value: 8, short: 'Ağu', label: 'Ağustos' },
    { value: 9, short: 'Eyl', label: 'Eylül' },
    { value: 10, short: 'Eki', label: 'Ekim' },
    { value: 11, short: 'Kas', label: 'Kasım' },
    { value: 12, short: 'Ara', label: 'Aralık' }
];

export const RITUS_CATEGORIES = {
    cleaning: { label: 'Kafes & Temizlik', color: 'bg-sky-50 text-sky-700 border-sky-200' },
    feeding: { label: 'Yem & Su', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    health: { label: 'Sağlık & Tarama', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    calibration: { label: 'Cihaz & Test', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    biosecurity: { label: 'Biyogüvenlik', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    admin: { label: 'İdari & Kayıt', color: 'bg-slate-100 text-slate-700 border-slate-300' },
    other: { label: 'Diğer Operasyon', color: 'bg-purple-50 text-purple-700 border-purple-200' }
};

export const RITUS_FREQUENCIES = {
    weekly: { label: 'Haftalık', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    monthly: { label: 'Aylık', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
    quarterly: { label: '3 Aylık', badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' }
};

export const SEQUA_PRIORITIES = {
    low: { label: 'Düşük', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
    medium: { label: 'Normal', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    high: { label: 'Yüksek', badge: 'bg-amber-50 text-amber-800 border-amber-300' },
    critical: { label: 'Acil / Kritik', badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' }
};

export const SEQUA_TASK_TYPES = {
    task: {
        label: 'Personel Görevi',
        shortLabel: 'Görev',
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    vet_request: {
        label: 'Hekim Muayene / Karar Talebi',
        shortLabel: 'Hekim Talebi',
        badge: 'bg-rose-50 text-rose-700 border-rose-200'
    },
    issue_report: {
        label: 'Problem / Arıza Bildirimi',
        shortLabel: 'Problem Bildirimi',
        badge: 'bg-amber-50 text-amber-800 border-amber-200'
    },
    external: {
        label: 'Üniversite / Dış Kaynak',
        shortLabel: 'Dış Birim',
        badge: 'bg-purple-50 text-purple-700 border-purple-200'
    }
};

export const UNIVERSITY_EXTERNAL_UNITS = [
    'Yapı İşleri ve Teknik Daire Başkanlığı (Mekanik / HVAC / Tesisat)',
    'Biyomedikal ve Kalibrasyon Servisi',
    'Bilgi İşlem Daire Başkanlığı (Ağ / Sensör / Otomasyon)',
    'İdari ve Mali İşler Daire Başkanlığı (Biyosidal / Haşere Mücadele)',
    'Çevre Yönetim ve Atık Koordinatörlüğü (Tıbbi Atık)',
    'Dış Yetkili Servis / Üretici Firma'
];

export function getRoleBadgeInfo(pulsusRole) {
    if (pulsusRole === 'vet') {
        return {
            label: 'Sorumlu Veteriner Hekim',
            shortLabel: 'Veteriner Hekim',
            className: 'bg-rose-50 text-rose-700 border-rose-200'
        };
    }
    if (pulsusRole === 'technician') {
        return {
            label: 'Tekniker',
            shortLabel: 'Tekniker',
            className: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
    }
    return {
        label: 'Hayvan Bakıcısı / Temizlik Görevlisi',
        shortLabel: 'Bakıcı / Temizlik',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
}

export function getMemberName(email, members = []) {
    if (!email) return 'Atanmadı';
    const clean = String(email).trim().toLowerCase();
    const found =
        members.find(m => String(m.email || '').toLowerCase() === clean) ||
        DEFAULT_STAFF_DIRECTORY.find(m => m.email.toLowerCase() === clean);
    if (found?.name) return found.name;
    return clean.split('@')[0];
}

export function getMemberByEmail(email, members = []) {
    if (!email) return null;
    const clean = String(email).trim().toLowerCase();
    return (
        members.find(m => String(m.email || '').toLowerCase() === clean) ||
        DEFAULT_STAFF_DIRECTORY.find(m => m.email.toLowerCase() === clean) ||
        null
    );
}

export function formatScheduledBadge(dateStr, scheduledTime = '09:00') {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return scheduledTime || '';
    }
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const utcDay = dt.getUTCDay();
    const dayIndex = utcDay === 0 ? 7 : utcDay;
    const dayShort = DAYS_OF_WEEK.find(x => x.value === dayIndex)?.short || '';
    const monthShort = MONTHS_TR.find(x => x.value === m)?.short || '';
    return `${dayShort} ${d} ${monthShort}${scheduledTime ? ` • ${scheduledTime}` : ''}`;
}

export function formatWeekRangeLabel(mondayStr) {
    if (!mondayStr || !/^\d{4}-\d{2}-\d{2}/.test(mondayStr)) return mondayStr || '';
    const sundayStr = addDaysStr(mondayStr, 6);
    const [, m1, d1] = mondayStr.split('-').map(Number);
    const [y2, m2, d2] = sundayStr.split('-').map(Number);
    const m1Short = MONTHS_TR.find(x => x.value === m1)?.short || '';
    const m2Short = MONTHS_TR.find(x => x.value === m2)?.short || '';
    if (m1 === m2) {
        return `${d1} - ${d2} ${m2Short} ${y2}`;
    }
    return `${d1} ${m1Short} - ${d2} ${m2Short} ${y2}`;
}

export function getMondayOfDateStr(input = new Date()) {
    let d;
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input.trim())) {
        const [y, m, day] = input.trim().slice(0, 10).split('-').map(Number);
        d = new Date(Date.UTC(y, m - 1, day));
    } else {
        const raw = input instanceof Date ? input : new Date(input);
        d = new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()));
    }
    const utcDay = d.getUTCDay();
    const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
    d.setUTCDate(d.getUTCDate() + diffToMonday);
    return d.toISOString().slice(0, 10);
}

export function addDaysStr(dateStr, days) {
    const [y, m, day] = dateStr.slice(0, 10).split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, day));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export function formatTemplateScheduleSummary(template) {
    if (!template) return '';
    const freq = template.frequency || 'weekly';
    const time = template.scheduledTime || '09:00';
    if (freq === 'weekly') {
        const days = (template.daysOfWeek || [])
            .map(d => DAYS_OF_WEEK.find(x => x.value === Number(d))?.short)
            .filter(Boolean)
            .join(', ');
        return `Her hafta: ${days || 'Belirtilmedi'} • ${time}`;
    }
    if (freq === 'monthly') {
        return `Her ayın ${template.dayOfMonth || 1}. günü • ${time}`;
    }
    if (freq === 'quarterly') {
        const months = (template.monthsOfQuarter || [1, 4, 7, 10])
            .map(m => MONTHS_TR.find(x => x.value === Number(m))?.short)
            .filter(Boolean)
            .join(', ');
        return `3 Ayda Bir (${months}) ${template.dayOfMonth || 1}. gün • ${time}`;
    }
    return time;
}

export async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json().catch(() => ({})) : {};

    if (!response.ok) {
        const err = new Error(data.error || `İstek başarısız oldu (${response.status})`);
        err.status = response.status;
        throw err;
    }

    return data;
}
