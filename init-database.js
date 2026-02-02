// init-database.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initDatabase() {
  // 1. Buat pengaturan default
  const settings = {
    namaPerusahaan: "Nama Perusahaan Anda",
    maxIzinPerHari: 4,
    durasiIzinKeluar: 959, // 15:59 dalam detik
    durasiIzinMakan: 420, // 7:00 dalam detik
    allowConcurrent: false,
    sessionTimeout: 480, // 8 jam dalam menit
    aturanSanksi: "1. Keterlambatan 1-15 menit: Peringatan lisan\n2. Keterlambatan 16-30 menit: Potong istirahat\n3. Keterlambatan >30 menit: Potong gaji",
    createdAt: new Date()
  };

  await db.collection('pengaturan').doc('settings').set(settings);
  console.log('✅ Pengaturan default berhasil dibuat');

  // 2. Buat admin user (harus dibuat manual melalui Firebase Console)
  console.log('ℹ️  Buat admin user secara manual di Firebase Console:');
  console.log('Email: admin@company.com');
  console.log('Password: admin123');
  console.log('Kemudian tambahkan data staff untuk user tersebut');

  process.exit(0);
}

initDatabase().catch(console.error);