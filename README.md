# Pulsus - Laboratuvar Rutin (Ritus) & İş Akışı (Sequa) Yönetim Sistemi

> **WildType / Antigravity** ekosisteminin operasyonel kalp atışı. Deney hayvanları uygulama ve araştırma merkezleri için geliştirilmiş; **Circa** izin entegrasyonlu, **3 kademeli yedek devir zincirli** ve **denetim/eskalasyon** odaklı çift motorlu görev platformu.

---

## 🚀 Temel Özellikler

- **🔄 Ritus (Periyodik Rutin Motoru):**
  - Haftalık, Aylık ve Çeyreklik (3 Aylık) rutin görev şablonları ve alt kontrol listeleri (`checklist`).
  - **Cuma 16:30 Otomatik İş Paketi Dağıtımı:** Her Cuma 16:30'da gelecek haftanın (`W+1`) tüm görevlerini mükerrer kayıt üretmeden (idempotent) otomatik hazırlar.
  - **Hafta Ortası Ay & Çeyrek Geçiş Desteği:** Haftanın ortasına (örneğin Çarşamba veya Perşembe gününe) denk gelen aylık/çeyreklik görevleri hiç kaçırmadan ilgili haftanın paketine dahil eder.
  - **Esnek Şablon Güncelleme Kapsamı (`updateScope`):** Veteriner Hekim bir şablonu güncellediğinde değişikliğin **sadece gelecek haftadan itibaren (`next_week`)** mi yoksa **mevcut haftanın aktif görevlerine de (`current_week`)** mi uygulanacağını seçebilir.
- **🏖️ Circa İzin Entegrasyonu ve 3 Kademeli Yedek Zinciri:**
  - `Circa_db.time_offs` üzerindeki onaylı günlük ve saatlik izinleri otomatik sorgular.
  - **Asil Sorumlu ➔ Yedek Sorumlu ➔ Sorumlu Veteriner Hekim (`vet_fallback`)** zinciri sayesinde hiçbir görev izin nedeniyle sahipsiz kalmaz.
- **⚡ Sequa (Dinamik Görev, Bildirim & Dış Birim Takibi):**
  - Bakıcıların yukarı yönlü **Problem Bildirimi (`issue_report`)** açabilmesi ve Tekniker/Veteriner Hekimin bunu atanmış göreve veya dış birim işine dönüştürebilmesi (`convert_to_task`).
  - Teknikerlerin acil klinik durumlarda doğrudan Veteriner Hekime **Klinik Muayene Çağrısı (`vet_request`)** açabilmesi.
  - Üniversite **Yapı İşleri Daire Başkanlığı** gibi dış birimlerle yürütülen arıza/bakım işlerinin (`external`) evrak/ticket numarasıyla takibi.
- **🔍 Denetim, Tekrarlatma ve Ritus ➔ Sequa Eskalasyon Köprüsü:**
  - Bakıcı tarafından tamamlanan görevler Tekniker denetimine (`pending_review`) düşer; eksik işler gerekçeli notla tekrarlatılır (`needs_revision`) ve revizyon sayacı (`revisionCount`) rapora işlenir.
  - Rutin görev esnasında tespit edilen ciddi sorunlar tek tıkla Veteriner Hekime sevk edilir (`escalate_to_vet`) ve otomatik olarak bağlı bir Sequa görevi (`spawnSequa`) oluşturulur.

---

## 👥 Laboratuvar Ekibi ve Rol Tablosu

| Personel | E-posta | Pulsus Rolü | Kurumsal Ünvan | Varsayılan Yedek |
| :--- | :--- | :---: | :--- | :--- |
| **Oğuzhan Baygül** | `oguzhan.baygul@medeniyet.edu.tr` | `vet` | Sorumlu Veteriner Hekim | `kubra.celik@medeniyet.edu.tr` |
| **Kübra Çelik** | `kubra.celik@medeniyet.edu.tr` | `technician` | Veteriner Sağlık Teknikeri | `gamze.demir@medeniyet.edu.tr` |
| **Gamze Demir** | `gamze.demir@medeniyet.edu.tr` | `technician` | Laboratuvar Teknikeri | `kubra.celik@medeniyet.edu.tr` |
| **Gökhan Sert** | `gokhan.sert@medeniyet.edu.tr` | `caretaker` | Hayvan Bakıcısı / Temizlik Görevlisi | `yusufenes.isik@medeniyet.edu.tr` |
| **Yusuf Enes Işık** | `yusufenes.isik@medeniyet.edu.tr` | `caretaker` | Hayvan Bakıcısı / Temizlik Görevlisi | `onur.yesilyurt@medeniyet.edu.tr` |

---

## ⚙️ Ortam Değişkenleri (`.env`)

| Değişken Adı | Zorunlu | Açıklama |
| :--- | :---: | :--- |
| `MONGODB_URI` | **Evet** | Apex, Circa ve Pulsus veritabanlarını barındıran MongoDB Atlas bağlantı adresi |
| `JWT_SECRET` | **Evet** | Apex SSO ile paylaşılan HS256 JWT doğrulama anahtarı |
| `NODE_ENV` | Hayır | `development` veya `production` |
| `VERCEL_ENV` | Hayır | `production`, `preview` veya `development` (`production` dışında otomatik `*_test_db` kullanılır) |
| `FORCE_PROD_DB` | Hayır | Yerel ortamda canlı veritabanını zorlamak için `true` (Testlerde asla açılmaz) |

---

## 🛠️ Kurulum ve Komutlar

```bash
# Bağımlılıkları yükle
npm install

# Yerel geliştirme sunucusunu başlat (Vite + Serverless API Middleware)
npm run dev

# Üretim (Production) derlemesi al
npm run build

# ESLint kod kalitesi kontrolü
npm run lint
```

### Otomatik API & İş Mantığı Testleri (Apex Üzerinden)
Pulsus'un tüm güvenlik, rol, Cuma 16:30 dağıtım, hafta ortası ay geçişi, Circa izin devri ve denetim/eskalasyon testleri `Pulsus_test_db` üzerinde izole olarak çalıştırılır:

```bash
cd ../Apex
node --test tests/api/pulsus.test.js
```

---

## 📖 İlgili Dokümanlar

- [BLUEPRINT.md](./BLUEPRINT.md) — Ürün vizyonu, Ritus & Sequa felsefesi, 5 kişilik ekip kuralları ve yol haritası.
- [TECHNICAL.md](./TECHNICAL.md) — Mimari diyagramlar, MongoDB şemaları ve API uç nokta referansı.
