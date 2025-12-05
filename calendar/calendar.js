// calendar.js — create / edit / delete support with localStorage persistence
// - stable ids (crypto.randomUUID fallback)
// - conflict detection (same start time)
// - safer localStorage handling and optional server POST example

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const calendarEl = document.getElementById('calendar');
  const modal = document.getElementById('bookingModal');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelButton = document.getElementById('cancelButton');
  const bookingForm = document.getElementById('bookingForm');
  const selectedDateTimeInput = document.getElementById('selectedDateTime');
  const deleteButton = document.getElementById('deleteButton');
  const saveButton = document.getElementById('saveButton');

  // read CSS variables so colors match site theme
  const rootStyles = getComputedStyle(document.documentElement);
  const PRIMARY_COLOR = rootStyles.getPropertyValue('--primary').trim() || '#0b6cf3';
  const PRIMARY_DARK = rootStyles.getPropertyValue('--primary-dark').trim() || '#075acc';
  const TEXT_ON_PRIMARY = rootStyles.getPropertyValue('--accent-contrast').trim() || '#ffffff';

  let currentEventId = null;
  let saveTimeout = null;

  function safeParseJSON(raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function loadEvents() {
    try {
      const raw = localStorage.getItem('garage_bookings');
      const arr = raw ? safeParseJSON(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.error('loadEvents error', e);
      return [];
    }
  }

  // Debounced save to avoid rapid repeated writes
  function saveEvents(events) {
    try {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        try {
          localStorage.setItem('garage_bookings', JSON.stringify(events));
        } catch (err) {
          console.error('saveEvents error', err);
        }
      }, 150);
    } catch (e) {
      console.error('saveEvents outer error', e);
    }
  }

  function makeId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'evt-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  }

  // Normalize loaded events: ensure id, start, and color props exist
  const storedEvents = loadEvents().map(ev => {
    const start = ev.start || ev.date || ev.startStr || null;
    return Object.assign({}, ev, {
      id: ev.id || makeId(),
      start: start,
      allDay: !!ev.allDay,
      backgroundColor: ev.backgroundColor || PRIMARY_COLOR,
      borderColor: ev.borderColor || PRIMARY_DARK,
      textColor: ev.textColor || TEXT_ON_PRIMARY,
      extendedProps: ev.extendedProps || ev.extendedProps === null ? ev.extendedProps : {
        name: ev.name || (ev.extendedProps && ev.extendedProps.name) || '',
        phone: ev.phone || (ev.extendedProps && ev.extendedProps.phone) || '',
        email: ev.email || (ev.extendedProps && ev.extendedProps.email) || '',
        notes: ev.notes || (ev.extendedProps && ev.extendedProps.notes) || ''
      }
    });
  });

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    selectable: true,
    editable: false,
    allDaySlot: false,
    slotMinTime: "08:00:00",
    slotMaxTime: "18:00:00",
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    eventColor: PRIMARY_COLOR,
    events: storedEvents,
    dateClick: function (info) {
      currentEventId = null;
      clearForm();
      const dt = info.date;
      const defaultISO = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 10, 0, 0).toISOString();
      selectedDateTimeInput.value = defaultISO;
      showDeleteButton(false);
      openModal();
    },
    select: function (selectionInfo) {
      currentEventId = null;
      clearForm();
      // selectionInfo.startStr is ISO-like; prefer startStr for consistency
      selectedDateTimeInput.value = selectionInfo.startStr || (selectionInfo.start ? selectionInfo.start.toISOString() : '');
      showDeleteButton(false);
      openModal();
    },
    eventClick: function (info) {
      const e = info.event;
      currentEventId = e.id;
      const ext = e.extendedProps || {};
      document.getElementById('customerName').value = ext.name || '';
      document.getElementById('customerPhone').value = ext.phone || '';
      document.getElementById('customerEmail').value = ext.email || '';
      document.getElementById('notes').value = ext.notes || '';
      selectedDateTimeInput.value = e.start ? e.start.toISOString() : '';
      showDeleteButton(true);
      openModal();
    }
  });

  calendar.render();

  function showDeleteButton(show) {
    deleteButton.style.display = show ? 'inline-block' : 'none';
  }

  function openModal() {
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    // focus first input for keyboard users
    const first = bookingForm.querySelector('input, textarea, select');
    if (first) first.focus();
  }

  function closeModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    bookingForm.reset();
    currentEventId = null;
    showDeleteButton(false);
    // clear any selection in calendar
    try { calendar.unselect(); } catch (e) { /* ignore */ }
  }

  function clearForm() {
    bookingForm.reset();
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);

  // Simple conflict detection: same ISO start time (customize as needed)
  function isConflict(events, startISO, excludeId = null) {
    if (!startISO) return false;
    return events.some(ev => {
      if (!ev || !ev.start) return false;
      if (excludeId && ev.id === excludeId) return false;
      // compare normalized ISO strings (exact match)
      try {
        const a = new Date(ev.start).toISOString();
        const b = new Date(startISO).toISOString();
        return a === b;
      } catch (e) {
        return false;
      }
    });
  }

  // Save (create or update)
  bookingForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const dateTime = document.getElementById('selectedDateTime').value;
    const notes = document.getElementById('notes').value.trim();

    if (!name || !phone || !dateTime) {
      alert('Please fill in name, phone and selected date/time.');
      return;
    }

    // Validate date
    const parsed = Date.parse(dateTime);
    if (Number.isNaN(parsed)) {
      alert('Selected date/time is invalid. Please choose a valid date/time.');
      return;
    }
    const events = loadEvents();

    // Conflict check
    if (isConflict(events, dateTime, currentEventId)) {
      if (!confirm('There is already an appointment at this time. Do you want to continue and create/update anyway?')) {
        return;
      }
    }

    if (currentEventId) {
      // Update existing event in storage
      const idx = events.findIndex(ev => ev.id === currentEventId);
      if (idx !== -1) {
        events[idx] = Object.assign({}, events[idx], {
          title: 'Appointment: ' + name,
          start: new Date(dateTime).toISOString(),
          allDay: false,
          backgroundColor: PRIMARY_COLOR,
          borderColor: PRIMARY_DARK,
          textColor: TEXT_ON_PRIMARY,
          extendedProps: { name, phone, email, notes }
        });
        saveEvents(events);
      }

      // Update calendar event
      const calEvent = calendar.getEventById(currentEventId);
      if (calEvent) {
        calEvent.setProp('title', 'Appointment: ' + name);
        calEvent.setStart(new Date(dateTime));
        calEvent.setProp('backgroundColor', PRIMARY_COLOR);
        calEvent.setProp('borderColor', PRIMARY_DARK);
        calEvent.setProp('textColor', TEXT_ON_PRIMARY);
        calEvent.setExtendedProp('name', name);
        calEvent.setExtendedProp('phone', phone);
        calEvent.setExtendedProp('email', email);
        calEvent.setExtendedProp('notes', notes);
      }

      alert('Appointment updated.');
      closeModal();
      return;
    }

    // Create new event
    const newId = makeId();
    const newEvent = {
      id: newId,
      title: 'Appointment: ' + name,
      start: new Date(dateTime).toISOString(),
      allDay: false,
      backgroundColor: PRIMARY_COLOR,
      borderColor: PRIMARY_DARK,
      textColor: TEXT_ON_PRIMARY,
      extendedProps: { name, phone, email, notes }
    };

    // Optional: send to server instead of mailto (uncomment and adapt)
    /*
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId, name, phone, email, start: newEvent.start, notes
        })
      });
      if (!res.ok) throw new Error('Server error');
      const created = await res.json();
      // Use server response (created) to persist locally if desired
      events.push(created);
      saveEvents(events);
      calendar.addEvent(created);
      alert('Appointment requested and saved on server.');
      closeModal();
      return;
    } catch (err) {
      console.error('Server booking failed', err);
      // fallback to local save below or notify user
    }
    */

    // Save locally and add to calendar
    events.push(newEvent);
    saveEvents(events);
    calendar.addEvent(newEvent);

    // Legacy mailto fallback (keeps original behavior). Replace with server call in production.
    try {
      const subject = encodeURIComponent('New Appointment Request: ' + name);
      const bodyLines = [
        'Name: ' + name,
        'Phone: ' + phone,
        'Email: ' + email,
        'Requested Date/Time: ' + newEvent.start,
        'Notes: ' + notes
      ];
      const body = encodeURIComponent(bodyLines.join('\n'));
      const mailTo = 'mailto:youremail@example.com?subject=' + subject + '&body=' + body;
      // Only navigate if user agent supports mailto; otherwise skip
      window.location.href = mailTo;
    } catch (err) {
      console.warn('mailto fallback failed', err);
    }

    alert('Appointment requested. Your email client was opened so you can send the request.');
    closeModal();
  });

  // Delete
  deleteButton.addEventListener('click', function () {
    if (!currentEventId) return;
    if (!confirm('Delete this appointment? This will remove it permanently.')) return;

    let events = loadEvents();
    events = events.filter(ev => ev.id !== currentEventId);
    saveEvents(events);

    const calEvent = calendar.getEventById(currentEventId);
    if (calEvent) calEvent.remove();

    alert('Appointment deleted.');
    closeModal();
  });
});
