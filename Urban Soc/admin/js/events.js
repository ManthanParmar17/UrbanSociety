// events.js â€” logic for admin events page (included via its HTML)\n// ==================== EVENTS DATA ====================
let events = [];

// backend-backed save placeholder (reloads instead of localStorage)
function saveEvents() {
    // no-op; backend is source of truth
}

// Load events from backend
function loadEventsData() {
    fetch("/get_events")
        .then(res => res.json())
        .then(data => {
            events = (data || []).map(ev => ({
                id: ev.id.toString(),
                title: ev.title,
                type: ev.type || 'General',
                date: ev.date,
                time: ev.start_time || '00:00',
                endTime: ev.end_time || '23:59',
                venue: ev.venue || 'TBD',
                capacity: ev.capacity || 0,
                description: ev.description || '',
                organizer: ev.organizer || '',
                contact: ev.contact || '',
                rsvp: {
                    going: ev.rsvp_going || 0,
                    maybe: ev.rsvp_maybe || 0,
                    declined: ev.rsvp_declined || 0
                },
                createdAt: ev.created_at
            }));
            try { localStorage.setItem('events_cache', JSON.stringify(events)); } catch (_) { }
            displayEvents();
            generateCalendar();
            updateStats();
            loadNotifications();
        })
        .catch(err => {
            console.error("Error loading events", err);
            const cached = localStorage.getItem('events_cache');
            events = cached ? JSON.parse(cached) : [];
            displayEvents();
            generateCalendar();
            updateStats();
            loadNotifications();
        });
}

// Current state
let currentFilters = {
    type: 'all',
    month: 'all',
    search: ''
};

let currentSort = 'date';
let calendarDate = new Date(); // Start calendar on current month
calendarDate.setDate(1); // Use month beginning for calendar grid
let editingEventId = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function () {
    // Check authentication
    const userRole = sessionStorage.getItem('userRole');
    if (!userRole || userRole !== 'admin') {
        window.location.href = '/';
        return;
    }

    const userName = sessionStorage.getItem('userName');
    if (userName) {
        document.getElementById('userName').textContent = userName.charAt(0).toUpperCase() + userName.slice(1);
    }

    // Set current date
    const today = new Date();
    document.getElementById('currentDate').textContent = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Set default form date
    document.getElementById('eventDate').value = today.toISOString().split('T')[0];
    document.getElementById('eventTime').value = '18:00';
    document.getElementById('eventEndTime').value = '20:00';

    // Load events
    loadEventsData();
    displayEvents();
    generateCalendar();
    updateStats();

    // Load notifications
    loadNotifications();
});

// ==================== TOAST NOTIFICATION ====================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    switch (type) {
        case 'success': icon = 'fa-check-circle'; break;
        case 'error': icon = 'fa-exclamation-circle'; break;
        case 'warning': icon = 'fa-exclamation-triangle'; break;
        case 'info': icon = 'fa-info-circle'; break;
    }

    toast.innerHTML = `
                <i class="fas ${icon}"></i>
                <span class="toast-message">${message}</span>
                <span class="toast-close" onclick="this.parentElement.remove()">&times;</span>
            `;

    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

// ==================== NOTIFICATIONS ====================
function toggleNotifications() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.toggle('show');
}

function closeNotifications() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.remove('show');
}

function loadNotifications() {
    const notifications = [];
    if (events.length) {
        notifications.push({
            type: 'event',
            title: `${events.length} upcoming event${events.length === 1 ? '' : 's'}`,
            time: 'Upcoming',
            icon: 'fas fa-calendar-alt'
        });
    }
    displayNotifications(notifications);
}

function displayNotifications(notifications) {
    const list = document.getElementById('notificationsList');
    const count = document.getElementById('notificationCount');

    if (!notifications.length) {
        list.innerHTML = '<div style="padding: 18px; text-align: center; color: #777;">No new notifications</div>';
        count.textContent = '0';
        return;
    }

    count.textContent = notifications.length;
    list.innerHTML = notifications.map((notif, index) => `
                <div class="notification-item ${index === 0 ? 'unread' : ''}" onclick="closeNotifications()">
                    <div class="notification-icon ${notif.type}"><i class="${notif.icon}"></i></div>
                    <div class="notification-content">
                        <div class="notification-title">${notif.title}</div>
                        <div class="notification-time">${notif.time}</div>
                    </div>
                </div>
            `).join('');
}

// Close notifications when clicking outside
document.addEventListener('click', function (e) {
    const badge = document.querySelector('.notification-badge');
    if (badge && !badge.contains(e.target)) {
        closeNotifications();
    }
});

// ==================== DISPLAY EVENTS ====================
function displayEvents() {
    const container = document.getElementById('eventsList');

    let filteredEvents = filterEvents();
    let sortedEvents = sortEventsData(filteredEvents);

    if (sortedEvents.length === 0) {
        container.innerHTML = `
                    <div style="text-align: center; padding: 60px; background: white; border-radius: 10px;">
                        <i class="fas fa-calendar-times" style="font-size: 48px; color: #ccc;"></i>
                        <p style="margin-top: 10px; color: #666;">No events found</p>
                    </div>
                `;
        return;
    }

    container.innerHTML = sortedEvents.map(event => createEventCard(event)).join('');
}

function createEventCard(event) {
    const eventDate = new Date(event.date);
    const day = eventDate.getDate();
    const month = eventDate.toLocaleString('default', { month: 'short' });
    const isUpcoming = new Date(event.date) >= new Date();

    return `
                <div class="event-card" id="event-${event.id}">
                    <div class="event-date-badge" style="background: ${isUpcoming ? 'var(--primary)' : '#6c757d'}">
                        <div class="event-date-day">${day}</div>
                        <div class="event-date-month">${month}</div>
                    </div>
                    
                    <div class="event-details">
                        <h3 class="event-title">${event.title}</h3>
                        <div class="event-meta">
                            <span><i class="fas fa-clock"></i> ${formatTime(event.time)} - ${formatTime(event.endTime)}</span>
                            <span><i class="fas fa-map-marker-alt"></i> ${event.venue}</span>
                            <span><i class="fas fa-tag"></i> ${event.type}</span>
                            <span><i class="fas fa-users"></i> Capacity: ${event.capacity}</span>
                            ${event.organizer ? `<span><i class="fas fa-user"></i> ${event.organizer}</span>` : ''}
                        </div>
                        
                        <div class="rsvp-section">
                            <div class="rsvp-count">
                                <div class="rsvp-item">
                                    <div class="rsvp-number">${event.rsvp.going}</div>
                                    <div class="rsvp-label">Going</div>
                                </div>
                                <div class="rsvp-item">
                                    <div class="rsvp-number">${event.rsvp.maybe}</div>
                                    <div class="rsvp-label">Maybe</div>
                                </div>
                                <div class="rsvp-item">
                                    <div class="rsvp-number">${event.rsvp.declined}</div>
                                    <div class="rsvp-label">Declined</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="event-actions">
                        <button class="action-btn view" onclick="viewEvent('${event.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn assign" onclick="editEvent('${event.id}')" title="Edit Event">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn assign" onclick="shareEvent('${event.id}')" title="Share Event">
                            <i class="fas fa-share-alt"></i>
                        </button>
                        <button class="action-btn resolve" onclick="sendReminder('${event.id}')" title="Send Reminder">
                            <i class="fas fa-bell"></i>
                        </button>
                        <button class="action-btn reject" onclick="deleteEvent('${event.id}')" title="Delete Event">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
}

// ==================== FILTER EVENTS ====================
function filterEvents() {
    return events.filter(event => {
        // Type filter
        if (currentFilters.type !== 'all' && event.type !== currentFilters.type) {
            return false;
        }

        // Month filter
        if (currentFilters.month !== 'all') {
            const eventMonth = event.date.substring(5, 7);
            if (eventMonth !== currentFilters.month) {
                return false;
            }
        }

        // Search filter
        if (currentFilters.search) {
            const searchTerm = currentFilters.search.toLowerCase();
            return event.title.toLowerCase().includes(searchTerm) ||
                event.description.toLowerCase().includes(searchTerm) ||
                event.venue.toLowerCase().includes(searchTerm) ||
                event.organizer.toLowerCase().includes(searchTerm);
        }

        return true;
    });
}

function sortEventsData(eventsArray) {
    return eventsArray.sort((a, b) => {
        if (currentSort === 'date') {
            return new Date(a.date) - new Date(b.date);
        } else {
            return a.title.localeCompare(b.title);
        }
    });
}

// ==================== FILTER HANDLERS ====================
function filterByType(type) {
    currentFilters.type = type;
    displayEvents();
    generateCalendar();
}

function filterByMonth(month) {
    currentFilters.month = month;
    displayEvents();
    generateCalendar();
}

function searchEvents() {
    currentFilters.search = document.getElementById('searchEvent').value;
    displayEvents();
}

function sortEvents(type) {
    currentSort = type;
    displayEvents();
}

// ==================== UPDATE STATS ====================
function updateStats() {
    const totalEvents = events.length;
    const currentMonth = new Date().getMonth() + 1;
    const thisMonth = events.filter(e => Number(e.date.substring(5, 7)) === currentMonth).length;
    const totalAttendees = events.reduce((sum, e) => sum + (e.rsvp.going || 0) + (e.rsvp.maybe || 0) + (e.rsvp.declined || 0), 0);
    const upcoming = events.filter(e => new Date(e.date) >= new Date()).length;

    document.getElementById('totalEvents').textContent = totalEvents;
    document.getElementById('monthEvents').textContent = thisMonth;
    document.getElementById('totalAttendees').textContent = totalAttendees;
    document.getElementById('upcomingEvents').textContent = upcoming;
    document.getElementById('notificationCount').textContent = upcoming;
}

// ==================== SAVE EVENT ====================
function saveEvent(event) {
    event.preventDefault();

    const title = document.getElementById('eventTitle').value;
    const type = document.getElementById('eventType').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const endTime = document.getElementById('eventEndTime').value || '23:59';
    const venue = document.getElementById('eventVenue').value;
    const capacity = parseInt(document.getElementById('eventCapacity').value) || 100;
    const description = document.getElementById('eventDescription').value;
    const organizer = document.getElementById('eventOrganizer').value;
    const contact = document.getElementById('eventContact').value;

    // Validate
    if (!title || !date || !time || !venue) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    const payload = {
        title, type, date,
        start_time: time,
        end_time: endTime,
        venue, capacity, description, organizer, contact
    };

    const url = editingEventId ? "/update_event" : "/add_event";
    if (editingEventId) payload.id = editingEventId;

    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(result => {
            if (result.error) throw new Error(result.error);
            showToast(editingEventId ? 'Event updated successfully!' : 'Event created successfully!');
            editingEventId = null;
            document.getElementById('eventForm').reset();
            toggleEventForm();
            loadEventsData();
        })
        .catch(err => {
            console.error(err);
            showToast('Error saving event: ' + err.message, 'error');
        });
}

// ==================== VIEW EVENT ====================
function viewEvent(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    const details = document.getElementById('eventDetails');
    const eventDate = new Date(event.date);

    details.innerHTML = `
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <h3 style="color: var(--primary); margin-bottom: 15px;">${event.title}</h3>
                    
                    <div class="detail-row">
                        <span class="detail-label">Event ID:</span>
                        <span class="detail-value">${event.id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">${event.type}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date:</span>
                        <span class="detail-value">${eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Time:</span>
                        <span class="detail-value">${formatTime(event.time)} - ${formatTime(event.endTime)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Venue:</span>
                        <span class="detail-value">${event.venue}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Capacity:</span>
                        <span class="detail-value">${event.capacity} people</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Organizer:</span>
                        <span class="detail-value">${event.organizer}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Contact:</span>
                        <span class="detail-value">${event.contact}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Description:</span>
                        <span class="detail-value">${event.description || 'No description'}</span>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h4 style="color: var(--primary);">RSVP Summary</h4>
                        <div style="display: flex; gap: 20px; margin-top: 10px;">
                            <div><span style="color: var(--success);">âœ“ Going:</span> ${event.rsvp.going}</div>
                            <div><span style="color: var(--warning);">? Maybe:</span> ${event.rsvp.maybe}</div>
                            <div><span style="color: var(--danger);">âœ— Declined:</span> ${event.rsvp.declined}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 15px; color: #999; font-size: 0.9rem;">
                        Created: ${formatDate(event.createdAt)}
                    </div>
                </div>
            `;

    openModal('viewModal');
}

// ==================== EDIT EVENT ====================
function editEvent(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    editingEventId = id;

    // Populate form
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventType').value = event.type;
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventTime').value = event.time;
    document.getElementById('eventEndTime').value = event.endTime;
    document.getElementById('eventVenue').value = event.venue;
    document.getElementById('eventCapacity').value = event.capacity;
    document.getElementById('eventDescription').value = event.description;
    document.getElementById('eventOrganizer').value = event.organizer;
    document.getElementById('eventContact').value = event.contact;

    toggleEventForm();
}

// ==================== DELETE EVENT ====================
function deleteEvent(id) {
    if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
        fetch("/delete_event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        })
            .then(res => res.json())
            .then(result => {
                if (result.error) throw new Error(result.error);
                showToast('Event deleted successfully', 'warning');
                loadEventsData();
            })
            .catch(err => {
                console.error(err);
                showToast('Error deleting event: ' + err.message, 'error');
            });
    }
}

// ==================== SHARE EVENT ====================
function shareEvent(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    const shareContent = document.getElementById('shareContent');
    shareContent.innerHTML = `
                <div style="text-align: center;">
                    <h3>${event.title}</h3>
                    <p style="margin: 15px 0;">${formatDate(event.date)} at ${formatTime(event.time)}</p>
                    <p>Venue: ${event.venue}</p>
                    <p style="color: #666; margin: 15px 0;">Share this event with members:</p>
                    <div style="display: flex; gap: 20px; justify-content: center; font-size: 2rem;">
                        <i class="fab fa-whatsapp" onclick="shareVia('whatsapp', '${event.id}')" style="color: #25D366; cursor: pointer;"></i>
                        <i class="fab fa-facebook" onclick="shareVia('facebook', '${event.id}')" style="color: #1877F2; cursor: pointer;"></i>
                        <i class="fas fa-envelope" onclick="shareVia('email', '${event.id}')" style="color: #EA4335; cursor: pointer;"></i>
                    </div>
                </div>
            `;

    openModal('shareModal');
}

function shareVia(platform, id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    const text = `Join us for ${event.title} on ${formatDate(event.date)} at ${formatTime(event.time)} at ${event.venue}!`;

    switch (platform) {
        case 'whatsapp':
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
            break;
        case 'facebook':
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(text)}`);
            break;
        case 'email':
            window.location.href = `mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(text)}`;
            break;
    }

    closeModal('shareModal');
    showToast(`Shared via ${platform}`);
}

function copyToClipboard() {
    const text = document.getElementById('shareContent').innerText;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
        closeModal('shareModal');
    });
}

// ==================== SEND REMINDER ====================
function sendReminder(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    showToast(`Reminders sent to ${event.rsvp.going} members for: ${event.title}`, 'info');
}

// ==================== RSVP FUNCTIONS ====================
function openRSVPModal(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    const details = document.getElementById('rsvpEventDetails');
    details.innerHTML = `
                <h3>${event.title}</h3>
                <p>${formatDate(event.date)} at ${formatTime(event.time)}</p>
                <p>Current: Going: ${event.rsvp.going}, Maybe: ${event.rsvp.maybe}, Declined: ${event.rsvp.declined}</p>
            `;

    // Use explicit ID to avoid passing the whole object to server
    window.currentRSVPEventId = Number(event.id) || null;
    openModal('rsvpModal');
}

function submitRSVP(status) {
    let eventId = Number(window.currentRSVPEventId);
    if (!eventId || isNaN(eventId)) {
        const fallback = window.currentRSVPEvent;
        eventId = Number(fallback?.id || fallback);
    }
    if (!eventId || isNaN(eventId)) {
        showToast('Unable to determine event ID for RSVP', 'error');
        return;
    }

    fetch("/rsvp_event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, status })
    })
        .then(res => res.json())
        .then(result => {
            if (result.error) throw new Error(result.error);
            showToast(`RSVP updated: ${status}`);
            closeModal('rsvpModal');
            loadEventsData();
        })
        .catch(err => {
            console.error(err);
            showToast('Error updating RSVP: ' + err.message, 'error');
        });
}

// ==================== CALENDAR FUNCTIONS ====================
function generateCalendar() {
    const grid = document.getElementById('calendarGrid');
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    document.getElementById('currentMonthYear').textContent =
        calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = '';

    // Day headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day"></div>';
    }

    // Calendar days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = events.filter(e => e.date === dateStr);

        html += `
                    <div class="calendar-day">
                        <div class="calendar-day-number">${day}</div>
                        ${dayEvents.map(e => `
                            <div class="calendar-event" onclick="viewEvent('${e.id}')">
                                ${e.time} ${e.title.substring(0, 15)}${e.title.length > 15 ? '...' : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
    }

    grid.innerHTML = html;
}

function changeMonth(delta) {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
    generateCalendar();
}

// ==================== TOGGLE FUNCTIONS ====================
function toggleEventForm() {
    const form = document.getElementById('addEventForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';

    if (form.style.display === 'none') {
        document.getElementById('eventForm').reset();
        editingEventId = null;
    }
}

function toggleCalendar() {
    const calendar = document.getElementById('calendarView');
    calendar.style.display = calendar.style.display === 'none' ? 'block' : 'none';
    if (calendar.style.display === 'block') {
        generateCalendar();
    }
}

// ==================== MODAL FUNCTIONS ====================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'rsvpModal') {
        window.currentRSVPEvent = null;
    }
}

// ==================== UTILITY FUNCTIONS ====================
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}

// ==================== GO BACK ====================
function goBack() {
    window.history.back();
}

// ==================== LOGOUT ====================
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.clear();
        window.location.href = '/';
    }
}
