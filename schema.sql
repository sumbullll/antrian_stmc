-- schema.sql
-- Silakan jalankan script ini di SQL Editor Supabase Anda

-- 1. Table tim_medis
CREATE TABLE tim_medis (
    kode_tim CHAR(1) PRIMARY KEY,
    nama_tim VARCHAR NOT NULL
);

INSERT INTO tim_medis (kode_tim, nama_tim) VALUES 
('P', 'Medical Center Pangkep'),
('M', 'PMI Makassar');

-- 2. Table admin
CREATE TABLE admin (
    id_admin UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR NOT NULL UNIQUE,
    kode_tim CHAR(1) REFERENCES tim_medis(kode_tim)
);

-- 3. Table antrian
CREATE TYPE status_antrian AS ENUM ('menunggu', 'dipanggil', 'selesai', 'lewat');
CREATE TYPE metode_input_type AS ENUM ('QR', 'Manual');

CREATE TABLE antrian (
    id_antrian UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_tim CHAR(1) REFERENCES tim_medis(kode_tim),
    nomor_urut INT NOT NULL,
    nama_pendonor VARCHAR NOT NULL,
    status status_antrian DEFAULT 'menunggu',
    metode_input metode_input_type NOT NULL,
    waktu_ambil TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    waktu_panggil TIMESTAMP WITH TIME ZONE
);

-- Buat fungsi untuk auto-increment nomor antrian berdasarkan hari ini dan tim
CREATE OR REPLACE FUNCTION get_next_antrian(p_kode_tim CHAR(1), p_nama VARCHAR, p_metode metode_input_type)
RETURNS antrian
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_nomor INT;
    v_result antrian;
BEGIN
    -- Hitung max nomor hari ini untuk tim tersebut
    SELECT COALESCE(MAX(nomor_urut), 0) + 1 INTO v_next_nomor
    FROM antrian
    WHERE kode_tim = p_kode_tim
      AND DATE(waktu_ambil) = CURRENT_DATE;

    -- Insert baris baru
    INSERT INTO antrian (kode_tim, nomor_urut, nama_pendonor, metode_input)
    VALUES (p_kode_tim, v_next_nomor, p_nama, p_metode)
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;
