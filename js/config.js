// js/config.js
// Ganti dengan URL dan Anon Key dari project Supabase Anda
const SUPABASE_URL = 'https://odqfcalgabxrlldwlrdw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kcWZjYWxnYWJ4cmxsZHdscmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzIxNTAsImV4cCI6MjEwNzEwODE1MH0.yiTznEW5pSJFBgUGPQJg_LvVboSsT5ZAyDl8tzQ-D0s';

// Inisialisasi Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
