// calendar.js — sync with Google Sheets via Apps Script Web App
// - Periodically fetch events from the sheet web app
// - POST new bookings to web app (server-side conflict check)
// - Lock/mark events based on sheet status

document.addEventListener('DOMContentLoaded', function() {
  const WEB_APP_URL = 'REPLACE_WITH_YOUR_WEB_APP_URL'; // from Apps Script deployment (do not include ?token)
  const TOKEN = 'REPLACE_WITH_YOUR_TOKEN'; // must match the TOKEN in Apps Script

  const calendarEl = document.getElementById('calendar');
  const modal = document.getElementById('bookingModal');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelButton = document.getElementById('cancelButton');
  const bookingForm = document.getElementById('bookingForm');
  const selectedDateTimeInput = document.getElementById('selectedDateTime');
  const deleteButton = document.getElementById('deleteButton');
  const saveButton = document.getElementById('saveButton');

  let currentEventId = null;

  // read CSS variables
  const rootStyles = getComputedStyle(document.documentElement);
  const PRIMARY_COLOR = rootStyles.getPropertyValue('--primary').trim() || '#0b6cf3';
  const PRIMARY_DARK = rootStyles.getPropertyValue('--primary-dark').trim() || '#075acc';
  const TEXT_ON_PRIMARY = rootStyles.getPropertyValue('--accent-contrast').trim() || '#ffffff';

  // FullCalendar instance
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
    events: [], // will load via fetchEvents()
    eventClick: function(info) {
      // populate form for edit/delete
      const e = info.event;
      currentEventId = e.id;
      document.getElementById('customerName').value = (e.extendedProps && e.extendedProps.name) || '';
      document.getElementById('customerPhone').value = (e.extendedProps && e.extendedProps.phone) || '';
      document.getElementById('customerEmail').value = (e.extendedProps && e.extendedProps.email) || '';
      document.getElementById('notes').value = (e.extendedProps && e.extendedProps.notes) || '';
      selectedDateTimeInput.value = e.start ? e.start.toISOString() : '';
      showDeleteButton(true);
      openModal();
    }
  });

  calendar.render();

  // Fetch events from Google Sheet web app
  async function fetchEvents() {
    try {
      const url = `${WEB_APP_URL}?token=${encodeURIComponent(TOKEN)}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn('Failed to fetch events from sheet', res.status);
        return;
      }
      const items = await res.json();

      // Map sheet rows to FullCalendar events. Use status to color/lock.
      const fcEvents = items.map(it => {
        const status = (it.status || '').toLowerCase();
        const isBusy = (status === 'confirmed' || status === 'requested');
        // Use different color for cancelled or free
        const bg = isBusy ? PRIMARY_COLOR : '#9e9e9e';
        const border = isBusy ? PRIMARY_DARK : '#666';
        const textColor = isBusy ? TEXT_ON_PRIMARY : '#000';
        return {
          id: it.id,
          title: it.title || ('Appointment: ' + (it.name || '')),
          start: it.start,
          end: it.end || undefined,
          backgroundColor: it.backgroundColor || bg,
          borderColor: it.borderColor || border,
          textColor: it.textColor || textColor,
          extendedProps: {
            name: it.name,
            phone: it.phone,
            email: it.email,
            notes: it.notes,
            status: it.status
          },
          // make busy events non-draggable and visually "locked"
          editable: false
        };
      });

      // Remove all existing events and add fresh ones
      calendar.getEvents().forEach(ev => ev.remove());
      for (const ev of fcEvents) calendar.addEvent(ev);
    } catch (err) {
      console.error('fetchEvents error', err);
    }
  }

  // initial load and polling (every 45 seconds)
  fetchEvents();
  setInterval(fetchEvents, 45000);

  function openModal() {
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    bookingForm.reset();
    currentEventId = null;
    showDeleteButton(false);
  }

  function showDeleteButton(show) {
    const db = document.getElementById('deleteButton');
    if (db) db.style.display = show ? 'inline-block' : 'none';
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);

  // On dateClick / select handlers (if you want them) - keep earlier logic
  calendar.setOption('dateClick', function(info) {
    currentEventId = null;
    bookingForm.reset();
    const dt = info.date;
    const defaultISO = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 10, 0, 0).toISOString();
    selectedDateTimeInput.value = defaultISO;
    showDeleteButton(false);
    openModal();
  });

  calendar.setOption('select', function(selectionInfo) {
    currentEventId = null;
    bookingForm.reset();
    selectedDateTimeInput.value = selectionInfo.startStr;
    showDeleteButton(false);
    openModal();
  });

  // Submit booking (will POST to Apps Script)
  bookingForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const dateTime = document.getElementById('selectedDateTime').value;
    const notes = document.getElementById('notes').value.trim();

    if (!name || !phone || !dateTime) {
      alert('Please fill name, phone and selected date/time.');
      return;
    }

    // Build payload
    const payload = {
      token: TOKEN,
      start: dateTime,
      // default to one-hour slot; you may add end input in the form later
      end: new Date(new Date(dateTime).getTime() + 60*60*1000).toISOString(),
      title: 'Appointment: ' + name,
      name,
      phone,
      email,
      notes,
      status: 'requested'
    };

    try {
      const res = await fetch(WEB_APP_URL + '?token=' + encodeURIComponent(TOKEN), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch(_) { json = {raw: text}; }

      if (res.status === 409) {
        // conflict
        const body = typeof json === 'object' ? json : { message: text };
        alert('Slot conflict: this time is already requested/confirmed. Please pick another time.');
        // Optionally show conflicting entry details
        console.warn('Conflict response', body);
        // Reload events to show current state
        await fetchEvents();
        return;
      }
      if (!res.ok) {
        alert('Failed to create booking: ' + (json && json.error ? json.error : res.statusText));
        return;
      }

      // Success — refresh events and optionally open mailto or show confirmation
      await fetchEvents();
      alert('Booking requested successfully. We will confirm soon.');
      closeModal();
    } catch (err) {
      console.error('submit booking error', err);
      alert('Error sending booking. Try again later.');
    }
  });

  // Delete (client-side deletion is supported only if you implement a delete endpoint in Apps Script)
  const delBtn = document.getElementById('deleteButton');
  if (delBtn) {
    delBtn.addEventListener('click', async function() {
      if (!currentEventId) return;
      if (!confirm('Delete this appointment?')) return;

      // For deletion we can implement a simple "mark status=cancelled" by POSTing with same id
      // If your Apps Script supports a "delete" action, call it. Example below uses a POST with action=delete
      try {
        const payload = { token: TOKEN, action: 'delete', id: currentEventId };
        const res = await fetch(WEB_APP_URL + '?token=' + encodeURIComponent(TOKEN), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) {
          alert('Failed to delete: ' + (json && json.error ? json.error : res.statusText));
          return;
        }
        await fetchEvents();
        alert('Appointment deleted.');
        closeModal();
      } catch (err) {
        console.error('delete error', err);
        alert('Delete failed.');
      }
    });
  }
});
