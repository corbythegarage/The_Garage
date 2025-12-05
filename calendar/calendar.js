// Simple FullCalendar integration for appointment requests.
// - Stores events in localStorage (so they persist in browser).
// - On date/time click opens modal and allows user to request an appointment.
// - On submit, saves event locally and opens mail client (mailto) with details.
// Replace mailto behavior with a server call or API for real persistence and confirmation.

document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');
  const modal = document.getElementById('bookingModal');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelButton = document.getElementById('cancelButton');
  const bookingForm = document.getElementById('bookingForm');
  const selectedDateTimeInput = document.getElementById('selectedDateTime');

  // Load stored events
  function loadEvents() {
    try {
      const raw = localStorage.getItem('garage_bookings');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function saveEvents(events) {
    localStorage.setItem('garage_bookings', JSON.stringify(events));
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    selectable: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: loadEvents(),
    dateClick: function(info) {
      // Open modal with default midday time for that date
      const dt = info.date;
      const defaultISO = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 10, 0, 0).toISOString();
      selectedDateTimeInput.value = defaultISO;
      openModal();
    },
    select: function(selectionInfo) {
      // If user selects a range, prefill that range start
      selectedDateTimeInput.value = selectionInfo.startStr;
      openModal();
    },
    eventClick: function(info) {
      alert('Booked by: ' + (info.event.extendedProps.name || 'Unknown') + '\nNotes: ' + (info.event.extendedProps.notes || ''));
    }
  });

  calendar.render();

  function openModal() {
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    bookingForm.reset();
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);

  bookingForm.addEventListener('submit', function(e) {
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

    // Create a simple event object
    const event = {
      title: 'Appointment: ' + name,
      start: dateTime,
      allDay: false,
      extendedProps: {
        name: name,
        phone: phone,
        email: email,
        notes: notes
      }
    };

    // Save to localStorage
    const events = loadEvents();
    events.push(event);
    saveEvents(events);

    // Add to calendar UI
    calendar.addEvent(event);

    // Open mailto to notify you (replace with server API if needed)
    const subject = encodeURIComponent('New Appointment Request: ' + name);
    const bodyLines = [
      'Name: ' + name,
      'Phone: ' + phone,
      'Email: ' + email,
      'Requested Date/Time: ' + dateTime,
      'Notes: ' + notes
    ];
    const body = encodeURIComponent(bodyLines.join('\n'));
    // Replace the email address below with your own email
    const mailTo = 'mailto:youremail@example.com?subject=' + subject + '&body=' + body;
    window.location.href = mailTo;

    alert('Appointment requested. We opened your email client so you can send the request. (This can be replaced with a backend API later.)');

    closeModal();
  });
});
