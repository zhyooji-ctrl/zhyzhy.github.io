// ==================== DATA ====================
var tasks = JSON.parse(localStorage.getItem('flowTasks') || '[]');
var calendarMonth = new Date().getMonth();
var calendarYear = new Date().getFullYear();
var defaultMusic = 'https://www.youtube.com/embed/jfKfPfyJRdk';
var streakData = JSON.parse(localStorage.getItem('flowStreak') || '{"days":{},"currentStreak":0}');

function save() { localStorage.setItem('flowTasks', JSON.stringify(tasks)); }
function saveStreak() { localStorage.setItem('flowStreak', JSON.stringify(streakData)); }

// ==================== NOTIFICATIONS ====================
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}
requestNotificationPermission();

function sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍅</text></svg>' });
    }
}

// ==================== THEME ====================
function toggleTheme() {
    document.body.classList.toggle('dark');
    localStorage.setItem('flowTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
    renderStats();
}
if (localStorage.getItem('flowTheme') === 'dark') document.body.classList.add('dark');

// ==================== WEATHER ====================
function getWeather(lat, lon) {
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
            document.getElementById('weatherTemp').textContent = temp + '°';
            document.getElementById('weatherEmoji').textContent = emoji;
        })
        .catch(function() { document.getElementById('weatherCity').textContent = 'Unavailable'; });
}

if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            getWeather(pos.coords.latitude, pos.coords.longitude);
            fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&zoom=10')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    document.getElementById('weatherCity').textContent = data.address.city || data.address.town || 'Nearby';
                })
                .catch(function() { document.getElementById('weatherCity').textContent = 'Current'; });
        },
        function() { document.getElementById('weatherCity').textContent = 'Location off'; }
    );
}

// ==================== TASKS ====================
function addTask() {
    var input = document.getElementById('taskInput');
    var text = input.value.trim();
    if (!text) return;
    tasks.push({ id: Date.now(), text: text, done: false, date: null });
    input.value = '';
    save();
    renderAll();
}

function toggleTask(id) {
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
}

function deleteTask(id) {
    tasks = tasks.filter(function(t) { return t.id !== id; });
    save();
    renderAll();
}

function updateTaskDate(id, val) {
    var task = tasks.find(function(t) { return t.id === id; });
    if (task) { task.date = val || null; save(); renderAll(); }
}

function updateStreak() {
    var today = new Date().toISOString().split('T')[0];
    if (!streakData.days[today]) {
        streakData.days[today] = true;
        var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        streakData.currentStreak = streakData.days[yesterday] ? streakData.currentStreak + 1 : 1;
        saveStreak();
    }
}

function getWeekProgress() {
    var today = new Date();
    var dayOfWeek = today.getDay();
    var startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    var daysActive = 0;
    for (var i = 0; i < 7; i++) {
        var d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        if (streakData.days[d.toISOString().split('T')[0]]) daysActive++;
    }
    return { daysActive: daysActive, pct: Math.round((daysActive / 7) * 100) };
}

function renderTaskList() {
    var list = document.getElementById('taskList');
    if (!list) return;
    if (tasks.length === 0) {
        list.innerHTML = '<div class="empty-state">No tasks yet ✨<br><small>Add one above</small></div>';
        return;
    }
    list.innerHTML = tasks.sort(function(a, b) { return a.done - b.done; }).map(function(task) {
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
}

function renderStats() {
    var today = new Date().toISOString().split('T')[0];
    var total = tasks.length;
    var done = tasks.filter(function(t) { return t.done; }).length;
    var overdue = tasks.filter(function(t) { return t.date && t.date < today && !t.done; }).length;
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('doneTasks').textContent = done;
    document.getElementById('overdueTasks').textContent = overdue;
    var wp = getWeekProgress();
    document.getElementById('streakDays').textContent = wp.daysActive + '/7 days';
    document.getElementById('streakFill').style.width = wp.pct + '%';
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
}

function renderCalendar() {
    document.getElementById('calMonth').textContent = new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
    var grid = document.getElementById('calendarGrid');
    var html = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function(d) { return '<div class="cal-day-header">' + d + '</div>'; }).join('');
    var firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    var daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    var today = new Date().toISOString().split('T')[0];
    var taskDates = {};
    tasks.forEach(function(t) { if (t.date) taskDates[t.date] = true; });
    for (var i = firstDay - 1; i >= 0; i--) html += '<div class="cal-day other-month"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = calendarYear + '-' + String(calendarMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        html += '<div class="cal-day' + (dateStr === today ? ' today' : '') + (taskDates[dateStr] ? ' has-task' : '') + '">' + d + '</div>';
    }
    grid.innerHTML = html;
}

function changeMonth(d) {
    calendarMonth += d;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    renderCalendar();
}

// ==================== EXPORT / IMPORT ====================
function exportTasks() {
    var dataStr = JSON.stringify(tasks, null, 2);
    var blob = new Blob([dataStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'flow-tasks-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    sendNotification('Tasks Exported 📤', 'Your tasks have been downloaded.');
}

function importTasks(input) {
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
                    sendNotification('Tasks Imported 📥', imported.length + ' tasks loaded.');
                }
            } else {
                alert('Invalid backup file.');
            }
        } catch (err) {
            alert('Could not read file. Make sure it\'s a valid JSON backup.');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

// ==================== POMODORO (endTime-based) ====================
var pomoState = {
    totalSeconds: 25 * 60,
    isRunning: false,
    isBreak: false,
    sessions: parseInt(localStorage.getItem('pomoSessions') || '0'),
    endTime: null,
    interval: null,
    remaining: 25 * 60
};

function getPomoRemaining() {
    if (!pomoState.isRunning || !pomoState.endTime) return pomoState.remaining;
    return Math.max(0, Math.round((pomoState.endTime - Date.now()) / 1000));
}

function renderPomodoro() {
    var remaining = pomoState.isRunning ? getPomoRemaining() : pomoState.remaining;
    document.getElementById('pomoTime').textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
    document.getElementById('pomoLabel').textContent = pomoState.isBreak ? 'Break' : 'Focus';
    document.getElementById('pomoStart').textContent = pomoState.isRunning ? '⏸' : '▶';
    document.getElementById('pomoStart').classList.toggle('active', pomoState.isRunning);
    document.getElementById('pomoSessions').textContent = 'Sessions: ' + pomoState.sessions;
}

function togglePomodoro() {
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
                    localStorage.setItem('pomoSessions', pomoState.sessions);
                    sendNotification('Pomodoro Complete! 🍅', 'Spin the wheel for your break activity!');
                    showWheel();
                } else {
                    sendNotification('Break Over! ☕', 'Time to focus again!');
                }
                pomoState.isBreak = !pomoState.isBreak;
                pomoState.totalSeconds = pomoState.isBreak ? 5 * 60 : 25 * 60;
                pomoState.remaining = pomoState.totalSeconds;
                renderPomodoro();
                if (pomoState.isBreak) {
                    // Auto-start break after wheel closes
                }
                return;
            }
            renderPomodoro();
        }, 250);
    }
    renderPomodoro();
}

function resetPomodoro() {
    clearInterval(pomoState.interval);
    pomoState.isRunning = false;
    pomoState.isBreak = false;
    pomoState.endTime = null;
    pomoState.interval = null;
    pomoState.totalSeconds = 25 * 60;
    pomoState.remaining = 25 * 60;
    renderPomodoro();
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
                localStorage.setItem('pomoSessions', pomoState.sessions);
                sendNotification('Pomodoro Complete! 🍅', 'Spin the wheel for your break activity!');
                showWheel();
            } else {
                sendNotification('Break Over! ☕', 'Time to focus again!');
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
    { label: '🚶 Walk', color: '#34c759' },
    { label: '💧 Water', color: '#0071e3' },
    { label: '👀 Rest Eyes', color: '#af52de' },
    { label: '📱 Phone', color: '#ff9500' },
    { label: '🪟 Look Outside', color: '#5ac8fa' },
    { label: '🧘 Breathe', color: '#ff3b30' },
    { label: '🎵 Music', color: '#ff2d55' },
    { label: '✍️ Doodle', color: '#ffcc00' }
];

var wheelCanvas = document.getElementById('wheelCanvas');
var wheelCtx = wheelCanvas.getContext('2d');
var wheelSpinning = false;
var wheelAngle = 0;

function drawWheel(rotation) {
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

        // Text
        wheelCtx.save();
        wheelCtx.translate(cx, cy);
        wheelCtx.rotate(startAngle + arcSize / 2);
        wheelCtx.textAlign = 'center';
        wheelCtx.fillStyle = '#fff';
        wheelCtx.font = 'bold 13px -apple-system, sans-serif';
        wheelCtx.fillText(wheelOptions[i].label, 95, 5);
        wheelCtx.restore();
    }

    // Center circle
    wheelCtx.beginPath();
    wheelCtx.arc(cx, cy, 25, 0, 2 * Math.PI);
    wheelCtx.fillStyle = '#fff';
    wheelCtx.fill();
    wheelCtx.fillStyle = '#1d1d1f';
    wheelCtx.font = 'bold 14px -apple-system, sans-serif';
    wheelCtx.textAlign = 'center';
    wheelCtx.fillText('🎯', cx, cy + 5);

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
    document.getElementById('wheelOverlay').classList.add('show');
    document.getElementById('wheelResult').classList.remove('show');
    document.getElementById('wheelResult').textContent = '';
    wheelSpinning = false;
    wheelAngle = Math.random() * 360;
    document.getElementById('wheelCanvas').style.transform = 'rotate(' + wheelAngle + 'deg)';
    drawWheel(wheelAngle * Math.PI / 180);
    // Auto spin after a tiny delay
    setTimeout(spinWheel, 400);
}

function spinWheel() {
    if (wheelSpinning) return;
    wheelSpinning = true;
    document.getElementById('wheelResult').classList.remove('show');
    var extraSpins = 5 + Math.random() * 5;
    var totalRotation = extraSpins * 360 + Math.random() * 360;
    wheelAngle += totalRotation;
    document.getElementById('wheelCanvas').style.transform = 'rotate(' + wheelAngle + 'deg)';

    setTimeout(function() {
        wheelSpinning = false;
        var result = getWheelResult(wheelAngle);
        document.getElementById('wheelResult').textContent = result.label + ' — Enjoy your break!';
        document.getElementById('wheelResult').classList.add('show');
        // Auto start break
        if (!pomoState.isRunning && pomoState.isBreak && pomoState.remaining === 5 * 60) {
            togglePomodoro();
        }
    }, 4200);
}

function closeWheel() {
    document.getElementById('wheelOverlay').classList.remove('show');
    // Start break timer if not already running
    if (!pomoState.isRunning && pomoState.isBreak) {
        togglePomodoro();
    }
}

// Draw initial wheel
drawWheel(0);

// ==================== MUSIC ====================
function toggleMusic() { document.getElementById('musicPanel').classList.toggle('open'); }

function updateMusic() {
    var url = document.getElementById('musicUrl').value.trim();
    var embed = defaultMusic;
    if (url.indexOf('youtube.com/embed/') !== -1) embed = url.split('?')[0];
    else { var m = url.match(/(?:v=|\/)([\w-]{11})/); if (m) embed = 'https://www.youtube.com/embed/' + m[1]; }
    localStorage.setItem('flowMusic', embed);
    document.getElementById('musicContainer').innerHTML = '<iframe src="' + embed + '" allow="autoplay; encrypted-media" allowfullscreen style="border-radius:14px;width:100%;height:180px;border:none;"></iframe>';
}

function renderMusic(url) {
    document.getElementById('musicContainer').innerHTML = '<iframe src="' + url + '" allow="autoplay; encrypted-media" allowfullscreen style="border-radius:14px;width:100%;height:180px;border:none;"></iframe>';
}

// ==================== PARTICLES ====================
var canvas = document.getElementById('particlesCanvas');
var pctx = canvas.getContext('2d');
var particles = [];

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
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
    pctx.clearRect(0, 0, canvas.width, canvas.height);
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
animateParticles();

// ==================== UTILS ====================
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderAll() { renderTaskList(); renderStats(); renderCalendar(); }

// ==================== INIT ====================
var todayStr = new Date().toISOString().split('T')[0];
if (tasks.some(function(t) { return t.done; })) {
    if (!streakData.days) streakData = { days: {}, currentStreak: 0 };
    if (!streakData.days[todayStr]) {
        var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        streakData.days[todayStr] = true;
        streakData.currentStreak = streakData.days[yesterday] ? (streakData.currentStreak || 0) + 1 : 1;
        saveStreak();
    }
}

renderAll();
renderPomodoro();
var savedMusic = localStorage.getItem('flowMusic') || defaultMusic;
renderMusic(savedMusic);
if (savedMusic !== defaultMusic) document.getElementById('musicUrl').value = savedMusic;
