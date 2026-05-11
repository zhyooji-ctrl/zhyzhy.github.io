// ==================== DATA ====================
var tasks = [];
var calendarMonth = new Date().getMonth();
var calendarYear = new Date().getFullYear();
var defaultMusic = 'https://www.youtube.com/embed/jfKfPfyJRdk';
var streakData = { days: {}, currentStreak: 0 };

// Safe load
try {
    var savedTasks = localStorage.getItem('flowTasks');
    if (savedTasks) tasks = JSON.parse(savedTasks);
} catch(e) { tasks = []; }

try {
    var savedStreak = localStorage.getItem('flowStreak');
    if (savedStreak) streakData = JSON.parse(savedStreak);
} catch(e) { streakData = { days: {}, currentStreak: 0 }; }

function save() { try { localStorage.setItem('flowTasks', JSON.stringify(tasks)); } catch(e) {} }
function saveStreak() { try { localStorage.setItem('flowStreak', JSON.stringify(streakData)); } catch(e) {} }

// ==================== NOTIFICATIONS ====================
if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch(e) {}
}

function sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body: body }); } catch(e) {}
    }
}

// ==================== THEME ====================
function toggleTheme() {
    document.body.classList.toggle('dark');
    try { localStorage.setItem('flowTheme', document.body.classList.contains('dark') ? 'dark' : 'light'); } catch(e) {}
    if (typeof renderStats === 'function') renderStats();
}
try {
    if (localStorage.getItem('flowTheme') === 'dark') document.body.classList.add('dark');
} catch(e) {}

// ==================== WEATHER ====================
function getWeather(lat, lon) {
    try {
        fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current_weather=true')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var w = data.current_weather;
                var temp = Math.round(w.temperature);
                var code = w.weathercode;
                var emoji = '☀️';
                if (code <= 3) emoji = '☀️';
                else if (code <= 48) emoji = '🌫️';
                else if (code <= 67) emoji = '🌧️';
                else if (code <= 77) emoji = '❄️';
                else emoji = '⛈️';
                var tempEl = document.getElementById('weatherTemp');
                var emojiEl = document.getElementById('weatherEmoji');
                if (tempEl) tempEl.textContent = temp + '°';
                if (emojiEl) emojiEl.textContent = emoji;
            }).catch(function() {});
    } catch(e) {}
}

try {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                getWeather(pos.coords.latitude, pos.coords.longitude);
                try {
                    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&zoom=10')
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            var cityEl = document.getElementById('weatherCity');
                            if (cityEl) cityEl.textContent = data.address.city || data.address.town || 'Nearby';
                        }).catch(function() {
                            var cityEl = document.getElementById('weatherCity');
                            if (cityEl) cityEl.textContent = 'Current';
                        });
                } catch(e) {}
            },
            function() {
                var cityEl = document.getElementById('weatherCity');
                if (cityEl) cityEl.textContent = 'Location off';
            }
        );
    }
} catch(e) {}

// ==================== TASKS ====================
function addTask() {
    try {
        var input = document.getElementById('taskInput');
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        tasks.push({ id: Date.now(), text: text, done: false, date: null });
        input.value = '';
        save();
        renderAll();
    } catch(e) { console.log('addTask error:', e); }
}

function toggleTask(id) {
    try {
        var task = tasks.find(function(t) { return t.id === id; });
        if (!task) return;
        var wasDone = task.done;
        task.done = !task.done;
        save();
        if (!wasDone && task.done) {
            spawnParticles();
            updateStreak();
            sendNotification('Task Completed ✅', task.text);
        }
        renderAll();
    } catch(e) { console.log('toggleTask error:', e); }
}

function deleteTask(id) {
    try {
        tasks = tasks.filter(function(t) { return t.id !== id; });
        save();
        renderAll();
    } catch(e) { console.log('deleteTask error:', e); }
}

function updateTaskDate(id, val) {
    try {
        var task = tasks.find(function(t) { return t.id === id; });
        if (task) { task.date = val || null; save(); renderAll(); }
    } catch(e) { console.log('updateTaskDate error:', e); }
}

function updateStreak() {
    try {
        var today = new Date().toISOString().split('T')[0];
        if (!streakData.days) streakData.days = {};
        if (!streakData.days[today]) {
            streakData.days[today] = true;
            var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            streakData.currentStreak = streakData.days[yesterday] ? (streakData.currentStreak || 0) + 1 : 1;
            saveStreak();
        }
    } catch(e) {}
}

function getWeekProgress() {
    try {
        var today = new Date();
        var dayOfWeek = today.getDay();
        var startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        var daysActive = 0;
        for (var i = 0; i < 7; i++) {
            var d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            var key = d.toISOString().split('T')[0];
            if (streakData.days && streakData.days[key]) daysActive++;
        }
        return { daysActive: daysActive, pct: Math.round((daysActive / 7) * 100) };
    } catch(e) { return { daysActive: 0, pct: 0 }; }
}

function renderTaskList() {
    try {
        var list = document.getElementById('taskList');
        if (!list) return;
        if (!tasks || tasks.length === 0) {
            list.innerHTML = '<div class="empty-state">No tasks yet ✨<br><small>Add one above</small></div>';
            return;
        }
        var sorted = tasks.slice().sort(function(a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); });
        list.innerHTML = sorted.map(function(task) {
            var today = new Date().toISOString().split('T')[0];
            var isOverdue = task.date && task.date < today && !task.done;
            return '<li class="task-item">' +
                '<input type="checkbox" class="task-checkbox" ' + (task.done ? 'checked' : '') + ' onchange="toggleTask(' + task.id + ')" onclick="event.stopPropagation()">' +
                '<div class="task-content" onclick="toggleTask(' + task.id + ')">' +
                '<div class="task-text ' + (task.done ? 'done' : '') + '">' + escapeHtml(task.text) + '</div>' +
                '<input type="date" class="date-picker-mini ' + (isOverdue ? 'overdue' : '') + '" value="' + (task.date || '') + '" onchange="updateTaskDate(' + task.id + ',this.value)" onclick="event.stopPropagation()">' +
                '</div>' +
                '<button class="btn-danger" onclick="event.stopPropagation();deleteTask(' + task.id + ')">✕</button>' +
                '</li>';
        }).join('');
    } catch(e) { console.log('renderTaskList error:', e); }
}

function renderStats() {
    try {
        var today = new Date().toISOString().split('T')[0];
        var total = tasks ? tasks.length : 0;
        var done = tasks ? tasks.filter(function(t) { return t.done; }).length : 0;
        var overdue = tasks ? tasks.filter(function(t) { return t.date && t.date < today && !t.done; }).length : 0;

        var totalEl = document.getElementById('totalTasks');
        var doneEl = document.getElementById('doneTasks');
        var overdueEl = document.getElementById('overdueTasks');
        if (totalEl) totalEl.textContent = total;
        if (doneEl) doneEl.textContent = done;
        if (overdueEl) overdueEl.textContent = overdue;

        var wp = getWeekProgress();
        var streakDaysEl = document.getElementById('streakDays');
        var streakFillEl = document.getElementById('streakFill');
        if (streakDaysEl) streakDaysEl.textContent = wp.daysActive + '/7 days';
        if (streakFillEl) streakFillEl.style.width = wp.pct + '%';

        var ctx = document.getElementById('pieChart');
        if (!ctx) return;
        if (window.pieChart) window.pieChart.destroy();
        window.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Done', 'Pending'],
                datasets: [{ data: [done, Math.max(0, total - done)], backgroundColor: ['#34c759', '#0071e3'], borderWidth: 0 }]
            },
            options: { cutout: '72%', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, font: { size: 10 } } } } }
        });
    } catch(e) { console.log('renderStats error:', e); }
}

function renderCalendar() {
    try {
        var monthEl = document.getElementById('calMonth');
        if (monthEl) monthEl.textContent = new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
        var grid = document.getElementById('calendarGrid');
        if (!grid) return;
        var html = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function(d) { return '<div class="cal-day-header">' + d + '</div>'; }).join('');
        var firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
        var daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
        var today = new Date().toISOString().split('T')[0];
        var taskDates = {};
        if (tasks) tasks.forEach(function(t) { if (t.date) taskDates[t.date] = true; });
        for (var i = firstDay - 1; i >= 0; i--) html += '<div class="cal-day other-month"></div>';
        for (var d = 1; d <= daysInMonth; d++) {
            var dateStr = calendarYear + '-' + String(calendarMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            html += '<div class="cal-day' + (dateStr === today ? ' today' : '') + (taskDates[dateStr] ? ' has-task' : '') + '">' + d + '</div>';
        }
        grid.innerHTML = html;
    } catch(e) { console.log('renderCalendar error:', e); }
}

function changeMonth(d) {
    calendarMonth += d;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    renderCalendar();
}

// ==================== EXPORT / IMPORT ====================
function exportTasks() {
    try {
        var dataStr = JSON.stringify(tasks || [], null, 2);
        var blob = new Blob([dataStr], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'flow-tasks-backup-' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(url);
    } catch(e) { alert('Export failed: ' + e.message); }
}

function importTasks(input) {
    try {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    if (confirm('Import ' + imported.length + ' tasks? This will replace your current tasks.')) {
                        tasks = imported;
                        save();
                        renderAll();
                    }
                } else { alert('Invalid backup file.'); }
            } catch(err) { alert('Could not read file.'); }
        };
        reader.readAsText(file);
    } catch(e) { alert('Import failed: ' + e.message); }
    input.value = '';
}

// ==================== POMODORO ====================
var pomoState = {
    totalSeconds: 25 * 60,
    isRunning: false,
    isBreak: false,
    sessions: 0,
    endTime: null,
    interval: null,
    remaining: 25 * 60
};
try { pomoState.sessions = parseInt(localStorage.getItem('pomoSessions') || '0'); } catch(e) {}

function getPomoRemaining() {
    if (!pomoState.isRunning || !pomoState.endTime) return pomoState.remaining;
    return Math.max(0, Math.round((pomoState.endTime - Date.now()) / 1000));
}

function renderPomodoro() {
    try {
        var remaining = pomoState.isRunning ? getPomoRemaining() : pomoState.remaining;
        var timeEl = document.getElementById('pomoTime');
        var labelEl = document.getElementById('pomoLabel');
        var startEl = document.getElementById('pomoStart');
        var sessionsEl = document.getElementById('pomoSessions');
        if (timeEl) timeEl.textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
        if (labelEl) labelEl.textContent = pomoState.isBreak ? 'Break' : 'Focus';
        if (startEl) { startEl.textContent = pomoState.isRunning ? '⏸' : '▶'; startEl.classList.toggle('active', pomoState.isRunning); }
        if (sessionsEl) sessionsEl.textContent = 'Sessions: ' + pomoState.sessions;
    } catch(e) {}
}

function togglePomodoro() {
    try {
        if (pomoState.isRunning) {
            clearInterval(pomoState.interval);
            pomoState.remaining = getPomoRemaining();
            pomoState.isRunning = false;
            pomoState.endTime = null;
            pomoState.interval = null;
        } else {
            pomoState.isRunning = true;
            pomoState.endTime = Date.now() + pomoState.remaining * 1000;
            pomoState.interval = setInterval(function() {
                var remaining = getPomoRemaining();
                if (remaining <= 0) {
                    clearInterval(pomoState.interval);
                    pomoState.isRunning = false;
                    pomoState.endTime = null;
                    pomoState.interval = null;
                    if (!pomoState.isBreak) {
                        pomoState.sessions++;
                        try { localStorage.setItem('pomoSessions', pomoState.sessions); } catch(e) {}
                        sendNotification('Pomodoro Complete!', 'Spin the wheel for your break!');
                        if (typeof showWheel === 'function') showWheel();
                    } else {
                        sendNotification('Break Over!', 'Time to focus again!');
                    }
                    pomoState.isBreak = !pomoState.isBreak;
                    pomoState.totalSeconds = pomoState.isBreak ? 5 * 60 : 25 * 60;
                    pomoState.remaining = pomoState.totalSeconds;
                    renderPomodoro();
                    return;
                }
                renderPomodoro();
            }, 250);
        }
        renderPomodoro();
    } catch(e) {}
}

function resetPomodoro() {
    try {
        clearInterval(pomoState.interval);
        pomoState.isRunning = false;
        pomoState.isBreak = false;
        pomoState.endTime = null;
        pomoState.interval = null;
        pomoState.totalSeconds = 25 * 60;
        pomoState.remaining = 25 * 60;
        renderPomodoro();
    } catch(e) {}
}

document.addEventListener('visibilitychange', function() {
    if (!document.hidden && pomoState.isRunning) {
        var remaining = getPomoRemaining();
        if (remaining <= 0) {
            clearInterval(pomoState.interval);
            pomoState.isRunning = false;
            pomoState.endTime = null;
            pomoState.interval = null;
            if (!pomoState.isBreak) {
                pomoState.sessions++;
                try { localStorage.setItem('pomoSessions', pomoState.sessions); } catch(e) {}
                sendNotification('Pomodoro Complete!', 'Spin the wheel!');
                if (typeof showWheel === 'function') showWheel();
            } else {
                sendNotification('Break Over!', 'Time to focus!');
            }
            pomoState.isBreak = !pomoState.isBreak;
            pomoState.totalSeconds = pomoState.isBreak ? 5 * 60 : 25 * 60;
            pomoState.remaining = pomoState.totalSeconds;
        }
        renderPomodoro();
    }
});

// ==================== SPIN WHEEL ====================
var wheelOptions = [
    { label: 'Walk', color: '#34c759' },
    { label: 'Water', color: '#0071e3' },
    { label: 'Rest Eyes', color: '#af52de' },
    { label: 'Phone', color: '#ff9500' },
    { label: 'Look Outside', color: '#5ac8fa' },
    { label: 'Breathe', color: '#ff3b30' },
    { label: 'Music', color: '#ff2d55' },
    { label: 'Doodle', color: '#ffcc00' }
];

var wheelCanvas = document.getElementById('wheelCanvas');
var wheelCtx = wheelCanvas ? wheelCanvas.getContext('2d') : null;
var wheelSpinning = false;
var wheelAngle = 0;

function drawWheel(rotation) {
    if (!wheelCtx) return;
    var cx = 160, cy = 160, radius = 150;
    var slices = wheelOptions.length;
    var arcSize = (2 * Math.PI) / slices;
    wheelCtx.clearRect(0, 0, 320, 320);
    wheelCtx.save();
    wheelCtx.translate(cx, cy);
    wheelCtx.rotate(rotation);
    wheelCtx.translate(-cx, -cy);
    for (var i = 0; i < slices; i++) {
        var startAngle = i * arcSize - Math.PI / 2;
        var endAngle = startAngle + arcSize;
        wheelCtx.beginPath();
        wheelCtx.moveTo(cx, cy);
        wheelCtx.arc(cx, cy, radius, startAngle, endAngle);
        wheelCtx.closePath();
        wheelCtx.fillStyle = wheelOptions[i].color;
        wheelCtx.fill();
        wheelCtx.strokeStyle = 'rgba(255,255,255,0.3)';
        wheelCtx.lineWidth = 2;
        wheelCtx.stroke();
        wheelCtx.save();
        wheelCtx.translate(cx, cy);
        wheelCtx.rotate(startAngle + arcSize / 2);
        wheelCtx.textAlign = 'center';
        wheelCtx.fillStyle = '#fff';
        wheelCtx.font = 'bold 13px -apple-system, sans-serif';
        wheelCtx.fillText(wheelOptions[i].label, 95, 5);
        wheelCtx.restore();
    }
    wheelCtx.beginPath();
    wheelCtx.arc(cx, cy, 25, 0, 2 * Math.PI);
    wheelCtx.fillStyle = '#fff';
    wheelCtx.fill();
    wheelCtx.fillStyle = '#1d1d1f';
    wheelCtx.font = 'bold 14px -apple-system, sans-serif';
    wheelCtx.textAlign = 'center';
    wheelCtx.fillText('GO', cx, cy + 5);
    wheelCtx.restore();
}

function getWheelResult(finalAngle) {
    var slices = wheelOptions.length;
    var arcSize = 360 / slices;
    var normalized = ((finalAngle % 360) + 360) % 360;
    var index = Math.floor(normalized / arcSize);
    return wheelOptions[(slices - index) % slices];
}

function showWheel() {
    var overlay = document.getElementById('wheelOverlay');
    if (!overlay) return;
    overlay.classList.add('show');
    var resultEl = document.getElementById('wheelResult');
    if (resultEl) { resultEl.classList.remove('show'); resultEl.textContent = ''; }
    wheelSpinning = false;
    wheelAngle = Math.random() * 360;
    var canvas = document.getElementById('wheelCanvas');
    if (canvas) canvas.style.transform = 'rotate(' + wheelAngle + 'deg)';
    drawWheel(wheelAngle * Math.PI / 180);
    setTimeout(spinWheel, 400);
}

function spinWheel() {
    if (wheelSpinning) return;
    wheelSpinning = true;
    var resultEl = document.getElementById('wheelResult');
    if (resultEl) resultEl.classList.remove('show');
    var extraSpins = 5 + Math.random() * 5;
    var totalRotation = extraSpins * 360 + Math.random() * 360;
    wheelAngle += totalRotation;
    var canvas = document.getElementById('wheelCanvas');
    if (canvas) canvas.style.transform = 'rotate(' + wheelAngle + 'deg)';
    setTimeout(function() {
        wheelSpinning = false;
        var result = getWheelResult(wheelAngle);
        var resultEl2 = document.getElementById('wheelResult');
        if (resultEl2) { resultEl2.textContent = result.label + ' - Enjoy your break!'; resultEl2.classList.add('show'); }
    }, 4200);
}

function closeWheel() {
    var overlay = document.getElementById('wheelOverlay');
    if (overlay) overlay.classList.remove('show');
    if (!pomoState.isRunning && pomoState.isBreak) togglePomodoro();
}

if (wheelCtx) drawWheel(0);

// ==================== MUSIC ====================
function toggleMusic() {
    var panel = document.getElementById('musicPanel');
    if (panel) panel.classList.toggle('open');
}

function updateMusic() {
    try {
        var urlInput = document.getElementById('musicUrl');
        if (!urlInput) return;
        var url = urlInput.value.trim();
        var embed = defaultMusic;
        if (url.indexOf('youtube.com/embed/') !== -1) embed = url.split('?')[0];
        else { var m = url.match(/(?:v=|\/)([\w-]{11})/); if (m) embed = 'https://www.youtube.com/embed/' + m[1]; }
        localStorage.setItem('flowMusic', embed);
        var container = document.getElementById('musicContainer');
        if (container) container.innerHTML = '<iframe src="' + embed + '" allow="autoplay; encrypted-media" allowfullscreen style="border-radius:14px;width:100%;height:180px;border:none;"></iframe>';
    } catch(e) {}
}

function renderMusic(url) {
    try {
        var container = document.getElementById('musicContainer');
        if (container) container.innerHTML = '<iframe src="' + url + '" allow="autoplay; encrypted-media" allowfullscreen style="border-radius:14px;width:100%;height:180px;border:none;"></iframe>';
    } catch(e) {}
}

// ==================== PARTICLES ====================
var particlesCanvas = document.getElementById('particlesCanvas');
var pctx = particlesCanvas ? particlesCanvas.getContext('2d') : null;
var particles = [];

function resizeCanvas() {
    if (particlesCanvas) { particlesCanvas.width = window.innerWidth; particlesCanvas.height = window.innerHeight; }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function spawnParticles() {
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    for (var i = 0; i < 30; i++) {
        particles.push({
            x: cx, y: cy,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 3,
            life: 1, decay: 0.015 + Math.random() * 0.025,
            size: 3 + Math.random() * 6,
            color: ['#34c759', '#0071e3', '#ff9500', '#ff3b30', '#af52de'][Math.floor(Math.random() * 5)]
        });
    }
    if (particles.length > 200) particles.splice(0, 30);
}

function animateParticles() {
    if (!pctx) return;
    pctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    particles = particles.filter(function(p) { return p.life > 0; });
    particles.forEach(function(p) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= p.decay;
        pctx.globalAlpha = p.life;
        pctx.fillStyle = p.color;
        pctx.beginPath();
        pctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        pctx.fill();
    });
    pctx.globalAlpha = 1;
    requestAnimationFrame(animateParticles);
}
if (pctx) animateParticles();

// ==================== UTILS ====================
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function renderAll() { renderTaskList(); renderStats(); renderCalendar(); }

// ==================== INIT ====================
try {
    var todayStr = new Date().toISOString().split('T')[0];
    if (tasks && tasks.some(function(t) { return t.done; })) {
        if (!streakData.days) streakData.days = {};
        if (!streakData.days[todayStr]) {
            var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            streakData.days[todayStr] = true;
            streakData.currentStreak = streakData.days[yesterday] ? (streakData.currentStreak || 0) + 1 : 1;
            saveStreak();
        }
    }
} catch(e) {}

renderAll();
renderPomodoro();
try {
    var savedMusic = localStorage.getItem('flowMusic') || defaultMusic;
    renderMusic(savedMusic);
    var musicUrlInput = document.getElementById('musicUrl');
    if (musicUrlInput && savedMusic !== defaultMusic) musicUrlInput.value = savedMusic;
} catch(e) {}
