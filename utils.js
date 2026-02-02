// js/utils.js
class Utils {
    static formatTime(date) {
        if (!date) return '';
        
        if (date.toDate) {
            date = date.toDate();
        }
        
        return date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    static formatDate(date) {
        if (!date) return '';
        
        if (date.toDate) {
            date = date.toDate();
        }
        
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    static formatDateTime(date) {
        if (!date) return '';
        
        if (date.toDate) {
            date = date.toDate();
        }
        
        return `${this.formatDate(date)} ${this.formatTime(date)}`;
    }

    static formatDuration(seconds) {
        if (!seconds && seconds !== 0) return '00:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    static parseTimeToMinutes(timeStr) {
        if (!timeStr) return 0;
        
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    static isWithinShift(shiftStartStr, shiftEndStr, checkTime = new Date()) {
        const currentMinutes = checkTime.getHours() * 60 + checkTime.getMinutes();
        const shiftStart = this.parseTimeToMinutes(shiftStartStr);
        const shiftEnd = this.parseTimeToMinutes(shiftEndStr);
        
        if (shiftStart <= shiftEnd) {
            return currentMinutes >= shiftStart && currentMinutes <= shiftEnd;
        } else {
            // Shift melewati tengah malam
            return currentMinutes >= shiftStart || currentMinutes <= shiftEnd;
        }
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static showLoading() {
        // Cek apakah loading screen sudah ada
        let loadingScreen = document.getElementById('loading-screen');
        
        if (!loadingScreen) {
            loadingScreen = document.createElement('div');
            loadingScreen.id = 'loading-screen';
            loadingScreen.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            loadingScreen.innerHTML = `
                <div class="bg-white p-6 rounded-lg shadow-xl">
                    <div class="flex items-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span class="ml-3 text-gray-700">Memuat...</span>
                    </div>
                </div>
            `;
            document.body.appendChild(loadingScreen);
        }
        
        loadingScreen.classList.remove('hidden');
    }

    static hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }

    static showToast(message, type = 'info') {
        // Hapus toast sebelumnya
        const existingToasts = document.querySelectorAll('.custom-toast');
        existingToasts.forEach(toast => {
            if (toast.timeoutId) clearTimeout(toast.timeoutId);
            toast.remove();
        });
        
        // Buat toast baru
        const toast = document.createElement('div');
        toast.className = `custom-toast fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-transform duration-300 translate-x-full`;
        
        // Tentukan warna berdasarkan type
        const colors = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-white',
            info: 'bg-blue-500 text-white'
        };
        
        toast.className += ` ${colors[type] || colors.info}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Animasi masuk
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full');
            toast.classList.add('translate-x-0');
        });
        
        // Set timeout untuk menghapus
        toast.timeoutId = setTimeout(() => {
            toast.classList.remove('translate-x-0');
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
        
        // Klik untuk menghapus
        toast.addEventListener('click', () => {
            clearTimeout(toast.timeoutId);
            toast.classList.remove('translate-x-0');
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                toast.remove();
            }, 300);
        });
    }

    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static formatNumber(num) {
        return new Intl.NumberFormat('id-ID').format(num);
    }

    static getCurrentShift() {
        const now = new Date();
        const currentHour = now.getHours();
        
        if (currentHour >= 6 && currentHour < 14) {
            return 'Pagi (06:00 - 14:00)';
        } else if (currentHour >= 14 && currentHour < 22) {
            return 'Sore (14:00 - 22:00)';
        } else {
            return 'Malam (22:00 - 06:00)';
        }
    }

    static copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Teks berhasil disalin', 'success');
        }).catch(err => {
            console.error('Gagal menyalin teks: ', err);
            this.showToast('Gagal menyalin teks', 'error');
        });
    }
}

// Export untuk penggunaan di file lain
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}