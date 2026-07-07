# Panduan Pembaruan Aplikasi (Redeploy) di VPS Ubuntu

Dokumen ini berisi langkah-langkah untuk melakukan *update* (redeploy) aplikasi Snaptime di server VPS Ubuntu setelah adanya penambahan fitur baru seperti **Animasi GIF**, **Bypass Checkout**, dan **Countdown Timer Sesi**.

---

## Langkah 1: Masuk ke VPS & Ambil Kode Terbaru
Buka terminal Anda, hubungkan ke VPS melalui SSH, dan masuk ke folder root project:

```bash
# 1. Hubungkan ke VPS
ssh username@ip_vps_anda

# 2. Masuk ke folder project (sesuaikan dengan path di VPS Anda)
cd /path/to/your/project-root

# 3. Pull update terbaru dari branch main GitHub
git pull origin main
```

---

## Langkah 2: Pembaruan Backend (Laravel)
Karena terdapat penambahan kolom baru pada database (`gif_speed` dan `session_duration`), jalankan perintah migrasi dan pembersihan cache berikut:

```bash
# 1. Masuk ke direktori backend
cd backend

# 2. Jalankan migrasi database di mode production (wajib --force)
php artisan migrate --force

# 3. Bersihkan & daftarkan ulang cache konfigurasi serta routing Laravel
php artisan config:cache
php artisan route:cache
php artisan view:clear

# 4. Kembali ke folder root
cd ..
```

---

## Langkah 3: Pembaruan Frontend (Next.js)
Karena kita menambahkan dependensi baru (`gifshot`) untuk pembuatan GIF di sisi browser, jalankan instalasi ulang dependensi dan kompilasi ulang Next.js:

```bash
# 1. Masuk ke direktori frontend
cd frontend

# 2. Install dependensi baru yang terdaftar di package.json
npm install

# 3. Compile ulang berkas Next.js ke mode produksi
npm run build
```

---

## Langkah 4: Restart Service Runner (PM2)
Terakhir, restart aplikasi Anda yang sedang berjalan di PM2 agar menggunakan berkas produksi Next.js yang baru di-build:

```bash
# 1. Tampilkan daftar aplikasi PM2 untuk memastikan nama servicenya
pm2 list

# 2. Restart service frontend (ganti 'snaptime-frontend' dengan nama aplikasi Anda di PM2)
pm2 restart snaptime-frontend

# Atau jika ingin melakukan restart ke semua service di PM2:
pm2 restart all
```

---

## Troubleshooting Ringkas
* **Error `npm run build` kehabisan memori (RAM)**:
  Jika VPS Anda memiliki spesifikasi RAM kecil (1GB/2GB) dan Next.js gagal di-build karena kehabisan memori, batasi alokasi memori Node.js sebelum menjalankan build:
  ```bash
  NODE_OPTIONS="--max-old-space-size=1024" npm run build
  ```
* **Perubahan tidak langsung muncul di browser**:
  Bersihkan cache browser Anda atau buka website menggunakan mode *Incognito* (Samaran) untuk memastikan file JavaScript terbaru sudah dimuat.
