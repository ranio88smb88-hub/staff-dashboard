// js/logs.js
class LogsManager {
    constructor() {
        this.logsData = [];
        this.filteredData = [];
        this.staffList = [];
        this.currentFilters = {
            startDate: '',
            endDate: '',
            staffId: '',
            status: ''
        };
        this.sortConfig = {
            field: 'tanggal',
            direction: 'desc'
        };
        this.pagination = {
            currentPage: 1,
            itemsPerPage: 10,
            totalPages: 0,
            totalItems: 0
        };
        this.currentUserRole = '';
        this.initLogsPage();
    }

    async initLogsPage() {
        // Cek authentication
        await this.checkAuth();
        
        // Load user role
        await this.loadUserRole();
        
        // Setup date filters (default: 7 hari terakhir)
        this.setupDateFilters();
        
        // Load data awal
        await Promise.all([
            this.loadStaffList(),
            this.loadLogsData()
        ]);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Update clock
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        
        // Cek session timeout
        setInterval(() => authManager.checkSessionTimeout(), 60000);
        
        // Real-time updates
        this.setupRealtimeListener();
    }

    async checkAuth() {
        const user = auth.currentUser;
        if (!user) {
            window.location.href = 'index.html';
            return false;
        }
        
        // Tampilkan menu settings jika admin
        const role = localStorage.getItem('userRole');
        if (role === 'admin') {
            document.getElementById('settings-link').classList.remove('hidden');
        }
        
        // Tampilkan user info di sidebar
        const userName = localStorage.getItem('userName');
        const userRole = localStorage.getItem('userRole');
        if (userName) document.getElementById('user-name').textContent = userName;
        if (userRole) document.getElementById('user-role').textContent = userRole;
        
        return true;
    }

    async loadUserRole() {
        try {
            const user = auth.currentUser;
            const doc = await db.collection('staff').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                this.currentUserRole = data.role || 'staff';
            }
        } catch (error) {
            console.error('Error loading user role:', error);
        }
    }

    setupDateFilters() {
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        
        // Format tanggal untuk input type="date"
        const formatDate = (date) => {
            return date.toISOString().split('T')[0];
        };
        
        document.getElementById('filter-start-date').value = formatDate(sevenDaysAgo);
        document.getElementById('filter-end-date').value = formatDate(today);
        
        this.currentFilters.startDate = formatDate(sevenDaysAgo);
        this.currentFilters.endDate = formatDate(today);
    }

    async loadStaffList() {
        try {
            const snapshot = await db.collection('staff').get();
            this.staffList = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                this.staffList.push(data);
            });
            
            // Populate filter dropdown
            this.populateStaffFilter();
            
        } catch (error) {
            console.error('Error loading staff list:', error);
        }
    }

    populateStaffFilter() {
        const select = document.getElementById('filter-staff');
        if (!select) return;
        
        // Clear existing options except first one
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Add staff options
        this.staffList.forEach(staff => {
            const option = document.createElement('option');
            option.value = staff.id;
            option.textContent = staff.nama;
            select.appendChild(option);
        });
    }

    async loadLogsData() {
        try {
            Utils.showLoading();
            
            let query = db.collection('logIzin');
            
            // Apply date filters
            if (this.currentFilters.startDate) {
                const startDate = new Date(this.currentFilters.startDate);
                startDate.setHours(0, 0, 0, 0);
                query = query.where('tanggal', '>=', this.currentFilters.startDate);
            }
            
            if (this.currentFilters.endDate) {
                const endDate = new Date(this.currentFilters.endDate);
                endDate.setHours(23, 59, 59, 999);
                query = query.where('tanggal', '<=', this.currentFilters.endDate);
            }
            
            // Apply staff filter
            if (this.currentFilters.staffId) {
                query = query.where('staffId', '==', this.currentFilters.staffId);
            }
            
            // Apply status filter
            if (this.currentFilters.status) {
                query = query.where('status', '==', this.currentFilters.status);
            }
            
            // Order by tanggal descending (newest first)
            query = query.orderBy('tanggal', 'desc').orderBy('waktuMulai', 'desc');
            
            const snapshot = await query.get();
            
            this.logsData = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id;
                
                // Convert Firestore timestamps to Date objects
                if (data.waktuMulai && data.waktuMulai.toDate) {
                    data.waktuMulai = data.waktuMulai.toDate();
                }
                if (data.waktuSelesai && data.waktuSelesai.toDate) {
                    data.waktuSelesai = data.waktuSelesai.toDate();
                }
                
                this.logsData.push(data);
            });
            
            // Apply sorting
            this.applySorting();
            
            // Apply pagination
            this.applyPagination();
            
            // Update statistics
            this.updateStatistics();
            
            // Render table
            this.renderTable();
            
            // Hide loading
            document.getElementById('loading-state').classList.add('hidden');
            
        } catch (error) {
            console.error('Error loading logs data:', error);
            Utils.showToast('Gagal memuat data log izin', 'error');
        } finally {
            Utils.hideLoading();
        }
    }

    applySorting() {
        this.logsData.sort((a, b) => {
            let aValue = a[this.sortConfig.field];
            let bValue = b[this.sortConfig.field];
            
            // Handle different data types
            if (this.sortConfig.field === 'tanggal') {
                aValue = new Date(a.tanggal);
                bValue = new Date(b.tanggal);
            }
            
            if (this.sortConfig.field === 'waktuMulai') {
                aValue = a.waktuMulai;
                bValue = b.waktuMulai;
            }
            
            if (aValue < bValue) {
                return this.sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return this.sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        
        // Update sort icons
        this.updateSortIcons();
    }

    updateSortIcons() {
        // Reset semua icon
        const sortIcons = document.querySelectorAll('[id^="sort-"]');
        sortIcons.forEach(icon => {
            icon.className = 'fas fa-sort ml-1 text-gray-400';
        });
        
        // Set icon untuk field yang sedang di-sort
        const currentIcon = document.getElementById(`sort-${this.sortConfig.field}`);
        if (currentIcon) {
            currentIcon.className = this.sortConfig.direction === 'asc' 
                ? 'fas fa-sort-up ml-1 text-blue-600'
                : 'fas fa-sort-down ml-1 text-blue-600';
        }
    }

    applyPagination() {
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
        const endIndex = startIndex + this.pagination.itemsPerPage;
        
        this.filteredData = this.logsData.slice(startIndex, endIndex);
        this.pagination.totalItems = this.logsData.length;
        this.pagination.totalPages = Math.ceil(this.logsData.length / this.pagination.itemsPerPage);
        
        // Update pagination UI
        this.updatePaginationUI();
    }

    updatePaginationUI() {
        // Update pagination info
        const from = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage + 1;
        const to = Math.min(this.pagination.currentPage * this.pagination.itemsPerPage, this.pagination.totalItems);
        
        document.getElementById('pagination-from').textContent = from;
        document.getElementById('pagination-to').textContent = to;
        document.getElementById('pagination-total').textContent = this.pagination.totalItems;
        
        // Update pagination buttons
        document.getElementById('btn-prev').disabled = this.pagination.currentPage === 1;
        document.getElementById('btn-next').disabled = this.pagination.currentPage === this.pagination.totalPages;
        
        // Update page numbers
        this.renderPageNumbers();
    }

    renderPageNumbers() {
        const container = document.getElementById('pagination-numbers');
        if (!container) return;
        
        container.innerHTML = '';
        
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.pagination.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.pagination.totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust startPage jika endPage sudah mencapai totalPages
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // Tambah ellipsis di awal jika diperlukan
        if (startPage > 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'px-3 py-1';
            ellipsis.textContent = '...';
            container.appendChild(ellipsis);
        }
        
        // Tambah nomor halaman
        for (let i = startPage; i <= endPage; i++) {
            const button = document.createElement('button');
            button.className = `px-3 py-1 border rounded-lg ${
                i === this.pagination.currentPage 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
            }`;
            button.textContent = i;
            button.onclick = () => this.goToPage(i);
            container.appendChild(button);
        }
        
        // Tambah ellipsis di akhir jika diperlukan
        if (endPage < this.pagination.totalPages) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'px-3 py-1';
            ellipsis.textContent = '...';
            container.appendChild(ellipsis);
        }
    }

    renderTable() {
        const container = document.getElementById('logs-table-body');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.filteredData.length === 0) {
            document.getElementById('table-container').classList.add('hidden');
            document.getElementById('empty-state').classList.remove('hidden');
            return;
        }
        
        document.getElementById('table-container').classList.remove('hidden');
        document.getElementById('empty-state').classList.add('hidden');
        
        this.filteredData.forEach(log => {
            const row = this.createTableRow(log);
            container.appendChild(row);
        });
    }

    createTableRow(log) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 cursor-pointer';
        row.onclick = () => this.showDetailModal(log);
        
        // Format tanggal
        const tanggal = new Date(log.tanggal);
        const tanggalStr = tanggal.toLocaleDateString('id-ID', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        // Format waktu
        const waktuMulaiStr = log.waktuMulai 
            ? log.waktuMulai.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : '-';
        
        // Durasi
        let durasiStr = '-';
        if (log.waktuMulai && log.waktuSelesai) {
            const durasiMs = log.waktuSelesai - log.waktuMulai;
            const durasiMin = Math.floor(durasiMs / (1000 * 60));
            const durasiSec = Math.floor((durasiMs % (1000 * 60)) / 1000);
            durasiStr = `${durasiMin}:${durasiSec.toString().padStart(2, '0')}`;
        } else if (log.durasi) {
            const minutes = Math.floor(log.durasi / 60);
            const seconds = log.durasi % 60;
            durasiStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Status badge
        let statusClass = '';
        let statusText = '';
        
        switch (log.status) {
            case 'ACTIVE':
                statusClass = 'bg-yellow-100 text-yellow-800';
                statusText = 'Aktif';
                break;
            case 'NORMAL':
                statusClass = 'bg-green-100 text-green-800';
                statusText = 'Normal';
                break;
            case 'TELAT':
                statusClass = 'bg-red-100 text-red-800';
                statusText = 'Telat';
                break;
            default:
                statusClass = 'bg-gray-100 text-gray-800';
                statusText = log.status || 'Unknown';
        }
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${tanggalStr}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <i class="fas fa-user text-blue-600 text-sm"></i>
                    </div>
                    <div class="ml-3">
                        <div class="text-sm font-medium text-gray-900">${log.nama}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">${log.jobdesk}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs ${
                    log.jenis === 'keluar' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                } rounded">
                    ${log.jenis === 'keluar' ? 'Izin Keluar' : 'Izin Makan'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                ${waktuMulaiStr}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                ${durasiStr}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <button onclick="event.stopPropagation(); logsManager.showDetailModal(${JSON.stringify(log).replace(/"/g, '&quot;')})" 
                        class="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                    Detail
                </button>
            </td>
        `;
        
        return row;
    }

    updateStatistics() {
        const today = new Date().toISOString().split('T')[0];
        
        // Total izin hari ini
        const todayLogs = this.logsData.filter(log => log.tanggal === today);
        document.getElementById('total-today').textContent = todayLogs.length;
        
        // Izin aktif
        const activeLogs = this.logsData.filter(log => log.status === 'ACTIVE');
        document.getElementById('active-izin').textContent = activeLogs.length;
        
        // Total telat
        const telatLogs = this.logsData.filter(log => log.status === 'TELAT');
        document.getElementById('total-telat').textContent = telatLogs.length;
    }

    setupEventListeners() {
        // Apply filter button
        document.getElementById('btn-apply-filter').addEventListener('click', () => {
            this.applyFilters();
        });
        
        // Reset filter button
        document.getElementById('btn-reset-filter').addEventListener('click', () => {
            this.resetFilters();
        });
        
        // Export button
        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportData();
        });
        
        // Refresh button
        document.getElementById('btn-refresh').addEventListener('click', () => {
            this.refreshData();
        });
        
        // Pagination buttons
        document.getElementById('btn-prev').addEventListener('click', () => {
            if (this.pagination.currentPage > 1) {
                this.goToPage(this.pagination.currentPage - 1);
            }
        });
        
        document.getElementById('btn-next').addEventListener('click', () => {
            if (this.pagination.currentPage < this.pagination.totalPages) {
                this.goToPage(this.pagination.currentPage + 1);
            }
        });
        
        // Filter input events (apply on change for date inputs)
        document.getElementById('filter-start-date').addEventListener('change', (e) => {
            this.currentFilters.startDate = e.target.value;
        });
        
        document.getElementById('filter-end-date').addEventListener('change', (e) => {
            this.currentFilters.endDate = e.target.value;
        });
        
        document.getElementById('filter-staff').addEventListener('change', (e) => {
            this.currentFilters.staffId = e.target.value;
        });
        
        document.getElementById('filter-status').addEventListener('change', (e) => {
            this.currentFilters.status = e.target.value;
        });
    }

    applyFilters() {
        // Update current filters from UI
        this.currentFilters.startDate = document.getElementById('filter-start-date').value;
        this.currentFilters.endDate = document.getElementById('filter-end-date').value;
        this.currentFilters.staffId = document.getElementById('filter-staff').value;
        this.currentFilters.status = document.getElementById('filter-status').value;
        
        // Reset to page 1
        this.pagination.currentPage = 1;
        
        // Reload data dengan filter baru
        this.loadLogsData();
        
        Utils.showToast('Filter diterapkan', 'success');
    }

    resetFilters() {
        // Reset UI
        this.setupDateFilters();
        document.getElementById('filter-staff').value = '';
        document.getElementById('filter-status').value = '';
        
        // Reset internal filters
        this.currentFilters = {
            startDate: document.getElementById('filter-start-date').value,
            endDate: document.getElementById('filter-end-date').value,
            staffId: '',
            status: ''
        };
        
        // Reset pagination
        this.pagination.currentPage = 1;
        
        // Reload data
        this.loadLogsData();
        
        Utils.showToast('Filter direset', 'info');
    }

    sortBy(field) {
        if (this.sortConfig.field === field) {
            // Toggle direction jika field sama
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Set field baru dengan default direction desc
            this.sortConfig.field = field;
            this.sortConfig.direction = 'desc';
        }
        
        // Apply sorting dan re-render
        this.applySorting();
        this.applyPagination();
        this.renderTable();
    }

    goToPage(page) {
        if (page < 1 || page > this.pagination.totalPages) return;
        
        this.pagination.currentPage = page;
        this.applyPagination();
        this.renderTable();
        
        // Scroll ke atas tabel
        const tableContainer = document.getElementById('table-container');
        if (tableContainer) {
            tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    refreshData() {
        Utils.showLoading();
        this.loadLogsData().finally(() => {
            Utils.showToast('Data diperbarui', 'success');
        });
    }

    async showDetailModal(log) {
        const modal = document.getElementById('detail-modal');
        
        // Populate modal data
        document.getElementById('detail-nama').textContent = log.nama || '-';
        document.getElementById('detail-jabatan').textContent = log.jabatan || '-';
        document.getElementById('detail-jobdesk').textContent = log.jobdesk || '-';
        document.getElementById('detail-jenis').textContent = log.jenis === 'keluar' ? 'Izin Keluar' : 'Izin Makan';
        document.getElementById('detail-alasan').textContent = log.alasan || '-';
        document.getElementById('detail-tanggal').textContent = new Date(log.tanggal).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Format waktu
        const waktuMulaiStr = log.waktuMulai 
            ? log.waktuMulai.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            })
            : '-';
        
        const waktuSelesaiStr = log.waktuSelesai 
            ? log.waktuSelesai.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            })
            : '-';
        
        document.getElementById('detail-mulai').textContent = waktuMulaiStr;
        document.getElementById('detail-selesai').textContent = waktuSelesaiStr;
        
        // Format durasi
        let durasiStr = '-';
        if (log.waktuMulai && log.waktuSelesai) {
            const durasiMs = log.waktuSelesai - log.waktuMulai;
            const minutes = Math.floor(durasiMs / (1000 * 60));
            const seconds = Math.floor((durasiMs % (1000 * 60)) / 1000);
            durasiStr = `${minutes} menit ${seconds} detik`;
        } else if (log.durasi) {
            const minutes = Math.floor(log.durasi / 60);
            const seconds = log.durasi % 60;
            durasiStr = `${minutes} menit ${seconds} detik`;
        }
        document.getElementById('detail-durasi').textContent = durasiStr;
        
        // Status
        const statusBadge = document.getElementById('detail-status-badge');
        const statusDesc = document.getElementById('detail-status-desc');
        
        switch (log.status) {
            case 'ACTIVE':
                statusBadge.className = 'px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-medium';
                statusBadge.textContent = 'Izin Aktif';
                statusDesc.textContent = 'Staff sedang dalam waktu izin';
                break;
            case 'NORMAL':
                statusBadge.className = 'px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium';
                statusBadge.textContent = 'Selesai Normal';
                statusDesc.textContent = 'Izin telah selesai sesuai waktu';
                break;
            case 'TELAT':
                statusBadge.className = 'px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium';
                statusBadge.textContent = 'Telat Kembali';
                statusDesc.textContent = 'Staff terlambat kembali dari izin';
                break;
            default:
                statusBadge.className = 'px-4 py-2 bg-gray-100 text-gray-800 rounded-lg font-medium';
                statusBadge.textContent = log.status || 'Unknown';
                statusDesc.textContent = '';
        }
        
        // Tampilkan/hide admin actions
        const adminActions = document.getElementById('admin-actions');
        if (this.currentUserRole === 'admin') {
            adminActions.classList.remove('hidden');
            document.getElementById('mark-telat').checked = log.status === 'TELAT';
        } else {
            adminActions.classList.add('hidden');
        }
        
        // Simpan log ID untuk aksi admin
        modal.dataset.logId = log.id;
        
        // Tampilkan modal
        modal.classList.remove('hidden');
    }

    closeDetailModal() {
        const modal = document.getElementById('detail-modal');
        modal.classList.add('hidden');
    }

    async updateStatus() {
        const logId = document.getElementById('detail-modal').dataset.logId;
        const markAsTelat = document.getElementById('mark-telat').checked;
        
        if (!logId) return;
        
        try {
            const newStatus = markAsTelat ? 'TELAT' : 'NORMAL';
            
            await db.collection('logIzin').doc(logId).update({
                status: newStatus,
                updatedAt: new Date()
            });
            
            Utils.showToast('Status berhasil diupdate', 'success');
            
            // Close modal dan refresh data
            this.closeDetailModal();
            this.refreshData();
            
        } catch (error) {
            console.error('Error updating status:', error);
            Utils.showToast('Gagal mengupdate status', 'error');
        }
    }

    exportData() {
        if (this.logsData.length === 0) {
            Utils.showToast('Tidak ada data untuk diexport', 'warning');
            return;
        }
        
        // Format data untuk CSV
        const headers = [
            'Tanggal',
            'Nama Staff',
            'Jabatan',
            'Jobdesk',
            'Jenis Izin',
            'Alasan',
            'Waktu Mulai',
            'Waktu Selesai',
            'Durasi (menit)',
            'Status'
        ];
        
        const rows = this.logsData.map(log => {
            const waktuMulaiStr = log.waktuMulai 
                ? log.waktuMulai.toLocaleTimeString('id-ID')
                : '';
            
            const waktuSelesaiStr = log.waktuSelesai 
                ? log.waktuSelesai.toLocaleTimeString('id-ID')
                : '';
            
            // Hitung durasi dalam menit
            let durasiMenit = '';
            if (log.waktuMulai && log.waktuSelesai) {
                durasiMenit = Math.round((log.waktuSelesai - log.waktuMulai) / (1000 * 60));
            } else if (log.durasi) {
                durasiMenit = Math.round(log.durasi / 60);
            }
            
            return [
                log.tanggal,
                log.nama || '',
                log.jabatan || '',
                log.jobdesk || '',
                log.jenis === 'keluar' ? 'Izin Keluar' : 'Izin Makan',
                log.alasan || '',
                waktuMulaiStr,
                waktuSelesaiStr,
                durasiMenit,
                log.status || ''
            ];
        });
        
        // Buat CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // Buat blob dan download
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `log-izin-${today}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        Utils.showToast('Data berhasil diexport', 'success');
    }

    setupRealtimeListener() {
        // Real-time listener untuk log izin
        db.collection('logIzin')
            .orderBy('tanggal', 'desc')
            .limit(50)
            .onSnapshot((snapshot) => {
                // Update data jika ada perubahan
                const changes = snapshot.docChanges();
                if (changes.length > 0) {
                    // Refresh data
                    this.refreshData();
                }
            });
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

// Initialize Logs Manager
let logsManager;
document.addEventListener('DOMContentLoaded', function() {
    logsManager = new LogsManager();
});