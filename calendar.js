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

  // ZMIANA 1: Usuwamy funkcje loadEvents() i saveEvents() oparte na localStorage,
  // ponieważ teraz będziemy mieli stałe, zdefiniowane przez nas dane.
  /*
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
  */


  // ZMIANA 2: Definiujemy swoje stałe terminy zajętości.
  // Użytkownik nie może ich modyfikować.
  const storedEvents = [
    
  async function loadEvents() {
  const response = await fetch('/events.json'); // path depends on where you serve the file
  const storedEvents = await response.json();

  // Now you can use storedEvents just like before
  console.log(storedEvents);
  // e.g. pass to your calendar library
}

loadEvents();
    // Dodaj więcej swoich blokad tutaj...
  ];


  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    selectable: true,
    editable: false, // Użytkownik nie może edytować/przesuwać zdarzeń
    allDaySlot: false,
    slotMinTime: "08:00:00",
    slotMaxTime: "18:00:00",
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    eventColor: PRIMARY_COLOR,
    events: storedEvents, // Kalendarz używa teraz tylko Twoich stałych zdarzeń
    dateClick: function(info) {
      currentEventId = null;          // new event
      clearForm();
      const dt = info.date;
      const defaultISO = dt.toISOString();
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
      // ZMIANA 3: Po kliknięciu na istniejące zdarzenie, wyświetlamy tylko informację,
      // a nie otwieramy formularza edycji, bo użytkownik nie może edytować Twoich zajętości.
      const e = info.event;
      alert('Ten termin jest już zajęty: ' + e.title + ' (' + e.start.toLocaleString() + ')');
      // Usuwamy kod, który otwierał modal i wypełniał formularz danymi zdarzenia:
      /*
      const e = info.event;
      currentEventId = e.id;
      document.getElementById('customerName').value = (e.extendedProps && e.extendedProps.name) || '';
      // ... reszta wypełniania pól ...
      showDeleteButton(true);
      openModal();
      */
    }
  });

  calendar.render();

  function showDeleteButton(show) {
    deleteButton.style.display = show ? 'inline-block' : 'none';
  }
  // ... (reszta funkcji openModal, closeModal, clearForm, addEventListeners dla zamknięcia modala) ...

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

  // Save (tylko wysłanie maila, bez zapisu)
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

    // ZMIANA 4: Całkowicie usuwamy logikę zapisu do localStorage i aktualizacji kalendarza.
    // Zastępujemy ją tylko generowaniem linku mailto:.

    /*
    const events = loadEvents();
    if (currentEventId) {
      // USUWAMY CAŁY BLOK IF - nie ma edycji
    } else {
      // USUWAMY CAŁY BLOK ELSE Z TWORZENIEM NOWEGO ZDARZENIA I ZAPISYWANIEM
    }
    */

    // Pozostawiamy tylko ten fragment, który generuje e-mail:

    // open mailto to notify shop
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
    

    closeModal();
  });

  // ZMIANA 5: Całkowicie usuwamy listener dla deleteButton, ponieważ użytkownik nie może usuwać rezerwacji.
  /*
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
  */
});
