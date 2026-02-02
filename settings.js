// js/settings.js
class SettingsManager {
    constructor() {
        this.settings = {};
        this.initSettingsPage();
    }

    async initSettingsPage() {
        // Cek authentication dan role
        const isAdmin = await this.checkAdminAccess();
        if (!isAdmin) {
            document.getElementById('admin-only-warning').classList.remove('hidden');
            document.getElementById('settings-content').classList.add('hidden');
            return;
        }
        
        // Load settings
        await this.loadSettings();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Update clock
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        
        // Cek session timeout
        setInterval(() => authManager.checkSessionTimeout(), 60000);
    }

    async checkAdminAccess() {
        const user = auth.currentUser;
        if (!user) {
            window.location.href = 'index.html';
            return false;
        }
        
        try {
            const doc = await db.collection('staff').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                return data.role === 'admin';
            }
        } catch (error) {
            console.error('Error checking admin access:', error);
        }
        
        return false;
    }

    async loadSettings() {
        try {
            const doc = await db.collection('pengaturan').doc('settings').get();
            if (doc.exists) {
                this.settings = doc.data();
                this.populateForm();
            } else {
                // Create default settings jika belum ada
                this.settings = this.getDefaultSettings();
                await this.saveSettings(false); // Save tanpa tampilkan pesan
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    getDefaultSettings() {
        return {
            namaPerusahaan: 'Staff Dashboard',
            logoUrl: 'assets/logo.png',
            sessionTimeout: 480, // 8 jam dalam menit
            maxIzinPerHari: 4,
            durasiIzinKeluar: 959, // 15:59 dalam detik
            durasiIzinMakan: 420, // 7:00 dalam detik
            allowConcurrent: false,
            aturanSanksi: '1. Keterlambatan 1-15 menit: Peringatan lisan\n2. Keterlambatan 16-30 menit: Potong istirahat\n3. Keterlambatan >30 menit: Potong gaji sesuai ketentuan'
        };
    }

    populateForm() {
        // Populate form fields dengan data settings
        document.getElementById('nama-perusahaan').value = this.settings.namaPerusahaan || '';
        document.getElementById('logo-url').value = this.settings.logoUrl || '';
        document.getElementById('session-timeout').value = this.settings.sessionTimeout || 480;
        document.getElementById('max-izin').value = this.settings.maxIzinPerHari || 4;
        document.getElementById('durasi-keluar').value = this.settings.durasiIzinKeluar || 959;
        document.getElementById('durasi-makan').value = this.settings.durasiIzinMakan || 420;
        document.getElementById('allow-concurrent').value = this.settings.allowConcurrent ? 'true' : 'false';
        document.getElementById('aturan-sanksi').value = this.settings.aturanSanksi || '';
    }

    async saveSettings(showMessage = true) {
        try {
            // Collect data from form
            const settingsData = {
                namaPerusahaan: document.getElementById('nama-perusahaan').value,
                logoUrl: document.getElementById('logo-url').value,
                sessionTimeout: parseInt(document.getElementById('session-timeout').value),
                maxIzinPerHari: parseInt(document.getElementById('max-izin').value),
                durasiIzinKeluar: parseInt(document.getElementById('durasi-keluar').value),
                durasiIzinMakan: parseInt(document.getElementById('durasi-makan').value),
                allowConcurrent: document.getElementById('allow-concurrent').value === 'true',
                aturanSanksi: document.getElementById('aturan-sanksi').value,
                lastUpdated: new Date(),
                updatedBy: auth.currentUser.uid
            };
            
            // Save to Firestore
            await db.collection('pengaturan').doc('settings').set(settingsData, { merge: true });
            
            // Update local settings
            this.settings = settingsData;
            
            if (showMessage) {
                this.showMessage('success', 'Pengaturan berhasil disimpan');
            }
            
            // Update localStorage untuk halaman lain
            localStorage.setItem('settings', JSON.stringify(settingsData));
            
            return true;
            
        } catch (error) {
            console.error('Error saving settings:', error);
            if (showMessage) {
                this.showMessage('error', 'Gagal menyimpan pengaturan');
            }
            return false;
        }
    }

    resetToDefault() {
        if (confirm('Apakah Anda yakin ingin mengembalikan pengaturan ke default?')) {
            this.settings = this.getDefaultSettings();
            this.populateForm();
            this.showMessage('info', 'Form telah direset ke default. Klik "Simpan" untuk menerapkan.');
        }
    }

    setupEventListeners() {
        // Save button
        document.getElementById('btn-save').addEventListener('click', async () => {
            await this.saveSettings();
        });
        
        // Reset button
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.resetToDefault();
        });
        
        // Form validation
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                // Validasi input
                this.validateInput(input);
            });
        });
    }

    validateInput(input) {
        const value = input.value;
        
        switch (input.id) {
            case 'session-timeout':
                if (value < 1 || value > 1440) {
                    this.showInputError(input, 'Session timeout harus antara 1-1440 menit');
                    return false;
                }
                break;
                
            case 'max-izin':
                if (value < 1 || value > 20) {
                    this.showInputError(input, 'Maksimal izin harus antara 1-20');
                    return false;
                }
                break;
                
            case 'durasi-keluar':
            case 'durasi-makan':
                if (value < 60 || value > 3600) {
                    this.showInputError(input, 'Durasi harus antara 60-3600 detik');
                    return false;
                }
                break;
        }
        
        this.clearInputError(input);
        return true;
    }

    showInputError(input, message) {
        this.clearInputError(input);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-red-600 text-sm mt-1';
        errorDiv.textContent = message;
        errorDiv.id = `${input.id}-error`;
        
        input.parentNode.appendChild(errorDiv);
        input.classList.add('border-red-500');
    }

    clearInputError(input) {
        const errorDiv = document.getElementById(`${input.id}-error`);
        if (errorDiv) {
            errorDiv.remove();
        }
        input.classList.remove('border-red-500');
    }

    showMessage(type, text) {
        // Hapus pesan sebelumnya
        const existingMessages = document.querySelectorAll('.message-toast');
        existingMessages.forEach(msg => msg.remove());
        
        // Buat elemen pesan baru
        const message = document.createElement('div');
        message.className = `message-toast fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        message.textContent = text;
        
        document.body.appendChild(message);
        
        // Hapus otomatis setelah 5 detik
        setTimeout(() => {
            message.remove();
        }, 5000);
    }

    updateClock() {
        const now = new Date();
        const clockElement = document.getElementById('clock');
        if (clockElement) {
            clockElement.textContent = now.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }
}

// Initialize Settings Manager
let settingsManager;
document.addEventListener('DOMContentLoaded', function() {
    settingsManager = new SettingsManager();
});