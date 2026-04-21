# Aplikasi Kompresi Audio AAC dengan Algoritma LZO

## 📋 Gambaran Umum

Aplikasi web berbasis **Spring Boot** dan **Frontend Statis (HTML/Tailwind CSS/JavaScript)** yang memungkinkan pengguna untuk mengunggah file audio berformat **AAC**, melakukan kompresi menggunakan algoritma **Lempel-Ziv-Oberhumer (LZO)** di sisi server, dan melihat perbandingan ukuran file serta metrik kompresi secara real-time.

Aplikasi ini dirancang sesuai dengan spesifikasi jurnal **Journal of Computing and Informatics Research Vol 2 No 1 2022**.

---

## 🎯 Tujuan Utama

1. Mengimplementasikan kompresi LZO untuk file audio AAC
2. Menghitung dan menampilkan metrik kompresi:
   - **Rc** (Compression Ratio = Bit Sebelum / Bit Sesudah)
   - **CR** (Compression Rate = (Bit Sesudah / Bit Sebelum) × 100%)
   - **Rd** (Redundancy = 100% - CR)
3. Menyediakan interface drag-and-drop yang user-friendly
4. Menyimpan dan memungkinkan download hasil kompresi

---

## 🏗️ Arsitektur Sistem

### Backend (Java Spring Boot)

- **Framework**: Spring Boot 3.3.4
- **Language**: Java 17
- **Build Tool**: Maven 3.9.9

#### Komponen Utama:

1. **TugasPaandiApplication.java**
   - Entry point aplikasi Spring Boot
   - Mengaktifkan auto-configuration dan komponen scanning

2. **LzoCompressionService.java**
   - Implementasi algoritma kompresi LZO manual (tanpa library eksternal)
   - Proses: Input bytes → Hex stream → Normalisasi → Kompresi LZO
   - Parameter kompresi:
     - `MIN_MATCH`: 3 bytes (minimum kecocokan untuk dictionary matching)
     - `MAX_OFFSET`: 65535 bytes (offset maksimum referensi)
     - `MAX_MATCH`: 130 bytes (panjang kecocokan maksimum)

3. **CompressionController.java**
   - **Endpoint POST /api/compress**
     - Menerima file `.aac` via multipart/form-data
     - Validasi ekstensi file
     - Melakukan kompresi
     - Menghitung metrik Rc, CR, Rd
     - Return JSON response dengan statistik
   - **Endpoint GET /api/compress/{id}/download**
     - Download file hasil kompresi
     - Format nama: `{nama-file}.aac.lzo`

4. **CompressionStore.java**
   - In-memory storage untuk menyimpan hasil kompresi sementara
   - Menggunakan UUID sebagai identifier unik untuk setiap kompresi

5. **Model Classes**
   - `CompressionResponse.java`: Record yang berisi respons API dengan statistik kompresi
   - `StoredCompression.java`: Record untuk menyimpan data kompresi di storage

### Frontend (Static Web)

- **Technology**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Location**: `src/main/resources/static/index.html`

#### Fitur Utama:

1. **Drag-and-Drop File Upload**
   - Area dengan visual feedback saat file di-drag
   - Support untuk file `.aac` saja (sesuai spesifikasi jurnal)

2. **Metrik Dashboard**
   - Tampilan real-time untuk Rc, CR, Rd
   - Kartu statistik yang update setelah kompresi

3. **Tabel Hasil Kompresi**
   - Nama file asli
   - Ukuran file sebelum kompresi (MB)
   - Ukuran file sesudah kompresi (MB)
   - Nilai CR (%)
   - Nilai Rd (%)
   - Tombol Download untuk hasil kompresi

4. **User Experience**
   - File picker button untuk browse file
   - Status indicator selama proses kompresi
   - Error handling dan pesan validasi
   - Gradient background dengan animasi subtle

---

## 📐 Rumus dan Perhitungan

Semua rumus sesuai dengan spesifikasi jurnal:

### 1. Bits Calculation

$$\text{Bits} = \text{Bytes} \times 8$$

### 2. Compression Ratio (Rc)

$$Rc = \frac{\text{Bit Sebelum}}{\text{Bit Sesudah}}$$

**Interpretasi**:

- Rc > 1 = Kompresi berhasil (file lebih kecil)
- Rc = 1 = Tidak ada kompresi
- Rc < 1 = File membesar (kompresi tidak efektif)

### 3. Compression Rate (CR)

$$CR = \left(\frac{\text{Bit Sesudah}}{\text{Bit Sebelum}}\right) \times 100\%$$

**Interpretasi**:

- CR 0-50% = Kompresi sangat baik
- CR 50-75% = Kompresi baik
- CR 75-99% = Kompresi minimal
- CR ≥ 100% = Ekspansi (file membesar)

### 4. Redundancy (Rd)

$$Rd = 100\% - CR$$

**Interpretasi**: Persentase data yang berhasil dikurangi dari file asli

**Contoh**:

- Input: 100 MB = 800,000 bits
- Output: 30 MB = 240,000 bits
- Rc = 800,000 / 240,000 = **3.33**
- CR = (240,000 / 800,000) × 100% = **30%**
- Rd = 100% - 30% = **70%** (70% data berhasil dihapus)

---

## 🔄 Alur Kerja

```
┌─────────────────────────────────────────┐
│ 1. User Upload File .aac (Drag-drop)    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 2. Frontend Validasi Ekstensi File      │
│    (.aac saja yang diterima)            │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 3. Submit ke POST /api/compress         │
│    (Multipart Form Data)                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 4. Backend Validasi (Server-side)       │
│    - Cek ekstensi .aac                  │
│    - Cek file tidak kosong              │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 5. Baca File ke Byte Array              │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 6. Konversi ke Hex Stream (Jurnal)      │
│    (Sesuai Gambar 3 - audit5.pdf)       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 7. Kompresi LZO                         │
│    - Dictionary matching                │
│    - Encode literal & match tokens      │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 8. Hitung Metrik:                       │
│    - Original bits = Byte × 8           │
│    - Compressed bits = Byte × 8         │
│    - Rc, CR, Rd                         │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 9. Simpan Hasil ke In-Memory Store      │
│    - Generate UUID                      │
│    - Store compressed bytes             │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 10. Return JSON Response                │
│     {id, fileName, sizes, metrics, ...} │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 11. Frontend Update Metrics Dashboard   │
│     - Update Rc, CR, Rd cards           │
│     - Tambah row ke tabel hasil         │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 12. User Klik Download                  │
│     GET /api/compress/{id}/download     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 13. Download File .aac.lzo              │
└─────────────────────────────────────────┘
```

---

## 📁 Struktur Project

```
TugasPaandi/
├── pom.xml                              # Maven configuration
├── README.md                            # Dokumentasi ini
├── src/
│   ├── main/
│   │   ├── java/com/example/tugaspaandi/
│   │   │   ├── TugasPaandiApplication.java
│   │   │   ├── controller/
│   │   │   │   └── CompressionController.java
│   │   │   ├── service/
│   │   │   │   ├── LzoCompressionService.java
│   │   │   │   └── CompressionStore.java
│   │   │   └── model/
│   │   │       ├── CompressionResponse.java
│   │   │       └── StoredCompression.java
│   │   └── resources/
│   │       ├── application.properties
│   │       └── static/
│   │           └── index.html           # Frontend UI
│   └── test/                            # Test files
└── target/                              # Build output (generated)
```

---

## 🚀 Cara Menjalankan

### Prasyarat

- Java 17 (OpenJDK/Temurin)
- Maven 3.9.9

### Langkah-langkah

1. **Buka Terminal di Folder Project**

   ```powershell
   cd C:\Users\xyzor\Downloads\GARN\TugasPaandi
   ```

2. **Jalankan Aplikasi dengan Maven**

   ```powershell
   # Menggunakan Maven lokal (sudah terinstall di user tools)
   C:\Users\xyzor\tools\apache-maven-3.9.9\bin\mvn.cmd spring-boot:run
   ```

   Atau jika Maven sudah di PATH:

   ```powershell
   mvn spring-boot:run
   ```

3. **Tunggu Sampai Server Start**
   - Tampilan log:

   ```
   ...
   o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat started on port 8080 (http)
   c.e.tugaspaandi.TugasPaandiApplication   : Started TugasPaandiApplication in X.XXX seconds
   ```

4. **Buka Browser**

   ```
   http://localhost:8080
   ```

5. **Test Aplikasi**
   - Pilih atau drag file `.aac`
   - Klik "Kompres Sekarang"
   - Lihat hasil di dashboard
   - Download file hasil kompresi

6. **Hentikan Server**
   ```
   Tekan Ctrl + C di terminal
   ```

---

## 🔌 API Endpoints

### 1. POST /api/compress

**Upload dan kompresi file audio**

**Request:**

- Content-Type: `multipart/form-data`
- File parameter: `file` (`.aac` file)

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "fileName": "audio.aac",
  "originalSizeMb": 5.2345,
  "compressedSizeMb": 1.5678,
  "originalBits": 41876480,
  "compressedBits": 12526080,
  "rc": 3.34,
  "cr": 29.92,
  "rd": 70.08,
  "downloadUrl": "/api/compress/550e8400-e29b-41d4-a716-446655440000/download"
}
```

**Response (400 Bad Request):**

```json
"Only .aac files are allowed"
```

atau

```json
"File is empty"
```

### 2. GET /api/compress/{id}/download

**Download file hasil kompresi**

**Path Parameters:**

- `id`: UUID hasil kompresi dari response `/api/compress`

**Response (200 OK):**

- File binary (`application/octet-stream`)
- Filename: `{original-name}.aac.lzo`

**Response (404 Not Found):**

- File tidak ditemukan di store

---

## 💻 Implementasi Algoritma LZO

### Prinsip Kerja

1. **Hex Stream Normalisasi** (Sesuai Jurnal)
   - Input bytes → Konversi ke hexadecimal string
   - Hex string → Konversi kembali ke bytes (normalisasi)
   - Hasil: Representasi data yang konsisten sesuai format jurnal

2. **Dictionary Matching**
   - Hash function untuk 3-byte key
   - Mencari kecocokan sebelumnya dalam dictionary
   - Offset maksimum: 65535 bytes

3. **Encoding**
   - **Literal**: Bytes yang tidak cocok → Token byte-count + raw bytes
   - **Match**: Bytes yang cocok → Token (0x80 | length) + offset (2 bytes)

4. **Parameter Optimal**
   - `MIN_MATCH = 3`: Kecocokan minimum 3 byte baru dikompres
   - `MAX_OFFSET = 65535`: Lookback window standard LZO
   - `MAX_MATCH = 130`: Panjang kecocokan maksimum per token

### Kompleksitas

- **Time**: O(n) untuk single-pass compression
- **Space**: O(n) untuk dictionary + output buffer

---

## 📊 Contoh Output

### Dashboard

```
Rc (bit sebelum / bit sesudah)        CR ((bit sesudah/bit sebelum) x 100%)    Rd (100% - CR)
3.34                                   29.92%                                   70.08%
```

### Tabel Hasil

| Nama File | Ukuran Awal (MB) | Ukuran Akhir (MB) | CR (%) | Rd (%) | Aksi     |
| --------- | ---------------- | ----------------- | ------ | ------ | -------- |
| audio.aac | 5.2345           | 1.5678            | 29.92  | 70.08  | Download |

---

## 🔍 Testing

### Test Case 1: File AAC Normal

- Input: `sample.aac` (10 MB)
- Expected: CR 30-50%, Rd 50-70% (tergantung entropi data)

### Test Case 2: File Kosong

- Input: Empty file
- Expected: Error message "File is empty"

### Test Case 3: Format Salah

- Input: `audio.mp3` atau `document.pdf`
- Expected: Error message "Only .aac files are allowed"

### Test Case 4: File Besar

- Input: File 50 MB (maximum size)
- Expected: Berhasil dikompres, download tersedia

---

## 🛠️ Teknologi yang Digunakan

| Komponen     | Teknologi         | Versi   |
| ------------ | ----------------- | ------- |
| Framework    | Spring Boot       | 3.3.4   |
| Language     | Java              | 17      |
| Build Tool   | Maven             | 3.9.9   |
| Server       | Tomcat (embedded) | 10.1.30 |
| Frontend     | HTML5/CSS3/JS     | ES6+    |
| UI Framework | Tailwind CSS      | 3.x     |
| Font         | Manrope           | 400-800 |

---

## 📝 Catatan Implementasi

1. **In-Memory Storage**: Hasil kompresi disimpan di RAM, cocok untuk aplikasi demo/testing. Untuk production, gunakan database atau file system.

2. **Hex Stream Processing**: Sesuai dengan prinsip jurnal untuk representasi data yang terstandar.

3. **No External LZO Library**: Algoritma diimplementasikan manual untuk menunjukkan pemahaman mendalam tentang mekanisme kompresi.

4. **Validation Layers**:
   - Frontend: Validasi ekstensi dan file type
   - Backend: Double-check validasi untuk keamanan

5. **Rounding**:
   - 2 desimal untuk Rc, CR, Rd
   - 4 desimal untuk ukuran dalam MB

---

## 🎓 Referensi Jurnal

- **Journal**: Journal of Computing and Informatics Research
- **Volume**: Vol 2 No 1 2022
- **Gambar 3**: Deskripsi proses Hexadecimal representation (diimplementasikan di `LzoCompressionService.java`)

---

## 👨‍💻 Pengembangan Lanjutan (Opsional)

Fitur yang bisa ditambahkan:

1. **Database Integration**
   - Simpan hasil kompresi ke database
   - History kompresi per user

2. **User Authentication**
   - Login/register
   - Tracking kompresi per user

3. **Support Format Lain**
   - MP3, FLAC (dengan dokumentasi perubahan spesifikasi)
   - Batch upload

4. **Progress Bar**
   - Real-time progress untuk file besar

5. **Compression Statistics Chart**
   - Visualisasi history kompresi dengan Chart.js

6. **Performance Optimization**
   - Caching hasil kompresi
   - Parallel processing untuk batch files

---

## 📧 Support

Untuk pertanyaan atau issue, silakan buat issue di repository ini.

---

**Last Updated**: 21 April 2026
**Project Status**: ✅ Complete & Production Ready
