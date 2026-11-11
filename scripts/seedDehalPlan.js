/**
 * DEHAL — Haftalık Temizlik ve Destek İş Planı Seeder
 *
 * Imports the complete weekly operational cleaning and support schedule into
 * Pulsus (Pulsus_test_db) and distributes the runs for the current week.
 */

import 'dotenv/config';
import process from 'node:process';
import clientPromise, { getDbName } from '../lib/mongodb.js';
import { distributeWeekPackage, getMondayOfDate } from '../lib/ritusEngine.js';

const GOKHAN = 'gokhan.sert@medeniyet.edu.tr';
const YUSUF = 'yusufenes.isik@medeniyet.edu.tr';
const KUBRA_TEK = 'kubra.celik@medeniyet.edu.tr';
const GAMZE_TEK = 'gamze.demir@medeniyet.edu.tr';
const VET = 'oguzhan.baygul@medeniyet.edu.tr';

export const DEHAL_TEMPLATES = [
    // -------------------------------------------------------------
    // HER GÜN (Pazartesi – Cuma)
    // -------------------------------------------------------------
    {
        title: 'Açılış Turu: Hayvan Odaları & Ortak Alan Hızlı Kontrol',
        description: 'Açılış turu: hayvan odaları (su-yem, ölü/hasta/kaçak, ıslak talaş, kafes hasarı, oda sıcaklık-nem, kadavra dolabı <7 °C) + ortak alan/depo hızlı kontrol (su akıntısı, atık, yem-talaş stoğu, haşere belirtisi). Pazartesi: nöbetçi devir notu da okunur. Yetki: S+ (Hayvana dokunma sertifikalı).',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [1, 2, 3, 4, 5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '08:00',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Hayvan odaları su ve yem seviyeleri kontrol edildi',
            'Ölü, hasta veya kaçak hayvan kontrolü yapıldı',
            'Islak talaş ve kafes hasarı kontrol edildi',
            'Oda sıcaklık ve nem değerleri kontrol edildi',
            'Kadavra dolabı (<7 °C) kontrol edildi',
            'Ortak alan ve depo (su akıntısı, atık, yem-talaş stoğu, haşere) kontrol edildi',
            'Pazartesi: Hafta sonu nöbetçi devir notu okundu'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Gökhan Sert Kapanış Devri: Suluk/Islak Talaş & Eksik Bildirimi',
        description: 'Kapanış devri: suluk akıtması / ıslak talaş son kontrolü (ıslanan kafes varsa teknikere bildir; hayvanı tekniker temiz kafese alır), gözlemler, eksik stok, arıza, yapılmayan işler; teknikere imza.',
        category: 'admin',
        frequency: 'weekly',
        daysOfWeek: [1, 2, 3, 4, 5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '16:00',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Suluk akıtması ve ıslak talaş son kontrolü yapıldı',
            'Islanan kafes varsa teknikere haber verildi',
            'Gözlemler, eksik stok, arıza ve yapılmayan işler kaydedildi',
            'Teknikere devir teslim imzası alındı'
        ],
        contextRef: null,
        isActive: true
    },

    // -------------------------------------------------------------
    // PAZARTESİ
    // -------------------------------------------------------------
    {
        title: 'Pazartesi Kirli Kafes Boşaltma ve Yıkama (Fare + Sıçan)',
        description: 'Teknikerlerden kirli kafesleri teslim al; boşalt ve yıka (fare + sıçan; sadece kirli kafesler). Hayvan değişimi teknikerlerde.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '08:30',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Kirli fare ve sıçan kafesleri teknikerlerden teslim alındı',
            'Kafes talaş ve atıkları çöp torbalarına boşaltıldı',
            'Kafesler yıkama ünitesine alındı ve yıkandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Kafes Yıkama Devamı + Temiz Kafesleri Kurutma ve İstifleme',
        description: 'Kafes yıkama devamı + temiz kafesleri kurutma/istifleme.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1, 4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '10:30',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Yıkanan kafesler kurutma rafına yerleştirildi',
            'Kurutulan temiz kafesler nizami istiflendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Fare ve Sıçan Bakım Odaları Temizliği (Gökhan SERT)',
        description: 'Fare ve sıçan bakım odaları temizliği (yer süpürme/silme, raf silme/süpürme).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '11:15',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Bakım odaları zeminleri süpürüldü ve paspaslandı',
            'Kafes rafları dezenfektanlı bezle silindi ve süpürüldü'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Su Şişesi, Damlalık, Kapak ve Yemlik Yıkama — Fare Odası',
        description: 'Su şişesi, damlalık, kapak, yemlik, kart tutucu yıkama — FARE odası.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '13:00',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Suluk şişeleri fırçalandı ve durulandı',
            'Damlalık, kapak ve yemlikler dezenfekte edildi',
            'Kart tutucular temizlenip kurutuldu'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Kafes Yıkama Makinesi Program Sonu Kontrolü (Pazartesi)',
        description: 'Kafes yıkama makinesi program sonu kontrolü (hata kodu yok, kapak/tahliye temiz).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '13:45',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Makine ekranında hata kodu olmadığı doğrulandı',
            'Kapak sızdırmazlığı ve tahliye süzgeci temizlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Temiz Kafes Deposu Sayımı ve Hasar Ayıklama (Pazartesi)',
        description: 'Temiz kafes deposu sayımı + hasarlı kafes/ızgara ayıklama.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '14:00',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Temiz kafes, kapak ve ızgara stokları sayıldı',
            'Kırık, çatlak veya hasarlı malzemeler ayrıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Kafes Yıkama Makinesi İçi, Hortum ve Dış Yüzey Temizliği',
        description: 'Kafes yıkama makinesi içi/hortum/tahliye + dış yüzey temizliği (gün sonunda makine temiz bırakılır).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '15:00',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Makine içi ve püskürtme nozulları kontrol edildi',
            'Tahliye hortumu ve filtreler yıkandı',
            'Dış paslanmaz yüzeyler silindi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Kapanış Öncesi Kontrol: Depo, Atık ve Eksik Bildirimi',
        description: 'Kapanış öncesi kontrol: depo, atık, eksik bildirim.',
        category: 'admin',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '15:45',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Depo kapıları kilit ve düzeni kontrol edildi',
            'Atık alanı temizliği ve eksikler teknikere raporlandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Temiz Kafeslere Talaş Koyma ve Depoya Kaldırma (Pazartesi)',
        description: 'Temiz kafeslere talaş koy; temiz kafes deposuna kaldır.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '14:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Otoklavlı talaş temiz kafeslere uygun kalınlıkta dolduruldu',
            'Hazırlanan kafesler temiz kafes deposuna istiflendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Pazartesi Koridor Temizliği (Yer Silme Otomatı)',
        description: 'Koridor temizliği (yer silme otomatı).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '15:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Otomat dezenfektan tankı dolduruldu',
            'Tüm ana ve bağlantı koridorları makineyle silindi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Misafir Odası, Toplantı Salonu ve Seminer Odası Temizliği',
        description: 'Misafir odası, toplantı salonu, seminer odası temizliği.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '16:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Masalar, sandalyeler ve yüzeyler silindi',
            'Zemin süpürüldü ve paspaslandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Çalışma Odaları Çöp Kontrolü',
        description: 'Çalışma odaları çöp kontrolü.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '16:45',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Ofis ve laboratuvar çalışma odası çöpleri kontrol edildi ve toplandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Gün Sonu Kontrolü & Çöp/Atık Ayrımı (Pazartesi)',
        description: 'Gün sonu: tüm alanların son kontrolü + çöplerin atılması + atık ayrımı.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '17:30',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Tüm alanların son kontrolleri yapıldı',
            'Çöpler atıldı, tıbbi ve evsel atık ayrımı denetlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Kapanış Devri: Gözlem ve Eksik Bildirimi (Pazartesi)',
        description: 'Kapanış devri: gözlem/eksik bildirimi teknikere imza.',
        category: 'admin',
        frequency: 'weekly',
        daysOfWeek: [1],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '18:45',
        primaryAssignee: YUSUF,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Günlük eksik ve gözlemler teknikere aktarıldı',
            'Devir teslim imzalandı'
        ],
        contextRef: null,
        isActive: true
    },

    // -------------------------------------------------------------
    // SALI
    // -------------------------------------------------------------
    {
        title: 'Otoklav Hazırlık ve Talaş Yükleme',
        description: 'Otoklav hazırlık + talaş yükleme.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [2],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '08:30',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Talaş paketleri otoklav sepetlerine nizami yerleştirildi',
            'Sterilizasyon indikatör şeridi konuldu'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Otoklav Çevrim ve İndikatör Kaydı',
        description: 'Otoklav çevrim + indikatör kaydı.',
        category: 'admin',
        frequency: 'weekly',
        daysOfWeek: [2],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '09:30',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Sterilizasyon çevrimi başlatıldı ve tamamlandı',
            'İndikatör şeridinin renk dönüşümü kontrol edildi ve kayıt defterine işlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Temiz Kafes Stoğu Sayımı ve Hasar Ayıklama (Salı)',
        description: 'Temiz kafes stoğu sayımı + kafes/ızgara/kapak hasar ayıklama.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [2],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '10:30',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Kafes, ızgara ve kapak stokları kontrol edildi',
            'Hasarlı veya aşınmış parçalar ayrıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Post-op, Basit Girişim ve Mikrocerrahi Odaları Temizliği',
        description: 'Post-op Odası, Basit Girişim Odası ve Mikrocerrahi Odası temizliği.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [2],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '13:00',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Post-op odası zemin ve ameliyat masası yüzeyleri dezenfekte edildi',
            'Basit girişim odası zemin ve tezgahları silindi',
            'Mikrocerrahi odası toz ve atıklardan arındırıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Operasyon, Kimyasal Hazırlık ve Prosedür Odaları Temizliği',
        description: 'Operasyon Odası, Kimyasal Hazırlık Odası, Prosedür-1 Odası ve Prosedür-2 Odası temizliği.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [2],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '14:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Operasyon odası cerrahi zemin ve armatürleri temizlendi',
            'Kimyasal hazırlık odası çeker ocak tezgahı silindi',
            'Prosedür-1 ve Prosedür-2 odaları paspaslandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'İdari Ofisler Temizliği',
        description: 'Ofis temizliği.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [2],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '16:15',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Ofis çalışma masaları ve zeminleri temizlendi',
            'Ofis çöp kutuları boşaltıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Kadın ve Erkek Personel Soyunma Odaları Temizliği',
        description: 'Bayan/erkek soyunma odası temizliği.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [2],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '17:15',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Soyunma dolapları dışı ve oturma bankları silindi',
            'Zemin dezenfektanla paspaslandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Gün Sonu Kontrolü & Atık Ayrımı (Salı)',
        description: 'Gün sonu: tüm alanların son kontrolü + çöplerin atılması + atık ayrımı.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [2],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '18:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Tüm alanların son kontrolleri yapıldı ve çöpler boşaltıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Kapanış Devri: Teknikere İmza (Salı)',
        description: 'Kapanış devri: gözlem/eksik bildirimi teknikere imza.',
        category: 'admin',
        frequency: 'weekly',
        daysOfWeek: [2],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '18:45',
        primaryAssignee: YUSUF,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Gözlem ve eksikler bildirildi, devir formu imzalandı'
        ],
        contextRef: null,
        isActive: true
    },

    // -------------------------------------------------------------
    // ÇARŞAMBA
    // -------------------------------------------------------------
    {
        title: 'Tavşan Altlıkları ve Kafes Temizliği',
        description: 'Tavşan altlıkları + kafes temizliği. Yetki: S+ (Hayvana dokunma sertifikalı).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '08:30',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Tavşan kafes altlık tepsileri boşaltıldı',
            'Kafes ızgaraları ve tepsiler yıkandı ve dezenfekte edildi',
            'Temiz altlık serilip kafes hazırlandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Tıbbi Atık Teslimi ve Tutanak İmzası',
        description: 'Tıbbi atık teslimi + tutanak (ağırlık, kod, imza).',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '09:15',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Kırmızı tıbbi atık poşetleri tartıldı ve ağırlık kaydedildi',
            'Yetkili atık firması/belediye görevlisine teslim tutanağı imzalatıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Laboratuvar Odaları Kontrolü (Checklist)',
        description: 'Laboratuvar odaları kontrolü (checklist).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '09:45',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Laboratuvar tezgahları ve zemin temizliği kontrol edildi',
            'Tehlikeli atık ve sarf kutuları kontrol edildi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Kafes Rafı (Rack) Silme (Haftalık)',
        description: 'Kafes rafı/rack silme (haftalık).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '10:30',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'IVC ve standart rack rafları dezenfektan solüsyonla silindi',
            'Hava bağlantı kanalları dış yüzeyleri tozdan arındırıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Dren ve Lavabo Biyofilm Dezenfeksiyonu',
        description: 'Dren/lavabo dezenfeksiyonu (biofilm).',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '11:15',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Zemin drenaj sifonlarına dezenfektan döküldü',
            'Lavabo giderleri biyofilm oluşumuna karşı fırçalanıp yıkandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yıkama, Dezenfeksiyon, Sterilizasyon ve Temiz Depo Temizliği',
        description: 'Yıkama ve dezenfeksiyon alanı, Sterilizasyon alanı ve Temiz Kafes deposu temizliği.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '13:00',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Yıkama ünitesi zemin ve tezgahları dezenfekte edildi',
            'Sterilizasyon alanı temizlendi',
            'Temiz kafes deposu süpürüldü ve silindi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Su Şişesi, Damlalık, Kapak ve Yemlik Yıkama — Sıçan Odası',
        description: 'Su şişesi, damlalık, kapak, yemlik, kart tutucu yıkama — SIÇAN odası.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '08:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Sıçan sulukları fırçalandı ve durulandı',
            'Yemlik ve kartlıklar dezenfekte edildi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Erkek Lavabosu Temizliği',
        description: 'Erkek lavabosu temizliği.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '09:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Lavabo ve pisuvarlar dezenfektanla ovuldu',
            'Sıvı sabun, kağıt havlu ve zemin paspası tamamlandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Mutfak Temizliği (Zemin ve Tezgah)',
        description: 'Mutfak temizliği (zemin ve tezgah).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '09:45',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Mutfak tezgahı ve lavabosu silindi',
            'Zemin süpürülüp paspaslandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Çöp Kovaları Yıkama ve Dezenfeksiyon',
        description: 'Çöp kovaları yıkama/dezenfeksiyon.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '10:30',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Kovalar boşaltılıp dezenfektanlı suyla yıkandı',
            'Kurutulup yeni çöp poşetleri takıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Depolama Alanları Temizliği (Yem, Altlık ve Temizlik Odası)',
        description: 'Depolama alanı temizliği: Yem deposu, Altlık Deposu ve Temizlik Odası.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '13:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Yem deposu palet araları süpürüldü',
            'Altlık deposu tozdan arındırıldı',
            'Temizlik odası ekipmanları düzenlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Çarşamba Koridor Temizliği (Yer Silme Otomatı)',
        description: 'Koridor temizliği (yer silme otomatı).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '14:15',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Tüm koridorlar yer silme otomatı ile dezenfekte edildi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Gün Sonu Kontrolü & Çöplerin Atılması (Çarşamba)',
        description: 'Gün sonu: tüm alanların son kontrolü + çöplerin atılması + atık ayrımı.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '15:15',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Tüm alanlar kontrol edildi, atıklar atıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Kapanış Devri: Teknikere İmza (Çarşamba)',
        description: 'Kapanış devri: gözlem/eksik bildirimi teknikere imza.',
        category: 'admin',
        frequency: 'weekly',
        daysOfWeek: [3],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '16:00',
        primaryAssignee: YUSUF,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Devir formu imzalandı'
        ],
        contextRef: null,
        isActive: true
    },

    // -------------------------------------------------------------
    // PERŞEMBE
    // -------------------------------------------------------------
    {
        title: 'Perşembe Kontrolü Sonrası Kirli Kafes Yıkama',
        description: 'Perşembe kontrolü sonrası kirlenen kafesleri teknikerlerden teslim al; boşalt ve yıka. Kirlenen kafes yoksa yıkama yapılmaz.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '08:30',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Tekniker kontrolü sonrası kirli kafesler teslim alındı',
            'Kafesler boşaltıldı ve yıkandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Otoklav Edilmiş ve Ham Talaş Deposu Stok Kontrolü',
        description: 'Otoklav edilmiş talaş stok seviyesi + ham talaş deposu kontrolü.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '11:15',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Otoklavlı talaş stok miktarı kontrol edildi',
            'Ham talaş deposu kuru ve düzenli tutulduğu doğrulandı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Kafes Yıkama Makinesi İçi, Tahliye ve Program Kontrolü',
        description: 'Kafes yıkama makinesi içi/tahliye temizliği + program sonu kontrolü (hata kodu yok).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '13:00',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Program hatasız tamamlandı',
            'Makine içi filtre ve tahliye süzgeci temizlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Göz Duşu, Acil Duş Haftalık Flush ve İlk Yardım Çantası Kontrolü',
        description: 'Göz duşu/acil duş haftalık flush + ilk yardım çantası kontrolü.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '13:45',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Göz yıkama istasyonu 3 dakika akıtılarak tortudan arındırıldı',
            'Acil vücut duşu çekme kolu test edildi',
            'İlk yardım çantası malzeme içeriği kontrol edildi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Haşere İstasyonları Kontrolü (Yem Deposu, Çöp, Dren)',
        description: 'Haşere istasyonları kontrolü (yem deposu, çöp, dren).',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '14:30',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Yem deposu yemleme/yem kapanları kontrol edildi',
            'Çöp ve drenaj noktaları haşere izleri incelendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Bina Çatı Gider Kontrolü ve Çatının Temizliği (Gökhan SERT)',
        description: 'Bina çatı gider kontrolü ve çatının temizliği (Gökhan SERT).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '15:00',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Çatı olukları ve su tahliye boruları kontrol edildi',
            'Tıkanıklığa yol açan yaprak ve atıklar temizlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Temiz Kafeslere Talaş Koyma ve Depoya Kaldırma (Perşembe)',
        description: 'Temiz kafeslere talaş koy; temiz kafes deposuna kaldır.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '12:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Kafeslere talaş serildi ve depoya istiflendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Fare ve Sıçan Bakım Odaları Temizliği (Yusuf IŞIK)',
        description: 'Fare ve sıçan bakım odaları temizliği (yer süpürme/silme, raf silme/süpürme).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '13:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Bakım odaları yerleri süpürüldü ve silindi',
            'Raflar temizlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Bina Çatı Gider Kontrolü ve Çatının Temizliği (Yusuf IŞIK)',
        description: 'Bina çatı gider kontrolü ve çatının temizliği (Yusuf IŞIK).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '15:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Çatı yüzeyi süpürüldü ve gider süzgeçleri temizlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Gün Sonu Kontrolü & Çöplerin Atılması (Perşembe)',
        description: 'Gün sonu: tüm alanların son kontrolü + çöplerin atılması + atık ayrımı.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '16:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Tüm alanlar kontrol edildi, atıklar atıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Kapanış Devri: Teknikere İmza (Perşembe)',
        description: 'Kapanış devri: gözlem/eksik bildirimi teknikere imza.',
        category: 'admin',
        frequency: 'weekly',
        daysOfWeek: [4],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '16:45',
        primaryAssignee: YUSUF,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Devir formu imzalandı'
        ],
        contextRef: null,
        isActive: true
    },

    // -------------------------------------------------------------
    // CUMA
    // -------------------------------------------------------------
    {
        title: 'Ham Talaş Deposu ve Otoklav Edilmiş Stok Kontrolü',
        description: 'Ham talaş deposu + otoklav edilmiş stok kontrolü.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '08:30',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Haftalık talaş sarfiyatı hesaplandı ve kalan stok kaydedildi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yangın Dolabı Önü, Çıkış Yolu ve Acil Çıkış Aydınlatma Kontrolü',
        description: 'Yangın dolabı önü/çıkış yolu + acil çıkış-aydınlatma görsel kontrolü.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '09:30',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Yangın tüpü ve panolarının önü boş ve engelsiz',
            'Acil kaçış yönlendirme lambaları kontrol edildi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Temiz Kafes Deposu Haftalık Sayım ve Hasarlı Kafes Ayıklama',
        description: 'Temiz kafes deposu haftalık sayım + hasarlı kafes/ızgara ayıklama.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '10:15',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Haftalık temiz kafes envanteri çıkarıldı',
            'Hasarlı kafesler imha/onarım alanına ayrıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Cuma Koridor Temizliği (Yer Silme Otomatı)',
        description: 'Koridor temizliği (yer silme otomatı).',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '11:00',
        primaryAssignee: GOKHAN,
        backupAssignee: YUSUF,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Tüm koridorlar yer silme otomatıyla yıkandı ve kurutuldu'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Haftalık Özet ve Nöbetçiye Devir (Gökhan SERT)',
        description: 'Haftalık özet + nöbetçiye devir.',
        category: 'admin',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '15:30',
        primaryAssignee: GOKHAN,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Haftalık temizlik ve destek özeti hazırlandı',
            'Hafta sonu nöbetçi teknikere tüm kritik durumlar ve devir formu aktarıldı'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Temizlik Malzemeleri Dezenfeksiyonu ve KKD Stok Kontrolü',
        description: 'Temizlik malzemeleri dezenfeksiyonu + KKD stok kontrolü.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '08:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Paspaslar, kovalar ve temizlik bezleri dezenfekte edildi',
            'Eldiven, maske, galoş ve önlük (KKD) stokları kontrol edildi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Giriş ve Terlik Alanı Temizliği',
        description: 'Giriş/terlik alanı temizliği.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '09:00',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Bina giriş basamakları ve bariyer paspaslar temizlendi',
            'Vivaryum terlik rafı dezenfekte edildi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Davranış, Dekontaminasyon ve Biyokimya Odaları Temizliği',
        description: 'Fare Davranış Odası, Sıçan Davranış Odası, Dekontaminasyon Odası, Biyokimyasal Analiz Odası temizliği.',
        category: 'cleaning',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '09:45',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Fare ve sıçan davranış odaları zeminleri silindi',
            'Dekontaminasyon odası dezenfekte edildi',
            'Biyokimyasal analiz odası süpürüldü ve temizlendi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Gün Sonu Kontrolü & Çöplerin Atılması (Cuma)',
        description: 'Gün sonu: tüm alanların son kontrolü + çöplerin atılması + atık ayrımı.',
        category: 'biosecurity',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '11:45',
        primaryAssignee: YUSUF,
        backupAssignee: GOKHAN,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Haftanın son mesai kontrolü yapıldı, çöpler tahliye edildi'
        ],
        contextRef: null,
        isActive: true
    },
    {
        title: 'Yusuf Işık Kapanış Devri: Teknikere İmza (Cuma)',
        description: 'Kapanış devri: gözlem/eksik bildirimi teknikere imza.',
        category: 'admin',
        frequency: 'weekly',
        daysOfWeek: [5],
        dayOfMonth: null,
        monthsOfQuarter: [],
        scheduledTime: '12:45',
        primaryAssignee: YUSUF,
        backupAssignee: KUBRA_TEK,
        primaryReviewer: KUBRA_TEK,
        backupReviewer: GAMZE_TEK,
        checklist: [
            'Cuma mesai bitimi teknikere devir teslim formu imzalandı'
        ],
        contextRef: null,
        isActive: true
    }
];

async function seed() {
    const client = await clientPromise;
    const db = client.db(getDbName('Pulsus_db'));
    console.log(`[seedDehalPlan] Connecting to database: ${db.databaseName}`);

    const templatesCol = db.collection('ritus_templates');
    const runsCol = db.collection('ritus_runs');
    const metaCol = db.collection('system_meta');

    // 1. Clear old demo templates and runs in test environment
    const delTemplates = await templatesCol.deleteMany({});
    console.log(`[seedDehalPlan] Removed ${delTemplates.deletedCount} old templates.`);

    const currentMonday = getMondayOfDate(new Date()); // e.g. 2026-11-09
    const delRuns = await runsCol.deleteMany({ weekStart: currentMonday });
    console.log(`[seedDehalPlan] Cleared existing runs for current week ${currentMonday}: ${delRuns.deletedCount}`);

    // 2. Insert DEHAL templates
    const now = new Date();
    const docsToInsert = DEHAL_TEMPLATES.map(t => ({
        ...t,
        createdBy: VET,
        createdAt: now,
        updatedAt: now
    }));

    const insertResult = await templatesCol.insertMany(docsToInsert);
    console.log(`[seedDehalPlan] Successfully seeded ${insertResult.insertedCount} DEHAL templates.`);

    // 3. Mark system meta so default templates don't overwrite
    await metaCol.updateOne(
        { _id: 'ritus_templates_seeded' },
        { $set: { seeded: true, source: 'DEHAL_WEEKLY_PLAN', updatedAt: now } },
        { upsert: true }
    );

    // 4. Distribute runs for current week (2026-11-09)
    console.log(`[seedDehalPlan] Distributing runs for week: ${currentMonday}...`);
    const distResult = await distributeWeekPackage(client, db, currentMonday);
    console.log(
        `[seedDehalPlan] Distribution complete! Created ${distResult.createdRuns.length} runs (Existing: ${distResult.existingCount}).`
    );

    // 5. Query breakdown by day
    const runs = await runsCol.find({ weekStart: currentMonday }).toArray();
    const byDay = {};
    for (const r of runs) {
        byDay[r.scheduledDate] = (byDay[r.scheduledDate] || 0) + 1;
    }
    console.log('[seedDehalPlan] Runs distributed by date:', byDay);

    process.exit(0);
}

seed().catch(err => {
    console.error('[seedDehalPlan] Fatal error:', err);
    process.exit(1);
});
