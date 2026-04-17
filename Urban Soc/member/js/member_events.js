document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('userRole');
    if (role !== 'member') {
        window.location.href = '/';
        return;
    }

    const userName = sessionStorage.getItem('userName') || 'Member';
    document.getElementById('userName').textContent = userName;

    loadEvents();
    const REFRESH_MS = 10000;
    setInterval(loadEvents, REFRESH_MS);

    const refreshBtn = document.getElementById('refreshEvents');
    if (refreshBtn) refreshBtn.addEventListener('click', loadEvents);
});

function loadEvents() {
    const container = document.getElementById('eventsContainer');
    fetch("/get_events")
        .then(res => res.json())
        .then(events => {
            if (!Array.isArray(events)) {
                throw new Error(events.error || 'Failed to load events');
            }
            renderEvents(events);
        })
        .catch(err => {
            console.error(err);
            container.innerHTML = `<div class="empty"><i class="fas fa-exclamation-circle"></i> Unable to load events.</div>`;
        });
}

function renderEvents(events) {
    const container = document.getElementById('eventsContainer');
    if (!events || events.length === 0) {
        container.innerHTML = `<div class="empty"><i class="fas fa-calendar-times"></i> No upcoming events.</div>`;
        return;
    }

    container.innerHTML = events.map(ev => {
        const date = formatDate(ev.date);
        const timeRange = `${formatTime(ev.start_time)}${ev.end_time ? ' - ' + formatTime(ev.end_time) : ''}`.trim() || '-';
        const venue = ev.venue || '-';
        const organizer = ev.organizer || '-';
        const contact = ev.contact || '-';
        return `
        <div class="card">
            <div class="badge"><i class="fas fa-tag"></i> ${ev.type || 'Event'}</div>
            <h3>${ev.title || 'Untitled event'}</h3>
            <p class="desc">${ev.description || 'No description provided.'}</p>
            <div class="detail-list">
                <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${date}</span></div>
                <div class="detail-row"><span class="detail-label">Venue</span><span class="detail-value">${venue}</span></div>
                <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${timeRange}</span></div>
                <div class="detail-row"><span class="detail-label">Organizer</span><span class="detail-value">${organizer}</span></div>
                <div class="detail-row"><span class="detail-label">Contact</span><span class="detail-value">${contact}</span></div>
                <div class="detail-row">
                    <span class="detail-label">RSVP</span>
                    <span class="detail-value">
                        <span class="pill going">Going: ${ev.rsvp_going || 0}</span>
                        <span class="pill maybe">Maybe: ${ev.rsvp_maybe || 0}</span>
                        <span class="pill declined">Declined: ${ev.rsvp_declined || 0}</span>
                    </span>
                </div>
            </div>
            <div class="actions" style="margin-top:6px;">
                <button class="btn btn-secondary" onclick="submitRSVP(${ev.id}, 'going')">Going</button>
                <button class="btn btn-secondary" onclick="submitRSVP(${ev.id}, 'maybe')">Maybe</button>
                <button class="btn btn-secondary" onclick="submitRSVP(${ev.id}, 'declined')">Declined</button>
            </div>
        </div>
    `;
    }).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return 'TBD';
    const opts = { weekday: 'short', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', opts);
}

function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m || '00'} ${ampm}`;
}

function submitRSVP(eventId, status) {
    fetch('/rsvp_event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, status })
    })
        .then(res => res.json())
        .then(result => {
            if (result.error) throw new Error(result.error);
            alert('RSVP updated: ' + status);
            loadEvents();
        })
        .catch(err => {
            console.error('RSVP error:', err);
            alert('Unable to update RSVP: ' + err.message);
        });
}

function logout() {
    sessionStorage.clear();
    window.location.href = '/';
}
// ======================== COMMENT ========================
// member_events.js -- handles member event listing, RSVP, and filters
