// calendar.js — add create / edit / delete support and persist to localStorage
// Events now get stable ids so they can be updated/deleted.

document.addEventListener('DOMContentLoaded', function() {
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

  // Track currently selected event id (null for new event)
  let currentEventId = null;

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

  // Ensure loaded events have id and color props
  const storedEvents = loadEvents().map(ev => Object.assign({}, ev, {
    id: ev.id || ('evt-' + (new Date(ev.start).getTime())),
    backgroundColor: ev.backgroundColor || PRIMARY_COLOR,
    borderColor: ev.borderColor || PRIMARY_DARK,
    textColor: ev.textColor || TEXT_ON_PRIMARY
  }));

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
    dateClick: function(info) {
      currentEventId = null;          // new event
      clearForm();
      const dt = info.date;
      const defaultISO = dt.toISOString();//const defaultISO = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 08, 0, 0).toISOString();
      selectedDateTimeInput.value = defaultISO;
      showDeleteButton(false);
      openModal();
    },
    select: function(selectionInfo) {
      currentEventId = null;
      clearForm();
      selectedDateTimeInput.value = selectionInfo.startStr;
      showDeleteButton(false);
      openModal();
    },
    eventClick: function(info) {
      // populate modal with event data for editing or deleting
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

  function showDeleteButton(show) {
    deleteButton.style.display = show ? 'inline-block' : 'none';
  }

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

  function clearForm() {
    bookingForm.reset();
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);

  // Save (create or update)
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

    const events = loadEvents();

    if (currentEventId) {
      // Update existing event
      // Update in localStorage
      const idx = events.findIndex(ev => ev.id === currentEventId);
      if (idx !== -1) {
        events[idx] = Object.assign({}, events[idx], {
          title: 'Appointment: ' + name,
          start: dateTime,
          extendedProps: { name, phone, email, notes },
          backgroundColor: PRIMARY_COLOR,
          borderColor: PRIMARY_DARK,
          textColor: TEXT_ON_PRIMARY
        });
      }
      saveEvents(events);

      // Update calendar event
      const calEvent = calendar.getEventById(currentEventId);
      if (calEvent) {
        calEvent.setProp('title', 'Appointment: ' + name);
        calEvent.setStart(dateTime);
        // set color props by removing and re-adding with same id could be done, but FullCalendar allows setProp for styling props:
        calEvent.setProp('backgroundColor', PRIMARY_COLOR);
        calEvent.setProp('borderColor', PRIMARY_DARK);
        calEvent.setProp('textColor', TEXT_ON_PRIMARY);
        // update extendedProps
        calEvent.setExtendedProp('name', name);
        calEvent.setExtendedProp('phone', phone);
        calEvent.setExtendedProp('email', email);
        calEvent.setExtendedProp('notes', notes);
      }

      alert('Appointment updated.');
    } else {
      // Create new event
      const newId = 'evt-' + Date.now();
      const newEvent = {
        id: newId,
        title: 'Appointment: ' + name,
        start: dateTime,
        allDay: false,
        backgroundColor: PRIMARY_COLOR,
        borderColor: PRIMARY_DARK,
        textColor: TEXT_ON_PRIMARY,
        extendedProps: { name, phone, email, notes }
      };

      events.push(newEvent);
      saveEvents(events);
      calendar.addEvent(newEvent);

      // open mailto to notify shop (replace with server-side API in real setup)
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
    }

    closeModal();
  });

  // Delete
  deleteButton.addEventListener('click', function() {
    if (!currentEventId) return;
    if (!confirm('Delete this appointment? This will remove it permanently.')) return;

    // Remove from localStorage
    let events = loadEvents();
    events = events.filter(ev => ev.id !== currentEventId);
    saveEvents(events);

    // Remove from FullCalendar
    const calEvent = calendar.getEventById(currentEventId);
    if (calEvent) calEvent.remove();

    alert('Appointment deleted.');
    closeModal();
  });
});
