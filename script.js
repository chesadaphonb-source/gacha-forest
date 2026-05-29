/* =============================================
   FOREST WISH SYSTEM — Projector Local Mode
   ============================================= */

/* --- Configuration --- */
const prizes = [
    { name: "Rank 5 (General)", count: 50, color: "#65d4a0" },
    { name: "Rank 4 (Rare)",    count: 30, color: "#c084fc" },
    { name: "Rank 3 (Epic)",    count: 15, color: "#f472b6" },
    { name: "Rank 2 (Vice)",    count: 5,  color: "#fbbf24" },
    { name: "Rank 1 (Grand)",   count: 3,  color: "#f59e0b" }
];

/* --- Game State --- */
let participants   = [];
let headers        = [];
let currentTier    = 0;
let isWarping      = false;
let currentTierColor = "#65d4a0";
let winnersHistory = {};

// ผูกฟังก์ชันส่งประวัติยอดลง Google Sheets (Apps Script ของมึงยังอยู่ทำงานปกติหลังบ้าน)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzya9mZ86bYNaZdXLgr46DjX1afWMxEs10kjyWdnT77C3vcxO2hA6APWco3Pz5vnTIW/exec";

/* =============================================
   HELPER
   ============================================= */
function getDisplayData(winner) {
    if (winner.displayId !== undefined && winner.displayName !== undefined) {
        return { id: winner.displayId, name: winner.displayName, details: winner.displayDetails || [] };
    }
    let keys = (headers && headers.length > 0) ? headers : Object.keys(winner).filter(k => k !== '_id');
    const idVal   = winner._id || winner[keys[0]] || "-";
    const nameVal = keys.length > 1 ? winner[keys[1]] : winner[keys[0]];
    let detailList = [];
    const startSubIndex = keys.length > 1 ? 2 : 1;
    keys.slice(startSubIndex).forEach(k => {
        if (winner[k] && winner[k] !== "-" && String(winner[k]).trim() !== "")
            detailList.push(`${k}: ${winner[k]}`);
    });
    return { id: idVal, name: nameVal, details: detailList };
}

/* =============================================
   1. INIT SYSTEM
   ============================================= */
window.onload = function () {
    console.log("Forest Wish System — Projector Mode Initialized");
    prizes.forEach(p => { if (!winnersHistory[p.name]) winnersHistory[p.name] = []; });

    initCreatures();
    initCurtains();
    animate();

    // บังคับเปิดหน้า Setup ล็อคอินแอดมินเครื่องหลักขึ้นจอทันทีออโต้
    document.getElementById('setupContainer').style.display = 'flex';
    document.getElementById('adminControls').style.display  = 'block';
    document.getElementById('resultControls').style.display = 'flex';
};

/* =============================================
   2. ACTIONS (LOCAL RUN)
   ============================================= */
function loadData() {
    const url = document.getElementById('sheetUrl').value.trim();
    if (!url) return alert("กรุณาใส่ลิงก์ CSV");

    const btn = document.querySelector('#setupContainer button');
    btn.innerText = "กำลังโหลด…"; btn.disabled = true;

    fetch(url)
        .then(r => { if (!r.ok) throw new Error("เข้าถึงไฟล์ไม่ได้"); return r.text(); })
        .then(csv => {
            const lines = csv.split(/\r?\n/).filter(l => l.trim() !== "");
            if (lines.length < 2) throw new Error("ไฟล์ CSV ว่างเปล่าหรือรูปแบบผิด");

            headers = lines[0].split(',').map(h => h.trim());
            participants = lines.slice(1).map(line => {
                // Regex ขั้นสูง ป้องกันระบบสลับช่องเวลาเจอเครื่องหมายคอมม่าในข้อมูลตาราง
                const data = line.match(/(?:[^,]*|"(?:[^"]|\\")*")(?:,|$)/g).map(s => {
                    return s.replace(/,$/, '').replace(/^"|"$/g, '').replace(/\\"/g, '"').trim();
                });
                if (data.length < 1) return null;
                let obj = {};
                headers.forEach((h, i) => obj[h] = data[i] ? data[i] : "-");
                obj._id = data[0] ? data[0] : `ID-${Math.random().toString(36).substr(2, 5)}`;
                return obj;
            }).filter(item => item !== null);

            prizes.forEach(p => winnersHistory[p.name] = []);

            document.getElementById('setupContainer').style.display = 'none';
            document.getElementById('mainScreen').style.display     = 'block';

            updateUI(true);
            alert(`โหลดข้อมูลสำเร็จ! ผู้เข้าร่วม: ${participants.length} คน`);
        })
        .catch(err => {
            console.error(err);
            alert("❌ เกิดข้อผิดพลาด:\n" + err.message);
            btn.innerText = "Load Data (Admin Only)"; btn.disabled = false;
        });
}

function updateUI(showCount = false) {
    if (currentTier >= prizes.length) {
        let endHtml = `<h1 class="gold-text" style="font-family:'Cinzel Decorative',serif;">🌿 จบกิจกรรม! 🌿</h1>
                       <p style="color:#8aaa8a;margin-bottom:20px;">ขอบคุณผู้ร่วมสนุกทุกคน</p>
                       <button onclick="resetGame()" style="
                        padding:15px 40px;font-size:22px;font-family:'Kanit',sans-serif;
                        background:linear-gradient(45deg,#2d5a2d,#4a8a4a);
                        color:#e8f0d8;border:none;border-radius:50px;cursor:pointer;
                        box-shadow:0 0 20px rgba(60,160,60,0.4);font-weight:bold;transition:transform 0.2s;"
                        onmouseover="this.style.transform='scale(1.1)'"
                        onmouseout ="this.style.transform='scale(1)'">
                        🔄 เริ่มกิจกรรมใหม่
                       </button>`;
        document.getElementById('bannerDisplay').innerHTML = endHtml;
        document.getElementById('adminControls').style.display = 'none';
        return;
    }

    const tier = prizes[currentTier];
    currentTierColor = tier.color;
    document.getElementById('bannerDisplay').innerHTML = `
        <h1 style="color:${tier.color};font-family:'Cinzel Decorative',serif;
                   font-size:clamp(26px,5.5vw,54px);margin:0;
                   text-shadow:0 0 25px ${tier.color}88;">${tier.name}</h1>
        <p style="font-size:18px;color:#8aaa8a;">จำนวนรางวัล: ${tier.count}</p>`;

    document.getElementById('adminControls').style.display = 'block';
    if (showCount)
        document.getElementById('poolCount').innerText = `คงเหลือผู้ลุ้นรางวัล: ${participants.length} คน`;
}

function triggerWish() {
    if (participants.length === 0) return alert("รายชื่อหมดแล้ว!");

    const tier      = prizes[currentTier];
    const drawCount = Math.min(tier.count, participants.length);

    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    const rawWinners = participants.slice(0, drawCount);
    participants = participants.slice(drawCount);

    const displayWinners = rawWinners.map(w => {
        const d = getDisplayData(w);
        return { _raw: w, displayId: d.id, displayName: d.name, displayDetails: d.details };
    });

    if (!winnersHistory[tier.name]) winnersHistory[tier.name] = [];
    winnersHistory[tier.name].push(...displayWinners);

    updateUI(true);

    if (typeof GOOGLE_SCRIPT_URL !== 'undefined' && GOOGLE_SCRIPT_URL) {
        const sheetData = displayWinners.map(d => ({ id: d.displayId, name: d.displayName, dept: d.displayDetails[0] || "-" }));
        fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rank: tier.name, winners: sheetData })
        }).catch(err => console.error(err));
    }

    playWarpAnimation(displayWinners);
}

/* =============================================
   FOREST CURTAIN ANIMATION
   ============================================= */
function playWarpAnimation(winners) {
    const tier        = prizes[currentTier];
    const leftCanvas  = document.getElementById('leftCurtain');
    const rightCanvas = document.getElementById('rightCurtain');
    const flash       = document.getElementById('flashOverlay');
    const container   = document.querySelector('.container');
    const histBtn     = document.querySelector('.btn-history-toggle');

    isWarping = true;
    currentTierColor = tier.color;

    container.style.opacity    = '0';
    histBtn.style.display      = 'none';

    initCurtains(tier.color);

    leftCanvas.style.transition  = 'none';
    rightCanvas.style.transition = 'none';
    leftCanvas.style.transform   = 'translateX(-100%)';
    rightCanvas.style.transform  = 'translateX(100%)';

    void leftCanvas.getBoundingClientRect();

    setTimeout(() => {
        const easing = 'cubic-bezier(0.33, 0, 0.5, 1)';
        leftCanvas.style.transition  = `transform 1.3s ${easing}`;
        rightCanvas.style.transition = `transform 1.3s ${easing}`;
        leftCanvas.style.transform   = 'translateX(0)';
        rightCanvas.style.transform  = 'translateX(0)';
    }, 300);

    setTimeout(() => {
        flash.style.background = '#050f05';
        flash.style.opacity    = '0.7';

        leftCanvas.style.transition  = 'transform 0.08s ease-in-out';
        rightCanvas.style.transition = 'transform 0.08s ease-in-out';
        leftCanvas.style.transform   = 'translateX(3%)';
        rightCanvas.style.transform  = 'translateX(-3%)';

        setTimeout(() => {
            leftCanvas.style.transform  = 'translateX(0)';
            rightCanvas.style.transform = 'translateX(0)';
        }, 80);

    }, 1700);

    setTimeout(() => {
        flash.style.opacity = '0';

        showResults(winners, tier);

        const burstEasing = 'cubic-bezier(0.55, 0, 0.1, 1)';
        leftCanvas.style.transition  = `transform 0.55s ${burstEasing}`;
        rightCanvas.style.transition = `transform 0.55s ${burstEasing}`;
        leftCanvas.style.transform   = 'translateX(-110%)';
        rightCanvas.style.transform  = 'translateX(110%)';

        setTimeout(() => {
            isWarping = false;
        }, 600);
    }, 2100);
}

/* =============================================
   SHOW RESULTS
   ============================================= */
function showResults(winners, tier) {
    const grid = document.getElementById('resultGrid');
    document.getElementById('resultTitle').innerText    = tier.name;
    document.getElementById('resultTitle').style.color  = tier.color;
    grid.innerHTML = "";

    winners.forEach((w, index) => {
        const data = getDisplayData(w);
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderColor      = tier.color + '88';
        card.style.animationDelay   = `${index * 0.045}s`;
        card.style.boxShadow        = `0 4px 15px rgba(0,0,0,0.5), 0 0 12px ${tier.color}22`;

        let subInfoHTML = "";
        data.details.forEach(info => { subInfoHTML += `<div class="info-sub">${info}</div>`; });

        card.innerHTML = `
            <div class="card-header" style="background:${tier.color}; color:#0a0a00;">
                ${data.id}
            </div>
            <div class="card-body">
                <div class="info-main" style="color:${tier.color};">${data.name}</div>
                ${subInfoHTML}
            </div>`;
        grid.appendChild(card);
    });
    document.getElementById('resultScreen').style.display = 'flex';
}

function closeResult() {
    document.getElementById('resultScreen').style.display  = 'none';
    document.querySelector('.container').style.opacity     = '1';
    document.querySelector('.btn-history-toggle').style.display = 'block';
}

function nextRound() {
    closeResult();
    currentTier++;
    updateUI(true);
}

/* =============================================
   3. HISTORY & MODAL CONTROL
   ============================================= */
function toggleHistory() {
    const modal = document.getElementById('historyModal');
    const list  = document.getElementById('historyList');

    if (modal.style.display === 'flex') { modal.style.display = 'none'; return; }

    const activePrizes = prizes.filter(p => winnersHistory[p.name] && winnersHistory[p.name].length > 0);

    if (activePrizes.length === 0) {
        list.innerHTML = `<p style="text-align:center;color:#5a8a5a;margin-top:50px;">ยังไม่มีผู้โชคดี</p>`;
    } else {
        let tabsHtml    = `<div class="history-tabs" id="tabsContainer">`;
        let contentHtml = `<div class="history-content-wrapper">`;

        activePrizes.forEach((prize, index) => {
            const isActive = index === 0 ? 'active' : '';
            const winners  = winnersHistory[prize.name];

            tabsHtml += `<button class="tab-btn ${isActive}" onclick="switchTab(event,'tab-${index}')">
                ${prize.name} <span style="opacity:0.6">(${winners.length})</span></button>`;

            contentHtml += `<div id="tab-${index}" class="tab-content ${isActive}">`;
            winners.forEach(w => {
                const data    = getDisplayData(w);
                const subText = data.details.length > 0 ? data.details[0] : "-";
                contentHtml += `<div class="history-item">
                    <div style="font-weight:bold;">${data.name}</div>
                    <div style="font-size:0.8em;opacity:0.6;">${subText}</div>
                </div>`;
            });
            contentHtml += `</div>`;
        });

        tabsHtml    += `</div>`;
        contentHtml += `</div>`;
        list.innerHTML = tabsHtml + contentHtml;

        const slider = document.getElementById('tabsContainer');
        let isDown = false, startX, scrollLeft;
        slider.addEventListener('mousedown', e => {
            isDown = true; slider.classList.add('dragging');
            startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft;
        });
        slider.addEventListener('mouseleave',  () => { isDown = false; slider.classList.remove('dragging'); });
        slider.addEventListener('mouseup',     () => { isDown = false; slider.classList.remove('dragging'); });
        slider.addEventListener('mousemove',   e  => {
            if (!isDown) return; e.preventDefault();
            slider.scrollLeft = scrollLeft - (e.pageX - slider.offsetLeft - startX) * 2;
        });
    }
    modal.style.display = 'flex';
}

window.switchTab = function (event, tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
};

function resetGame() {
    if (!confirm("⚠️ WARNING: ต้องการล้างระบบทั้งหมด?\n(ประวัติจะหายไป และกลับสู่หน้าใส่ CSV)")) return;
    window.location.reload();
}

/* =============================================
   4. CANVAS — CREATURES ENGINE
   ============================================= */
const canvas = document.getElementById('starCanvas');
const ctx    = canvas.getContext('2d');
let w, h;

function resize() {
    w = canvas.width  = window.innerWidth;
    h = canvas.height = window.innerHeight;
    initCurtains(currentTierColor);
}
window.addEventListener('resize', resize); resize();

/* ────────────────────────────────────────────
   CREATURE CLASSES
   ──────────────────────────────────────────── */
class Firefly {
    constructor() { this.reset(); }
    reset() {
        this.x  = Math.random() * w;
        this.y  = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.r  = Math.random() * 1.8 + 0.8;
        this.glowR    = this.r * 7;
        this.phase    = Math.random() * Math.PI * 2;
        this.flickerS = Math.random() * 0.04 + 0.01;
        const palette = ['#a8ff3e','#78ff44','#e8ff78','#88ffcc','#ccff55'];
        this.color = palette[Math.floor(Math.random() * palette.length)];
    }
    update() {
        this.phase += this.flickerS;
        this.brightness = (Math.sin(this.phase) + 1) / 2;

        if (isWarping) {
            this.vx += (Math.random() - 0.5) * 1.5;
            this.vy += (Math.random() - 0.5) * 1.5;
            const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
            if (speed > 12) { this.vx = this.vx/speed*12; this.vy = this.vy/speed*12; }
        } else {
            this.vx += Math.sin(this.phase * 0.6) * 0.015;
            this.vy += Math.cos(this.phase * 0.4) * 0.015;
            this.vx *= 0.99; this.vy *= 0.99;
        }
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0) this.x = w; if (this.x > w) this.x = 0;
        if (this.y < 0) this.y = h; if (this.y > h) this.y = 0;
    }
    draw() {
        const alpha = this.brightness * 0.88 + 0.12;
        const gGrad = ctx.createRadialGradient(this.x,this.y,0, this.x,this.y,this.glowR);
        gGrad.addColorStop(0, this.color + Math.floor(alpha * 160).toString(16).padStart(2,'0'));
        gGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = gGrad;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.glowR, 0, Math.PI*2); ctx.fill();
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class Butterfly {
    constructor() { this.reset(); }
    reset() {
        this.x     = Math.random() * w;
        this.y     = Math.random() * h * 0.9 + h * 0.05;
        this.vx    = (Math.random() - 0.5) * 1.2;
        this.vy    = (Math.random() - 0.5) * 0.6;
        this.size  = Math.random() * 18 + 12;
        this.phase = Math.random() * Math.PI * 2;
        this.flapS = Math.random() * 0.1 + 0.07;
        const palettes = [
            ['#ff9a3c','#ff6200'],['#a855f7','#7c3aed'],
            ['#22d3ee','#0891b2'],['#f472b6','#be185d'],
            ['#84cc16','#4d7c0f'],['#fbbf24','#d97706']
        ];
        const c = palettes[Math.floor(Math.random() * palettes.length)];
        this.c1 = c[0]; this.c2 = c[1];
    }
    update() {
        this.phase += this.flapS;
        this.vx += Math.sin(this.phase * 0.3) * 0.06;
        this.vy += Math.cos(this.phase * 0.2) * 0.03;
        if (isWarping) { this.vx *= 1.06; this.vy *= 1.06; }
        this.vx *= 0.98; this.vy *= 0.98;
        this.x += this.vx; this.y += this.vy;
        const pad = 60;
        if (this.x < -pad) this.x = w + pad;
        if (this.x > w+pad) this.x = -pad;
        if (this.y < -pad) this.y = h + pad;
        if (this.y > h+pad) this.y = pad;
    }
    draw() {
        const flap = Math.abs(Math.sin(this.phase));
        const s    = this.size;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx) - Math.PI/2);
        ctx.globalAlpha = 0.82;

        ctx.fillStyle = this.c1;
        ctx.beginPath(); ctx.moveTo(0,-s*.3); ctx.lineTo(-flap*s*1.6,-s*.6); ctx.lineTo(-flap*s*.7, s*.1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,-s*.3); ctx.lineTo( flap*s*1.6,-s*.6); ctx.lineTo( flap*s*.7, s*.1); ctx.closePath(); ctx.fill();

        ctx.fillStyle = this.c2;
        ctx.beginPath(); ctx.moveTo(0,s*.1); ctx.lineTo(-flap*s*.95, s*.52); ctx.lineTo(-flap*s*.25, s*.4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,s*.1); ctx.lineTo( flap*s*.95, s*.52); ctx.lineTo( flap*s*.25, s*.4); ctx.closePath(); ctx.fill();

        ctx.fillStyle = '#1a0800';
        ctx.beginPath();
        ctx.ellipse(0, 0, s*.08, s*.45, 0, 0, Math.PI*2);
        ctx.fill();

        ctx.strokeStyle = '#3a1a00'; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(0,-s*.35); ctx.quadraticCurveTo(-s*.3,-s*.9, -s*.2,-s*1.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-s*.35); ctx.quadraticCurveTo( s*.3,-s*.9,  s*.2,-s*1.1); ctx.stroke();

        ctx.restore();
    }
}

class Dragonfly {
    constructor() { this.reset(); }
    reset() {
        this.x     = Math.random() * w;
        this.y     = Math.random() * h;
        this.targetX = Math.random() * w;
        this.targetY = Math.random() * h;
        this.vx    = 0; this.vy = 0;
        this.size  = Math.random() * 14 + 9;
        this.phase = Math.random() * Math.PI * 2;
        this.flapS = Math.random() * 0.35 + 0.25;
        this.dartTimer = Math.random() * 80 + 30;
        this.angle = 0;
        const cols = ['#22d3ee','#a78bfa','#34d399','#6ee7b7','#93c5fd'];
        this.color = cols[Math.floor(Math.random() * cols.length)];
    }
    update() {
        this.phase += this.flapS;
        this.dartTimer--;
        if (this.dartTimer <= 0) {
            this.targetX   = Math.random() * w;
            this.targetY   = Math.random() * h;
            this.dartTimer = Math.random() * 80 + 30;
        }
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 10) { this.vx += dx/dist * (isWarping ? 2 : 0.7); this.vy += dy/dist * (isWarping ? 2 : 0.7); }
        this.vx *= 0.88; this.vy *= 0.88;
        const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        if (spd > 0.2) this.angle = Math.atan2(this.vy, this.vx);
        this.x += this.vx; this.y += this.vy;
    }
    draw() {
        const w2 = Math.abs(Math.sin(this.phase));
        const s  = this.size;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = 0.88;

        ctx.fillStyle   = this.color + '55';
        ctx.strokeStyle = this.color + 'cc';
        ctx.lineWidth   = 0.8;

        [[-1,1],[-1,-1]].forEach(([ys,yl]) => {
            ctx.beginPath();
            ctx.moveTo(-s*.25, 0);
            ctx.lineTo(-s*.8,  s * w2 * ys * 1.1);
            ctx.lineTo( s*.15, s * w2 * ys * 0.45);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        [[1,.7],[1,-.7]].forEach(([xs,ys]) => {
            ctx.beginPath();
            ctx.moveTo( s*.1, 0);
            ctx.lineTo(-s*.05, s * w2 * ys * 0.85);
            ctx.lineTo( s*.5,  s * w2 * ys * 0.35);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        });

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.lineTo(0, -s*.18);
        ctx.lineTo(s*.65, 0); ctx.lineTo(0, s*.18);
        ctx.closePath(); ctx.fill();

        ctx.fillStyle = '#ffffff99';
        ctx.beginPath(); ctx.arc(s*.75, 0, s*.22, 0, Math.PI*2); ctx.fill();

        ctx.restore();
    }
}

class Bird {
    constructor() { this.reset(true); }
    reset(initial = false) {
        this.dir = Math.random() > 0.5 ? 1 : -1;
        this.x   = initial ? Math.random() * w : (this.dir > 0 ? -120 : w + 120);
        this.y   = Math.random() * h * 0.55 + h * 0.05;
        this.spd = Math.random() * 1.8 + 0.9;
        this.vx  = this.spd * this.dir;
        this.vy  = (Math.random() - 0.5) * 0.3;
        this.size   = Math.random() * 11 + 7;
        this.phase  = Math.random() * Math.PI * 2;
        this.flapS  = Math.random() * 0.07 + 0.04;
    }
    update() {
        this.phase += this.flapS;
        if (isWarping) this.vx *= 1.03;
        this.x += this.vx;
        this.y += Math.sin(this.phase * 0.55) * 0.25;
        if (this.x > w + 150 || this.x < -150) this.reset();
    }
    draw() {
        const wA = Math.sin(this.phase) * 0.55;
        const s  = this.size;
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dir < 0) ctx.scale(-1, 1);
        ctx.globalAlpha = 0.65;

        ctx.fillStyle = '#1a3a1a';
        ctx.beginPath();
        ctx.ellipse(0, 0, s*.8, s*.28, 0, 0, Math.PI*2);
        ctx.fill();

        ctx.save(); ctx.translate(-s*.3, 0); ctx.rotate(-wA);
        ctx.fillStyle = '#264a26';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-s*1.6, -s*.28); ctx.lineTo(-s*.85, s*.18);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        ctx.save(); ctx.translate(s*.3, 0); ctx.rotate(wA);
        ctx.fillStyle = '#264a26';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(s*1.6, -s*.28); ctx.lineTo(s*.85, s*.18);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#1a3a1a';
        ctx.beginPath(); ctx.arc(s*.75, -s*.08, s*.28, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#8a7a2a';
        ctx.beginPath();
        ctx.moveTo(s*1.1, -s*.08); ctx.lineTo(s*1.45, -s*.02); ctx.lineTo(s*1.1, s*.04);
        ctx.closePath(); ctx.fill();

        ctx.restore();
    }
}

class GeoBeetle {
    constructor() { this.reset(); }
    reset() {
        this.x     = Math.random() * w;
        this.y     = Math.random() * h;
        this.vx    = (Math.random() - 0.5) * 0.4;
        this.vy    = (Math.random() - 0.5) * 0.4;
        this.size  = Math.random() * 10 + 6;
        this.phase = Math.random() * Math.PI * 2;
        this.angle = Math.random() * Math.PI * 2;
        const cols = ['#d97706','#92400e','#166534','#065f46'];
        this.color = cols[Math.floor(Math.random() * cols.length)];
    }
    update() {
        this.phase += 0.025;
        this.vx += Math.sin(this.phase) * 0.008;
        this.vy += Math.cos(this.phase * 0.7) * 0.008;
        this.vx *= 0.99; this.vy *= 0.99;
        if (isWarping) { this.vx *= 1.04; this.vy *= 1.04; }
        this.x += this.vx; this.y += this.vy;
        this.angle = Math.atan2(this.vy, this.vx);
        if (this.x < -40) this.x = w+40; if (this.x > w+40) this.x = -40;
        if (this.y < -40) this.y = h+40; if (this.y > h+40) this.y = -40;
    }
    draw() {
        const s = this.size;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = 0.75;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(-s*.15,  s*.15, s*.45, s*.25, -0.4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-s*.15, -s*.15, s*.45, s*.25,  0.4, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.ellipse(s*.25, 0, s*.22, s*.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-s*.1, 0, s*.3,  s*.2,  0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-s*.55,0, s*.35, s*.22, 0, 0, Math.PI*2); ctx.fill();

        ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            const lx = i * s * 0.3 - s*.05;
            ctx.beginPath(); ctx.moveTo(lx, s*.18); ctx.lineTo(lx - s*.3, s*.55); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(lx, -s*.18); ctx.lineTo(lx - s*.3,-s*.55); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(s*.4,  s*.08); ctx.lineTo(s*.85,  s*.35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s*.4, -s*.08); ctx.lineTo(s*.85, -s*.35); ctx.stroke();

        ctx.restore();
    }
}

/* ── Instantiate creatures ─────────────────── */
let fireflies  = [];
let butterflies= [];
let dragonflies= [];
let birds      = [];
let beetles    = [];

function initCreatures() {
    fireflies   = Array.from({length: 90},  () => new Firefly());
    butterflies = Array.from({length: 7},   () => new Butterfly());
    dragonflies = Array.from({length: 5},   () => new Dragonfly());
    birds       = Array.from({length: 6},   () => new Bird());
    beetles     = Array.from({length: 8},   () => new GeoBeetle());
}

/* =============================================
   FOREST CURTAIN CANVAS INIT
   ============================================= */
function initCurtains(accentColor) {
    ['leftCurtain','rightCurtain'].forEach(id => {
        const cv  = document.getElementById(id);
        const side = id === 'leftCurtain' ? 'left' : 'right';
        const CW  = Math.ceil(window.innerWidth * 0.57);
        const CH  = window.innerHeight;
        cv.width  = CW; cv.height = CH;
        const c   = cv.getContext('2d');

        const bg  = c.createLinearGradient(0, 0, CW, 0);
        if (side === 'left') {
            bg.addColorStop(0, '#030803');
            bg.addColorStop(1, '#060e06');
        } else {
            bg.addColorStop(0, '#060e06');
            bg.addColorStop(1, '#030803');
        }
        c.fillStyle = bg;
        c.fillRect(0, 0, CW, CH);

        const layers = [
            { n: 10, hF: 0.45, col: '#0a1e0a', op: 0.6 },
            { n: 8,  hF: 0.62, col: '#0d270d', op: 0.75 },
            { n: 6,  hF: 0.80, col: '#071507', op: 0.9  },
            { n: 4,  hF: 0.95, col: '#040d04', op: 1.0  }
        ];
        layers.forEach(({ n, hF, col, op }) => {
            c.globalAlpha = op;
            c.fillStyle   = col;
            for (let i = 0; i < n; i++) {
                const x  = (i / n) * CW + (Math.random()-.5) * CW / n;
                const tH = CH * hF * (.6 + Math.random() * .7);
                const sp = 20 + Math.random() * 45;
                drawCurtainTree(c, x, CH, tH, sp);
            }
        });
        c.globalAlpha = 1;

        for (let g = 0; g < 25; g++) {
            const gx = Math.random() * CW;
            const gy = CH * 0.55 + Math.random() * CH * 0.45;
            const gr = Math.random() * 18 + 5;
            const glowCols = ['#00ff8855','#88ff0055','#ffff0055','#00ffcc44'];
            //  ซ่อมบั๊กพิมพ์คำผิดจาก cols.length เป็น glowCols.length เรียบร้อย สัตว์ป่าฟื้นคืนชีพชัวร์สัส!
            const gc = glowCols[Math.floor(Math.random() * glowCols.length)];
            const gg = c.createRadialGradient(gx, gy, 0, gx, gy, gr);
            gg.addColorStop(0, gc); gg.addColorStop(1, 'transparent');
            c.fillStyle = gg;
            c.beginPath(); c.arc(gx, gy, gr, 0, Math.PI*2); c.fill();
        }

        if (accentColor) {
            const edgeX = side === 'left' ? CW : 0;
            const ag    = c.createLinearGradient(edgeX, 0, edgeX - (side==='left'?1:-1)*CW*0.35, 0);
            ag.addColorStop(0,   accentColor + '55');
            ag.addColorStop(0.5, accentColor + '22');
            ag.addColorStop(1,   'transparent');
            c.fillStyle = ag;
            c.fillRect(0, 0, CW, CH);
        }

        const innerX = side === 'left' ? CW : 0;
        const iv = c.createLinearGradient(
            innerX, 0,
            innerX + (side === 'left' ? -CW*.3 : CW*.3), 0
        );
        iv.addColorStop(0, 'rgba(3,8,3,0.0)');
        iv.addColorStop(1, 'rgba(3,8,3,0.55)');
        c.fillStyle = iv;
        c.fillRect(0, 0, CW, CH);
    });
}

function drawCurtainTree(c, x, baseY, height, spread) {
    c.fillRect(x - spread*.09, baseY - height*.25, spread*.18, height*.28);
    for (let l = 0; l < 3; l++) {
        const ly  = baseY - height * (.22 + l*.27);
        const lsp = spread * (1 - l*.2);
        const lh  = height * .36;
        c.beginPath();
        c.moveTo(x, ly - lh);
        c.lineTo(x - lsp, ly);
        c.lineTo(x + lsp, ly);
        c.closePath(); c.fill();
    }
    for (let b = 0; b < 4; b++) {
        const bx = x + (Math.random()-.5) * spread * 1.1;
        const by = baseY - height * (.3 + Math.random() * .62);
        c.beginPath(); c.arc(bx, by, spread*(.18+Math.random()*.25), 0, Math.PI*2); c.fill();
    }
}

/* =============================================
   5. MAIN RENDER LOOP (LOCAL TRANSPARENT)
   ============================================= */
function animate() {
    // เคลียร์จอใสสะอาด เพื่อภาพพื้นหลังป่าชั้น CSS ทะลุขึ้นมามีมิติ
    ctx.clearRect(0, 0, w, h);

    // ปล่อยฝูงสัตว์ป่าโบยบินอย่างอิสระไร้บั๊กกวนใจ
    fireflies.forEach  (f => { f.update(); f.draw(); });
    beetles.forEach    (b => { b.update(); b.draw(); });
    butterflies.forEach(b => { b.update(); b.draw(); });
    dragonflies.forEach(d => { d.update(); d.draw(); });
    birds.forEach      (b => { b.update(); b.draw(); });

    requestAnimationFrame(animate);
}
