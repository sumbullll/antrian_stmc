# Sistem Antrian Donor Darah Multi-Jalur

Aplikasi web untuk mengelola antrian donor darah dengan dua jalur pelayanan: Medical Center Pangkep dan PMI Makassar.

## Struktur File
- `index.html` - Halaman pendaftaran via QR Code untuk peserta.
- `admin.html` - Dashboard petugas medis untuk memanggil nomor antrian.
- `display.html` - Layar display TV di ruang tunggu (dilengkapi Text-to-Speech otomatis).
- `schema.sql` - Script SQL untuk membuat struktur database dan fungsi auto-increment antrian di Supabase.
- `js/config.js` - Konfigurasi koneksi ke Supabase.

## Cara Instalasi (Tahap Awal)

1. **Setup Supabase:**
   - Buat project baru di [Supabase](https://supabase.com/).
   - Buka menu **SQL Editor**, *paste* seluruh isi file `schema.sql` dan jalankan (*Run*).
   - Buka `Project Settings > API`, salin `Project URL` dan `anon/public key`.
   - Buka file `js/config.js` dan ganti `YOUR_PROJECT_ID` dan `YOUR_SUPABASE_ANON_KEY` dengan kunci milik Anda.

2. **Testing Lokal:**
   - Karena aplikasi menggunakan *ES modules* / Fetch API, sebaiknya jalankan menggunakan *Live Server* di VS Code, atau jalankan perintah python: `python -m http.server 8000` di dalam folder ini.
   - Buka browser:
     - Peserta Pangkep: `http://localhost:8000/?tim=P`
     - Peserta Makassar: `http://localhost:8000/?tim=M`
     - Admin Dashboard: `http://localhost:8000/admin.html`
     - TV Display: `http://localhost:8000/display.html`

3. **Deploy ke Vercel:**
   - *Commit* semua file ini ke *repository* GitHub Anda.
   - Login ke [Vercel](https://vercel.com/) dan import *repository* tersebut.
   - Deploy tanpa perlu *build command* khusus (Vercel otomatis mendeteksi HTML statis).
   - Pastikan URL *production* nantinya digunakan untuk meng- *generate* QR Code.
     - QR Pangkep = `https://[URL-VERCEL-ANDA]/?tim=P`
     - QR Makassar = `https://[URL-VERCEL-ANDA]/?tim=M`

## Text-to-Speech (Catatan Penting)
Browser modern seperti Chrome memiliki kebijakan *Autoplay Policy*. Saat pertama kali membuka halaman `display.html`, petugas mungkin perlu menekan sembarang tempat di layar atau meng-klik tombol "Init Audio" (di pojok kiri bawah) agar suara *Text-to-Speech* bisa keluar secara otomatis selanjutnya.
