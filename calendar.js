// calendar.js
// FullCalendar integration with color settings matching site theme.
// - Uses eventColor option to set default event color
// - Newly created events include background/border/text color to match the design

document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');
  const modal = document.getElementById('bookingModal');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelButton = document.getElementById('cancelButton');
  const bookingForm = document.getElementById('bookingForm');
  const selectedDateTimeInput = document.getElementById('selectedDateTime');

  const PRIMARY_COLOR = '#0b6cf3';     //'#c42b39';
  const PRIMARY_DARK = '#075acc';
  const TEXT_ON_PRIMARY = '#ffffff';

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
    // Default color for events
    eventColor: PRIMARY_COLOR,
    events: loadEvents().map(ev => {
      // Ensure stored events include color properties for consistent display
      return Object.assign({}, ev, {
        backgroundColor: ev.backgroundColor || PRIMARY_COLOR,
        borderColor: ev.borderColor || PRIMARY_DARK,
        textColor: ev.textColor || TEXT_ON_PRIMARY
      });
    }),
    dateClick: function(info) {
      const dt = info.date;
      const defaultISO = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 10, 0, 0).toISOString();
      selectedDateTimeInput.value = defaultISO;
      openModal();
    },
    select: function(selectionInfo) {
      selectedDateTimeInput.value = selectionInfo.startStr;
      openModal();
    },
    eventClick: function(info) {
      const props = info.event.extendedProps || {};
      let msg = 'Booked by: ' + (props.name || 'Unknown');
      if (props.phone) msg += '\nPhone: ' + props.phone;
      if (props.email) msg += '\nEmail: ' + props.email;
      if (props.notes) msg += '\nNotes: ' + props.notes;
      alert(msg);
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
      backgroundColor: PRIMARY_COLOR,
      borderColor: PRIMARY_DARK,
      textColor: TEXT_ON_PRIMARY,
      extendedProps: {
        name: name,
        phone: phone,
        email: email,
        notes: notes
      }
    };

    events.push(event);
    saveEvents(events);

    // Add to calendar UI with color properties
    calendar.addEvent(event);

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
    const mailTo = 'mailto:youremail@example.com?subject=' + subject + '&body=' + body;
    window.location.href = mailTo;

    alert('Appointment requested. Your email client was opened so you can send the request.');

    closeModal();
  });
});
