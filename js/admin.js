// js/admin.js - Dashboard Admin Donor Darah STMC

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loginTim = document.getElementById('login-tim');
    const displayTim = document.getElementById('admin-tim-display');
    const subdescTim = document.getElementById('admin-tim-subdesc');
    const queueList = document.getElementById('admin-queue-list');
    const queueCount = document.getElementById('admin-queue-count');
    const badgeNextTicket = document.getElementById('badge-next-ticket');
    
    const btnPanggil = document.getElementById('btn-panggil-selanjutnya');
    const btnMundur = document.getElementById('btn-mundur');
    const formLompat = document.getElementById('form-lompat');
    const inputLompat = document.getElementById('input-lompat-nomor');
    const selectLompatPrefix = document.getElementById('select-lompat-prefix');

    const wrapperToggleMakassar = document.getElementById('wrapper-toggle-makassar');
    const radioMM = document.getElementById('radio-mm');
    const radioMO = document.getElementById('radio-mo');
    const filterTabsContainer = document.getElementById('filter-tabs-container');

    const formQuickReg = document.getElementById('form-quick-reg');
    const inputQuickNomor = document.getElementById('quick-nomor');
    const labelTimPrefix = document.getElementById('label-tim-prefix');
    const inputQuickNama = document.getElementById('quick-nama');
    const inputSearchQueue = document.getElementById('input-search-queue');
    const formManual = document.getElementById('form-manual');

    // State
    let currentTim = localStorage.getItem('adminCurrentTim') || loginTim.value || 'M';
    loginTim.value = currentTim;

    let currentMakassarSubTim = localStorage.getItem('adminMakassarSubTim') || 'MM';
    if (radioMO && currentMakassarSubTim === 'MO') {
        radioMO.checked = true;
    } else if (radioMM) {
        radioMM.checked = true;
    }

    let currentFilter = 'all';
    let cachedAllQueues = [];
    let currentSearchTerm = '';

    // --- HELPER IDENTIFIKASI TIKET & WARNA ---
    function getTicketInfo(item) {
        const kode = (item.kode_tim || '').toUpperCase();
        const metode = (item.metode_input || '').toUpperCase();
        const numStr = String(item.nomor_urut).padStart(3, '0');

        if (kode === 'P') {
            return {
                prefix: 'P',
                fullCode: `P-${numStr}`,
                badgeText: 'UTD Pangkep',
                badgeClass: 'badge-pangkep',
                color: '#fd7e14'
            };
        } else if (kode === 'MM' || (kode === 'M' && metode === 'MANUAL')) {
            return {
                prefix: 'MM',
                fullCode: `MM-${numStr}`,
                badgeText: 'MM (Manual)',
                badgeClass: 'badge-mm',
                color: '#1976D2'
            };
        } else {
            return {
                prefix: 'MO',
                fullCode: `MO-${numStr}`,
                badgeText: 'MO (Online)',
                badgeClass: 'badge-mo',
                color: '#D32F2F'
            };
        }
    }

    // Helper: Mencegah Duplikasi Nomor Antrian
    function deduplicateQueues(items) {
        if (!items || items.length === 0) return [];
        const map = new Map();
        for (const item of items) {
            const info = getTicketInfo(item);
            const key = `${info.prefix}-${item.nomor_urut}`;
            if (!map.has(key)) {
                map.set(key, item);
            } else {
                const prev = map.get(key);
                const prevTime = prev.waktu_panggil || prev.waktu_ambil || '';
                const currTime = item.waktu_panggil || item.waktu_ambil || '';
                if (currTime > prevTime) {
                    map.set(key, item);
                }
            }
        }
        return Array.from(map.values());
    }

    // Mendapatkan Prefix Aktif Saat Ini
    function getActivePrefix() {
        if (currentTim === 'P') return 'P';
        return currentMakassarSubTim; // 'MM' atau 'MO'
    }

    // Menghitung Nomor Urut Terkecil Berikutnya Sesuai Prefix
    function getNextSequentialNumber(queues, targetPrefix) {
        const matched = queues.filter(q => getTicketInfo(q).prefix === targetPrefix);
        const existingNumbers = new Set(matched.map(q => q.nomor_urut));
        let n = 1;
        while (existingNumbers.has(n)) {
            n++;
        }
        return n;
    }

    // Mendapatkan awal hari lokal (00:00:00)
    function getStartOfDayIso() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        return startOfDay.toISOString();
    }

    // --- UPDATE UI BERDASARKAN TIM ---
    function updateTimDisplay() {
        if (currentTim === 'P') {
            displayTim.innerText = 'UTD Pangkep & STMC';
            displayTim.className = 'fw-bold fs-6 text-warning-emphasis';
            subdescTim.innerText = 'Karcis Oranye (P-001 s/d P-200)';
            
            if (wrapperToggleMakassar) wrapperToggleMakassar.style.display = 'none';
            if (selectLompatPrefix) selectLompatPrefix.style.display = 'none';
            if (filterTabsContainer) filterTabsContainer.style.display = 'none';
            
            if (labelTimPrefix) {
                labelTimPrefix.innerText = 'P-';
                labelTimPrefix.className = 'input-group-text bg-light fw-bold text-warning-emphasis';
            }
        } else {
            displayTim.innerText = 'PMI Makassar & STMC';
            displayTim.className = 'fw-bold fs-6 text-primary';
            subdescTim.innerText = 'MM Biru & MO Merah';
            
            if (wrapperToggleMakassar) wrapperToggleMakassar.style.display = 'block';
            if (selectLompatPrefix) {
                selectLompatPrefix.style.display = 'block';
                selectLompatPrefix.value = currentMakassarSubTim;
            }
            if (filterTabsContainer) filterTabsContainer.style.display = 'block';
            
            updateMakassarPrefixUI();
        }
    }

    function updateMakassarPrefixUI() {
        if (labelTimPrefix) {
            if (currentMakassarSubTim === 'MM') {
                labelTimPrefix.innerText = 'MM-';
                labelTimPrefix.className = 'input-group-text bg-light fw-bold text-primary';
            } else {
                labelTimPrefix.innerText = 'MO-';
                labelTimPrefix.className = 'input-group-text bg-light fw-bold text-danger';
            }
        }
    }

    // Event Switch Tim
    loginTim.addEventListener('change', (e) => {
        currentTim = e.target.value;
        localStorage.setItem('adminCurrentTim', currentTim);
        updateTimDisplay();
        fetchQueue();
        fetchActive();
    });

    // Event Switch Sub-Tim Makassar (MM vs MO)
    if (radioMM && radioMO) {
        [radioMM, radioMO].forEach(r => {
            r.addEventListener('change', (e) => {
                if (e.target.checked) {
                    currentMakassarSubTim = e.target.value;
                    localStorage.setItem('adminMakassarSubTim', currentMakassarSubTim);
                    updateMakassarPrefixUI();
                    if (selectLompatPrefix) selectLompatPrefix.value = currentMakassarSubTim;
                    updateNextSequentialInput();
                }
            });
        });
    }

    // Filter Tabs
    document.querySelectorAll('.filter-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.getAttribute('data-filter');
            renderQueueList();
        });
    });

    updateTimDisplay();

    // Polling berkala setiap 2.5 detik
    setInterval(() => {
        fetchQueue();
        fetchActive();
    }, 2500);

    fetchQueue();
    fetchActive();

    // --- 1. FETCH & RENDER DAFTAR ANTRIAN & STATISTIK ---
    async function fetchQueue() {
        const startIso = getStartOfDayIso();
        const timFilter = currentTim === 'M' ? ['M', 'MM', 'MO'] : ['P'];

        const { data, error } = await supabaseClient
            .from('antrian')
            .select('*')
            .in('kode_tim', timFilter)
            .gte('waktu_ambil', startIso)
            .order('nomor_urut', { ascending: true });

        if (data) {
            cachedAllQueues = deduplicateQueues(data);

            // Statistik Harian
            const totalPendaftar = cachedAllQueues.length;
            const sudahSelesai = cachedAllQueues.filter(q => q.status === 'selesai' || q.status === 'lewat').length;
            const sisaAntrian = cachedAllQueues.filter(q => q.status === 'menunggu').length;
            
            document.getElementById('stat-total').innerText = totalPendaftar;
            document.getElementById('stat-selesai').innerText = sudahSelesai;
            document.getElementById('stat-sisa').innerText = sisaAntrian;

            // Rincian sub-tim untuk Makassar
            if (currentTim === 'M') {
                const mmTotal = cachedAllQueues.filter(q => getTicketInfo(q).prefix === 'MM').length;
                const moTotal = cachedAllQueues.filter(q => getTicketInfo(q).prefix === 'MO').length;
                const mmSelesai = cachedAllQueues.filter(q => getTicketInfo(q).prefix === 'MM' && (q.status === 'selesai' || q.status === 'lewat')).length;
                const moSelesai = cachedAllQueues.filter(q => getTicketInfo(q).prefix === 'MO' && (q.status === 'selesai' || q.status === 'lewat')).length;
                const mmSisa = cachedAllQueues.filter(q => getTicketInfo(q).prefix === 'MM' && q.status === 'menunggu').length;
                const moSisa = cachedAllQueues.filter(q => getTicketInfo(q).prefix === 'MO' && q.status === 'menunggu').length;

                document.getElementById('stat-sub-total').innerText = `MM: ${mmTotal} | MO: ${moTotal}`;
                document.getElementById('stat-sub-selesai').innerText = `MM: ${mmSelesai} | MO: ${moSelesai}`;
                document.getElementById('stat-sub-sisa').innerText = `MM: ${mmSisa} | MO: ${moSisa}`;
            } else {
                document.getElementById('stat-sub-total').innerText = '';
                document.getElementById('stat-sub-selesai').innerText = '';
                document.getElementById('stat-sub-sisa').innerText = '';
            }

            // Update Badge & Input Nomor Karcis Berikutnya
            updateNextSequentialInput();

            // Status tombol Panggil Selanjutnya
            btnPanggil.disabled = sisaAntrian === 0;

            renderQueueList();
        }
    }

    function updateNextSequentialInput() {
        const activePrefix = getActivePrefix();
        const nextSeq = getNextSequentialNumber(cachedAllQueues, activePrefix);
        
        if (badgeNextTicket) {
            badgeNextTicket.innerText = `Berikutnya: ${activePrefix}-${String(nextSeq).padStart(3, '0')}`;
        }
        if (inputQuickNomor && document.activeElement !== inputQuickNomor) {
            inputQuickNomor.value = nextSeq;
        }
    }

    // Filter Pencarian
    if (inputSearchQueue) {
        inputSearchQueue.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            renderQueueList();
        });
    }

    // Render List Antrian
    function renderQueueList() {
        queueList.innerHTML = '';

        let filtered = cachedAllQueues;

        // Filter tab MM / MO
        if (currentTim === 'M' && currentFilter !== 'all') {
            filtered = filtered.filter(item => getTicketInfo(item).prefix === currentFilter);
        }

        // Filter text search
        if (currentSearchTerm) {
            filtered = filtered.filter(item => {
                const info = getTicketInfo(item);
                const noStr = info.fullCode.toLowerCase();
                const numOnly = String(item.nomor_urut);
                const namaStr = (item.nama_pendonor || '').toLowerCase();
                return noStr.includes(currentSearchTerm) || numOnly.includes(currentSearchTerm) || namaStr.includes(currentSearchTerm);
            });
        }

        queueCount.innerText = filtered.length;

        if (filtered.length === 0) {
            queueList.innerHTML = '<li class="list-group-item text-center text-muted py-3">Tidak ada antrian yang sesuai.</li>';
            return;
        }

        filtered.forEach(item => {
            const info = getTicketInfo(item);
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center py-2';

            let statusBadge = '';
            if (item.status === 'menunggu') statusBadge = '<span class="badge bg-warning text-dark">Menunggu</span>';
            else if (item.status === 'dipanggil') statusBadge = '<span class="badge bg-primary">Dipanggil</span>';
            else if (item.status === 'selesai') statusBadge = '<span class="badge bg-success">Selesai</span>';
            else if (item.status === 'lewat') statusBadge = '<span class="badge bg-secondary">Lewat</span>';

            const namaDisplay = (item.nama_pendonor && item.nama_pendonor !== '-') ? item.nama_pendonor : 'Peserta Donor';

            li.innerHTML = `
                <div class="me-2 text-truncate" style="max-width: 65%;">
                    <span class="badge ${info.badgeClass} me-1 fs-6">${info.fullCode}</span>
                    <strong class="text-dark">${namaDisplay}</strong>
                    <div class="mt-1">
                        ${statusBadge}
                        <small class="text-muted ms-1">${info.badgeText}</small>
                    </div>
                </div>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-secondary btn-edit-nama" data-id="${item.id_antrian}" data-nomor="${info.fullCode}" data-nama="${namaDisplay}" title="Edit Nama">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-outline-primary btn-call-direct" data-id="${item.id_antrian}" data-nomor="${info.fullCode}" title="Panggil Langsung">
                        📢
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-queue" data-id="${item.id_antrian}" data-nomor="${info.fullCode}" title="Hapus Antrian">
                        🗑️
                    </button>
                </div>
            `;
            queueList.appendChild(li);
        });

        // Event listener Edit Nama
        document.querySelectorAll('.btn-edit-nama').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                const id = button.getAttribute('data-id');
                const nomor = button.getAttribute('data-nomor');
                const oldNama = button.getAttribute('data-nama') === 'Peserta Donor' ? '' : button.getAttribute('data-nama');
                
                const newNama = prompt(`Masukkan nama baru untuk antrian ${nomor}:`, oldNama);
                if (newNama !== null && newNama.trim() !== '') {
                    await supabaseClient
                        .from('antrian')
                        .update({ nama_pendonor: newNama.trim() })
                        .eq('id_antrian', id);
                    fetchQueue();
                    fetchActive();
                }
            });
        });

        // Event listener Panggil Langsung
        document.querySelectorAll('.btn-call-direct').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                const id = button.getAttribute('data-id');
                await supabaseClient
                    .from('antrian')
                    .update({ 
                        status: 'dipanggil',
                        waktu_panggil: new Date().toISOString()
                    })
                    .eq('id_antrian', id);
                fetchQueue();
                fetchActive();
            });
        });

        // Event listener Hapus Antrian
        document.querySelectorAll('.btn-delete-queue').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                const id = button.getAttribute('data-id');
                const nomor = button.getAttribute('data-nomor');
                if (confirm(`Yakin ingin menghapus antrian ${nomor}? Data akan dihapus dari antrian hari ini.`)) {
                    const { error } = await supabaseClient.from('antrian').delete().eq('id_antrian', id);
                    if (error) {
                        alert('Gagal menghapus antrian: ' + error.message);
                    }
                    fetchQueue();
                    fetchActive();
                }
            });
        });
    }

    // --- 2. FETCH & RENDER ANTRIAN AKTIF (SEDANG DILAYANI) ---
    async function fetchActive() {
        const startIso = getStartOfDayIso();
        const timFilter = currentTim === 'M' ? ['M', 'MM', 'MO'] : ['P'];

        const { data } = await supabaseClient
            .from('antrian')
            .select('*')
            .in('kode_tim', timFilter)
            .eq('status', 'dipanggil')
            .gte('waktu_ambil', startIso)
            .order('waktu_panggil', { ascending: false });

        renderActiveQueues(deduplicateQueues(data || []));
    }

    function renderActiveQueues(data) {
        const container = document.getElementById('active-queue-container');
        const badgeCount = document.getElementById('active-count-badge');
        
        badgeCount.innerText = `${data.length} Aktif`;
        container.innerHTML = '';

        if (data.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5" id="no-active-msg">
                    <h4 class="fw-light">Belum ada pasien aktif di bed</h4>
                    <small>Klik "Panggil Selanjutnya" untuk memulai</small>
                </div>`;
            return;
        }

        data.forEach((item, index) => {
            const isLatest = index === 0;
            const info = getTicketInfo(item);
            const nama = (item.nama_pendonor && item.nama_pendonor !== '-') ? item.nama_pendonor : 'Peserta Donor';

            const card = document.createElement('div');
            card.className = 'card shadow-sm mb-3';
            card.style.border = isLatest ? `3px solid ${info.color}` : `1.5px solid #cbd5e1`;
            card.style.backgroundColor = isLatest ? '#fff' : '#fafafa';

            card.innerHTML = `
                <div class="card-body text-center py-3">
                    <div class="d-flex justify-content-between align-items-center mb-2 px-2">
                        <span class="badge ${info.badgeClass} fw-bold">${info.badgeText}</span>
                        ${isLatest ? `<span class="badge bg-danger pulse-badge">🔔 BARU DIPANGGIL</span>` : `<span class="badge bg-secondary">🩺 SEDANG DILAYANI</span>`}
                    </div>
                    <h1 class="display-4 fw-bolder mb-1" style="color: ${info.color}; letter-spacing: 1px;">
                        ${info.fullCode}
                    </h1>
                    <h5 class="text-dark fw-semibold mb-3">${nama}</h5>
                    <div class="d-flex justify-content-center gap-2 flex-wrap">
                        <button class="btn btn-outline-primary btn-ulang px-3 fw-semibold" data-id="${item.id_antrian}">🔁 Panggil Ulang</button>
                        <button class="btn btn-success btn-selesai px-3 fw-semibold" data-id="${item.id_antrian}">✓ Selesai</button>
                        <button class="btn btn-warning btn-lewat px-3 fw-semibold" data-id="${item.id_antrian}">⏭ Lewati</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        document.querySelectorAll('.btn-ulang').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                await supabaseClient.from('antrian').update({ waktu_panggil: new Date().toISOString() }).eq('id_antrian', id);
                fetchActive();
            });
        });

        document.querySelectorAll('.btn-selesai').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                await supabaseClient.from('antrian').update({ status: 'selesai' }).eq('id_antrian', id);
                fetchQueue();
                fetchActive();
            });
        });

        document.querySelectorAll('.btn-lewat').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                await supabaseClient.from('antrian').update({ status: 'lewat' }).eq('id_antrian', id);
                fetchQueue();
                fetchActive();
            });
        });
    }

    // --- 3. KONTROL PEMANGGILAN ---
    // A. Tombol Panggil Selanjutnya (+)
    btnPanggil.addEventListener('click', async () => {
        const startIso = getStartOfDayIso();
        const timFilter = currentTim === 'M' ? ['M', 'MM', 'MO'] : ['P'];

        const { data } = await supabaseClient
            .from('antrian')
            .select('id_antrian')
            .in('kode_tim', timFilter)
            .eq('status', 'menunggu')
            .gte('waktu_ambil', startIso)
            .order('waktu_ambil', { ascending: true })
            .limit(1);

        if (data && data.length > 0) {
            await supabaseClient
                .from('antrian')
                .update({ 
                    status: 'dipanggil',
                    waktu_panggil: new Date().toISOString()
                })
                .eq('id_antrian', data[0].id_antrian);
            
            fetchQueue();
            fetchActive();
        }
    });

    // B. Tombol Mundur (-)
    if (btnMundur) {
        btnMundur.addEventListener('click', async () => {
            const startIso = getStartOfDayIso();
            const timFilter = currentTim === 'M' ? ['M', 'MM', 'MO'] : ['P'];

            const { data } = await supabaseClient
                .from('antrian')
                .select('*')
                .in('kode_tim', timFilter)
                .in('status', ['selesai', 'lewat'])
                .gte('waktu_ambil', startIso)
                .order('waktu_panggil', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                await supabaseClient
                    .from('antrian')
                    .update({ 
                        status: 'dipanggil',
                        waktu_panggil: new Date().toISOString()
                    })
                    .eq('id_antrian', data[0].id_antrian);
                fetchQueue();
                fetchActive();
            } else {
                alert('Tidak ada antrian sebelumnya untuk dimundurkan.');
            }
        });
    }

    // C. Form Lompat ke Nomor Tertentu
    if (formLompat) {
        formLompat.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetNum = parseInt(inputLompat.value);
            if (!targetNum || targetNum < 1) return;

            const targetPrefix = currentTim === 'M' ? (selectLompatPrefix ? selectLompatPrefix.value : 'MM') : 'P';
            const startIso = getStartOfDayIso();
            const timFilter = currentTim === 'M' ? ['M', 'MM', 'MO'] : ['P'];

            // Cek apakah nomor dengan prefix ini sudah ada
            const existing = cachedAllQueues.find(q => {
                const info = getTicketInfo(q);
                return info.prefix === targetPrefix && q.nomor_urut === targetNum;
            });

            if (existing) {
                // Ubah status antrian yang sudah ada menjadi dipanggil
                await supabaseClient
                    .from('antrian')
                    .update({
                        status: 'dipanggil',
                        waktu_panggil: new Date().toISOString()
                    })
                    .eq('id_antrian', existing.id_antrian);
            } else {
                // Buatkan otomatis slot antriannya dan panggil
                const metodeInput = targetPrefix === 'MO' ? 'QR' : 'Manual';
                await supabaseClient
                    .from('antrian')
                    .insert({
                        kode_tim: currentTim === 'P' ? 'P' : 'M',
                        nomor_urut: targetNum,
                        nama_pendonor: `Peserta ${targetPrefix}-${targetNum}`,
                        metode_input: metodeInput,
                        status: 'dipanggil',
                        waktu_panggil: new Date().toISOString()
                    });
            }

            inputLompat.value = '';
            fetchQueue();
            fetchActive();
        });
    }

    // --- 4. REGISTRASI CEPAT MEJA DEPAN (PEMBERIAN KARCIS FISIK) ---
    let isSubmittingQuickReg = false;
    if (formQuickReg) {
        formQuickReg.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmittingQuickReg) return;
            isSubmittingQuickReg = true;

            const rawNama = inputQuickNama.value.trim();
            const nama = rawNama || '-';

            const btnSubmit = formQuickReg.querySelector('button');
            btnSubmit.disabled = true;

            try {
                const activePrefix = getActivePrefix();
                const customNum = inputQuickNomor ? parseInt(inputQuickNomor.value) : null;
                const nextNum = (customNum && customNum > 0) ? customNum : getNextSequentialNumber(cachedAllQueues, activePrefix);

                // Cek apakah nomor dengan prefix ini sudah ada di antrian hari ini
                const exists = cachedAllQueues.some(q => {
                    const info = getTicketInfo(q);
                    return info.prefix === activePrefix && q.nomor_urut === nextNum;
                });

                if (exists) {
                    alert(`Nomor ${activePrefix}-${String(nextNum).padStart(3, '0')} sudah ada di antrian hari ini! Silakan gunakan nomor lain.`);
                    btnSubmit.disabled = false;
                    return;
                }

                const metodeInput = activePrefix === 'MO' ? 'QR' : 'Manual';

                const { error } = await supabaseClient
                    .from('antrian')
                    .insert({
                        kode_tim: currentTim === 'P' ? 'P' : 'M',
                        nomor_urut: nextNum,
                        nama_pendonor: nama,
                        metode_input: metodeInput,
                        status: 'menunggu',
                        nomor_id: '-',
                        unit_kerja: '-',
                        no_hp: '-',
                        gol_darah: '-'
                    });

                if (error) throw error;

                inputQuickNama.value = '';
                inputQuickNama.focus();
                fetchQueue();
            } catch (err) {
                console.error(err);
                alert('Gagal meregistrasi antrian: ' + (err.message || JSON.stringify(err)));
            } finally {
                btnSubmit.disabled = false;
                isSubmittingQuickReg = false;
            }
        });
    }

    // Modal Input Manual (Data Lengkap)
    if (formManual) {
        formManual.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tipeKarcis = document.getElementById('manual_tipe_antrian').value; // 'MM', 'MO', atau 'P'
            const nomorKarcisInput = document.getElementById('manual_nomor_karcis').value;
            const nama = document.getElementById('manual_nama').value;
            const nomor_id = document.getElementById('manual_nomor_id').value || '-';
            const unit_kerja = document.getElementById('manual_unit_kerja').value || '-';
            const no_hp = document.getElementById('manual_no_hp').value || '-';
            const gol_darah = document.getElementById('manual_gol_darah').value;

            const btnSubmit = document.getElementById('btn-submit-manual');
            btnSubmit.disabled = true;
            btnSubmit.innerText = 'Menambahkan...';

            try {
                let nextNum = parseInt(nomorKarcisInput);
                if (!nextNum || nextNum < 1) {
                    nextNum = getNextSequentialNumber(cachedAllQueues, tipeKarcis);
                }

                const kodeTim = tipeKarcis === 'P' ? 'P' : 'M';
                const metodeInput = tipeKarcis === 'MO' ? 'QR' : 'Manual';

                const { error } = await supabaseClient
                    .from('antrian')
                    .insert({
                        kode_tim: kodeTim,
                        nomor_urut: nextNum,
                        nama_pendonor: nama,
                        metode_input: metodeInput,
                        status: 'menunggu',
                        nomor_id: nomor_id,
                        unit_kerja: unit_kerja,
                        no_hp: no_hp,
                        gol_darah: gol_darah
                    });
                
                if (error) throw error;

                formManual.reset();
                fetchQueue();
                
                const manualModalElement = document.getElementById('manualModal');
                const manualModal = bootstrap.Modal.getInstance(manualModalElement);
                if (manualModal) manualModal.hide();
            } catch (err) {
                console.error(err);
                alert('Gagal menambah antrian: ' + (err.message || JSON.stringify(err)));
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerText = 'Tambah ke Antrian';
            }
        });
    }

    // --- 5. EKSPOR KE EXCEL (CSV) ---
    document.getElementById('btn-export').addEventListener('click', async () => {
        const startIso = getStartOfDayIso();
        const todayStr = new Date().toISOString().split('T')[0];
        
        try {
            const { data, error } = await supabaseClient
                .from('antrian')
                .select('*')
                .gte('waktu_ambil', startIso)
                .order('kode_tim', { ascending: true })
                .order('nomor_urut', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                alert('Tidak ada data antrian untuk diekspor hari ini.');
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "ID Antrian,Tim,Kategori,Kode Karcis,Nomor Urut,NRP/NIK,Nama Pendonor,Unit Kerja,No HP,Gol Darah,Metode Input,Status,Waktu Ambil,Waktu Panggil\n";

            data.forEach(row => {
                const info = getTicketInfo(row);
                const id = row.id_antrian;
                const tim = row.kode_tim === 'P' ? 'UTD Pangkep & STMC' : 'PMI Makassar & STMC';
                const kategori = info.badgeText;
                const kodeKarcis = info.fullCode;
                const nomorUrut = row.nomor_urut;
                
                const nik = `"${row.nomor_id || '-'}"`;
                const nama = `"${row.nama_pendonor || '-'}"`;
                const unit = `"${row.unit_kerja || '-'}"`;
                const hp = `"${row.no_hp || '-'}"`;
                const gol = `"${row.gol_darah || '-'}"`;
                
                const metode = row.metode_input;
                const status = row.status;
                const wAmbil = new Date(row.waktu_ambil).toLocaleString('id-ID');
                const wPanggil = row.waktu_panggil ? new Date(row.waktu_panggil).toLocaleString('id-ID') : '-';

                csvContent += `${id},"${tim}","${kategori}",${kodeKarcis},${nomorUrut},${nik},${nama},${unit},${hp},${gol},${metode},${status},"${wAmbil}","${wPanggil}"\n`;
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Rekap_Antrian_Donor_${todayStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error('Error saat ekspor:', err);
            alert('Gagal mengekspor data ke Excel.');
        }
    });
});
