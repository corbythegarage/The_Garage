// calendar.js — sync with Google Sheets via Apps Script Web App
// - Periodically fetch events from the sheet web app
// - POST new bookings to web app (server-side conflict check)
// - Lock/mark events based on sheet status
// Fixed: do not force 10:00 — use clicked/selected time and datetime-local input handling.

document.addEventListener('DOMContentLoaded', function() {
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzRe-gQLGwnsOcEMvV6cuPHlzgLt4H7tHdXHHGpWiiU9dXGPvA8XOrxEEuDeEFqpxxc-Q/exec';
  const TOKEN = '9090thegarage9090';

  const calendarEl = document.getElementById('calendar');
  const modal = document.getElementById('bookingModal');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelButton = document.getElementById('cancelButton');
  const bookingForm = document.getElementById('bookingForm');
  // IMPORTANT: change this input in your calendar.html to type="datetime-local"
  const selectedDateTimeInput = document.getElementById('selectedDateTime');
  const deleteButton = document.getElementById('deleteButton');
  const saveButton = document.getElementById('saveButton');

  let currentEventId = null;

  // read CSS variables
  const rootStyles = getComputedStyle(document.documentElement);
  const PRIMARY_COLOR = rootStyles.getPropertyValue('--primary').trim() || '#0b6cf3';
  const PRIMARY_DARK = rootStyles.getPropertyValue('--primary-dark').trim() || '#075acc';
  const TEXT_ON_PRIMARY = rootStyles.getPropertyValue('--accent-contrast').trim() || '#ffffff';

  // helper: convert Date -> "YYYY-MM-DDTHH:mm" (local) for datetime-local input
  function toLocalDatetimeInputValue(date) {
    const pad = n => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // helper: convert a datetime-local value (local) to ISO UTC string
  function fromLocalInputToISOString(localValue) {
    // localValue is "YYYY-MM-DDTHH:mm" (browser creates Date in local timezone)
    const d = new Date(localValue);
    return d.toISOString(); // converts to UTC ISO with Z
  }

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
      if (e.start) {
        selectedDateTimeInput.value = toLocalDatetimeInputValue(new Date(e.start));
      } else {
        selectedDateTimeInput.value = '';
      }
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
          editable: false
        };
      });

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

  // dateClick: use the clicked date/time instead of forcing 10:00
  calendar.setOption('dateClick', function(info) {
    currentEventId = null;
    bookingForm.reset();
    const clickedDate = info.date; // includes time if user clicked on a time slot
    selectedDateTimeInput.value = toLocalDatetimeInputValue(clickedDate);
    showDeleteButton(false);
    openModal();
  });

  // select (drag to select a range): use selection start
  calendar.setOption('select', function(selectionInfo) {
    currentEventId = null;
    bookingForm.reset();
    // selectionInfo.start is an ISO; convert to Date then to local input format
    selectedDateTimeInput.value = toLocalDatetimeInputValue(new Date(selectionInfo.start));
    showDeleteButton(false);
    openModal();
  });

  // Submit booking (will POST to Apps Script)
  bookingForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const dateTimeLocal = document.getElementById('selectedDateTime').value;
    const notes = document.getElementById('notes').value.trim();

    if (!name || !phone || !dateTimeLocal) {
      alert('Please fill name, phone and selected date/time.');
      return;
    }

    // convert local datetime-local to ISO UTC
    const startISO = fromLocalInputToISOString(dateTimeLocal);
    const endISO = new Date(new Date(startISO).getTime() + 60*60*1000).toISOString();

    const payload = {
      token: TOKEN,
      start: startISO,
      end: endISO,
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
        const body = typeof json === 'object' ? json : { message: text };
        alert('Slot conflict: this time is already requested/confirmed. Please pick another time.');
        console.warn('Conflict response', body);
        await fetchEvents();
        return;
      }
      if (!res.ok) {
        alert('Failed to create booking: ' + (json && json.error ? json.error : res.statusText));
        return;
      }

      await fetchEvents();
      alert('Booking requested successfully. We will confirm soon.');
      closeModal();
    } catch (err) {
      console.error('submit booking error', err);
      alert('Error sending booking. Try again later.');
    }
  });

  // Delete handler remains the same (POST action=delete)
  const delBtn = document.getElementById('deleteButton');
  if (delBtn) {
    delBtn.addEventListener('click', async function() {
      if (!currentEventId) return;
      if (!confirm('Delete this appointment?')) return;

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
