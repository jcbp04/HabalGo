/* HabalGo – Rider Registration (front-end only, vanilla JS) */
(() => {
  'use strict';

  /* ===== Configuration ===== */
  const CONFIG = {
    // Minimum rider age is NOT assumed. Set this to the verified legal requirement
    // (e.g. from LTO / local ordinance) once confirmed. null = no minimum check.
    MIN_AGE: null,
    MAX_FILE_MB: 5,
    PHOTO_TYPES: ['image/jpeg', 'image/png'],
    PHOTO_EXT: ['jpg', 'jpeg', 'png'],
    DOC_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
    DOC_EXT: ['pdf', 'jpg', 'jpeg', 'png'],
    SUBMIT_URL: null // set to your backend endpoint later
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const form = $('#regForm');
  const files = { photo: null, orcr: null, license: null };
  const touched = new Set();

  /* ===== Error helpers ===== */
  function setError(key, msg) {
    const el = $(`.error[data-for="${key}"]`);
    if (el) el.textContent = msg || '';
    const input = document.getElementById(key);
    if (input && input.type !== 'file' && input.type !== 'checkbox') {
      input.classList.toggle('invalid', !!msg);
      input.classList.toggle('valid', !msg && input.value.trim() !== '');
    }
    const zone = $(`.drop[data-key="${key}"]`);
    if (zone) zone.classList.toggle('has-error', !!msg);
    return !msg;
  }

  /* ===== Field validators (return error string or '') ===== */
  const validators = {
    lastName: v => v.trim() ? '' : 'Enter your last name.',
    firstName: v => v.trim() ? '' : 'Enter your first name.',
    middleInitial: v => /^[A-Z]$/.test(v) ? '' : 'Enter one letter for your middle initial.',
    dob(v) {
      if (!v) return 'Select your date of birth.';
      const d = new Date(v + 'T00:00:00'), today = new Date();
      if (isNaN(d)) return 'Enter a valid date.';
      if (d > today) return 'Date of birth cannot be in the future.';
      if (CONFIG.MIN_AGE !== null && ageOn(d) < CONFIG.MIN_AGE)
        return `You must be at least ${CONFIG.MIN_AGE} years old to register.`;
      return '';
    },
    confirm: () => $('#confirm').checked ? '' : 'Confirm that your information is accurate.'
  };

  function ageOn(dob) {
    const t = new Date();
    let age = t.getFullYear() - dob.getFullYear();
    const m = t.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < dob.getDate())) age--;
    return age;
  }

  function validateField(key) {
    const el = document.getElementById(key);
    const val = key === 'confirm' ? '' : el.value;
    return setError(key, validators[key](val));
  }

  function validateFile(key) {
    return setError(key, files[key] ? '' : {
      photo: 'Upload a face photo.',
      orcr: 'Upload your OR/CR.',
      license: "Upload your driver's license."
    }[key]);
  }

  /* ===== Inputs ===== */
  // Middle initial: one letter, auto-capitalized
  $('#middleInitial').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase();
  });
  $('#dob').max = new Date().toISOString().split('T')[0]; // block future dates

  ['lastName', 'firstName', 'middleInitial', 'dob'].forEach(key => {
    const el = document.getElementById(key);
    el.addEventListener('input', () => { if (touched.has(key)) validateField(key); updateProgress(); });
    el.addEventListener('blur', () => { touched.add(key); validateField(key); });
    el.addEventListener('change', () => { touched.add(key); validateField(key); updateProgress(); });
  });
  $('#confirm').addEventListener('change', () => { validateField('confirm'); updateProgress(); });

  /* ===== File handling ===== */
  function checkFile(file, key) {
    const isPhoto = key === 'photo';
    const types = isPhoto ? CONFIG.PHOTO_TYPES : CONFIG.DOC_TYPES;
    const exts = isPhoto ? CONFIG.PHOTO_EXT : CONFIG.DOC_EXT;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!types.includes(file.type) || !exts.includes(ext))
      return `Unsupported file type. Use ${exts.join(', ').toUpperCase()}.`;
    if (file.size > CONFIG.MAX_FILE_MB * 1024 * 1024)
      return `File is too large. Maximum size is ${CONFIG.MAX_FILE_MB} MB.`;
    if (file.size === 0) return 'This file is empty.';
    return '';
  }

  function setFile(key, file) {
    const err = checkFile(file, key);
    if (err) { clearFile(key, true); return setError(key, err); }
    files[key] = file;
    const zone = $(`.drop[data-key="${key}"]`);
    $('.drop-empty', zone).hidden = true;
    $('.drop-filled', zone).hidden = false;
    $('.fname', zone).textContent = file.name;
    zone.classList.add('filled');
    if (key === 'photo') {
      const img = $('#photoPreview');
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      img.dataset.url = URL.createObjectURL(file);
      img.src = img.dataset.url;
    }
    setError(key, '');
    updateProgress();
  }

  function clearFile(key, keepError) {
    files[key] = null;
    const zone = $(`.drop[data-key="${key}"]`);
    $('.drop-empty', zone).hidden = false;
    $('.drop-filled', zone).hidden = true;
    zone.classList.remove('filled');
    document.getElementById(key).value = '';
    if (key === 'photo') {
      const img = $('#photoPreview');
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      img.removeAttribute('src'); delete img.dataset.url;
    }
    if (!keepError) setError(key, '');
    updateProgress();
  }

  $$('.drop').forEach(zone => {
    const key = zone.dataset.key;
    const input = document.getElementById(key);
    const open = () => input.click();

    zone.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (btn) {
        e.stopPropagation();
        btn.dataset.action === 'remove' ? clearFile(key) : open();
        if (btn.dataset.action === 'remove') validateFile(key);
        return;
      }
      if (!files[key]) open();
    });
    zone.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === zone) { e.preventDefault(); open(); }
    });
    input.addEventListener('change', () => { if (input.files[0]) setFile(key, input.files[0]); });

    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
      e.preventDefault(); zone.classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
      e.preventDefault(); zone.classList.remove('dragging');
    }));
    zone.addEventListener('drop', e => {
      const f = e.dataTransfer.files[0];
      if (f) setFile(key, f);
    });
  });
  // Stop the browser from opening files dropped outside a zone
  ['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => e.preventDefault()));

  /* ===== Progress indicator ===== */
  function updateProgress() {
    const checks = [
      ...['lastName', 'firstName', 'middleInitial', 'dob'].map(k => !validators[k](document.getElementById(k).value)),
      !!files.photo, !!files.orcr, !!files.license, $('#confirm').checked
    ];
    const pct = Math.round(checks.filter(Boolean).length / checks.length * 100);
    $('#progressFill').style.width = pct + '%';
    $('#progressText').textContent = pct + '% complete';
  }

  /* ===== Submission ===== */
  function validateAll() {
    ['lastName', 'firstName', 'middleInitial', 'dob'].forEach(k => touched.add(k));
    const results = [
      ...['lastName', 'firstName', 'middleInitial', 'dob', 'confirm'].map(validateField),
      ...['photo', 'orcr', 'license'].map(validateFile)
    ];
    return results.every(Boolean);
  }

  /**
   * Backend integration point. Replace the simulated delay with a real request.
   * NOTE: Nothing is stored or sent anywhere in this front-end-only demo.
   */
  async function submitRegistration(data) {
    if (CONFIG.SUBMIT_URL) {
      const res = await fetch(CONFIG.SUBMIT_URL, { method: 'POST', body: data });
      if (!res.ok) throw new Error('Submission failed');
      return res.json();
    }
    await new Promise(r => setTimeout(r, 1800)); // simulated processing
    return { ok: true };
  }

  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateAll()) {
      const first = $('.invalid, .has-error, .error:not(:empty)');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const btn = $('#submitBtn');
    btn.classList.add('loading');
    $('.btn-label', btn).textContent = 'Submitting…';
    try {
      const data = new FormData();
      ['lastName', 'firstName', 'middleInitial', 'dob'].forEach(k => data.append(k, document.getElementById(k).value.trim()));
      data.append('facePhoto', files.photo);
      data.append('orcr', files.orcr);
      data.append('driversLicense', files.license);
      await submitRegistration(data);
      showScreen('successScreen');
    } catch (err) {
      setError('confirm', 'Submission failed. Check your connection and try again.');
    } finally {
      btn.classList.remove('loading');
      $('.btn-label', btn).textContent = 'Submit Registration';
    }
  });

  /* Demo only: return to a fresh form */
  $('#backBtn').addEventListener('click', () => {
    form.reset();
    Object.keys(files).forEach(k => clearFile(k));
    $$('input.valid, input.invalid').forEach(i => i.classList.remove('valid', 'invalid'));
    $$('.error').forEach(e => (e.textContent = ''));
    touched.clear();
    updateProgress();
    showScreen('registerScreen');
  });

  updateProgress();
})();
