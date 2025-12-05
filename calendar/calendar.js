// calendar.js
// Simple FullCalendar integration for appointment requests.
// - Stores events in localStorage (so they persist in browser).
// - On date/time click opens modal and allows user to request an appointment.
// - On submit, saves event locally and opens the user's email client (mailto) with details.
// Replace mailto behavior with a backend call for production.

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
    events: loadEvents(),
    dateClick: function(info) {
      // Open modal with default time at 10:00 on the clicked date
      const dt = info.date;
      const defaultISO = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getTime()).toISOString();
      selectedDateTimeInput.value = defaultISO;
      openModal();
    },
    select: function(selectionInfo) {
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

    // Basic conflict detection: prevent exact same start time
    const events = loadEvents();
    const conflict = events.find(ev => ev.start === dateTime);
    if (conflict) {
      if (!confirm('This slot is already requested. Do you still want to request it?')) {
        return;
      }
    }

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

    events.push(event);
    //saveEvents(events);
    //calendar.addEvent(event);

 

    // Open mailto so the shop gets notified (replace with API for production)
    const subject = encodeURIComponent('New Appointment Request: ' + name);
    const bodyLines = [
      'Name: ' + name,
      'Phone: ' + phone,
      'Email: ' + email,
      'Requested Date/Time: ' + dateTime,
      'Notes: ' + notes
    ];
    const body = encodeURIComponent(bodyLines.join('\n'));
    // TODO: replace youremail@example.com with your real email address
    const mailTo = 'mailto:corbythegarage@gmail.com?subject=' + subject + '&body=' + body;
    window.location.href = mailTo;

    alert('Appointment requested. Your email client was opened so you can send the request.');

       // 🔐 Ask for password
  const enteredPassword = prompt("Please send the email and after our review we add your request to our calendar:");
  if (enteredPassword === ADMIN_PASSWORD) {
    //events.push(event);
    saveEvents(events);
    calendar.addEvent(event);
    alert("Event saved successfully!");
  } else {
    alert("Incorrect password. Event not saved.");
  }

    closeModal();
  });
});
