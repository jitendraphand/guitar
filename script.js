const startStopBtn = document.getElementById('startStopBtn');
const bpmInput = document.getElementById('bpmInput');
const bpmValue = document.getElementById('bpmValue');
const track = document.getElementById('track');
const playlistContainer = document.getElementById('playlistContainer');
const addPatternBtn = document.getElementById('addPatternBtn');

let audioCtx;
let isPlaying = false;
let bpm = 100;
let noteWidth = 50; // Visual width of one step
let barWidth = 40; // Increased for better separation

let startTime = 0;
let animationId;

// Data Model
// Each item in sequence has: { steps: ['D', '-', ...], repeats: 1 }
// Defaulting to "D-UUD-UUD" mapped to a 12-step grid (12/8 or Triplet feel)
// D . . U . U D . . U . U ? No.
// User said "D-UUD-UUD"
// Let's try to map it to 6/8:
// 1 2 3 4 5 6
// D . U U D .  (Wait, UUD is 3? U U D ?)
// Let's provide a default that sounds like the common strum.
// D . . D U . U D . . (Classic 6/8)
// Let's just start with a blank or simple grid and let user paint.
// Or pre-fill a "D-UUD-UUD" approximation.
// Let's use 12 steps.
// D (1) - (2) - (3) U (4) U (5) D (6) - (7) - (8) U (9) U (10) D (11)?
let sequence = [
    {
        steps: ['D', '-', 'D', 'U', '-', 'U', 'D', '-', 'D', 'U', '-', 'U'], // Placeholder 12-step
        repeats: 4
    }
];
// Wait, user specifically asked for D-UUD-UUD.
// "D (space) UUD (space) UUD"
// If D is beat 1.
// UUD is beat 2 group?
// This implies triplets?
// Let's clean the default to be correct for 6/8 feel or similar.
// 12 Steps:
// D . . U U D . . U U D .  (Total 12)
// This matches "D... UUD... UUD..." rhythmically.
sequence = [
    {
        steps: ['D', '.', '.', 'U', 'U', 'D', '.', '.', 'U', 'U', 'D', '.'],
        repeats: 4
    }
];


let flattenedNotes = [];
let sequenceWidth = 0;

// Sound Synthesis
function playSound(type, time) {
    if (!audioCtx) return;

    // Create oscillator
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'D') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, time); // Low for Down
        osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    } else if (type === 'U') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, time); // High for Up
        osc.frequency.exponentialRampToValueAtTime(150, time + 0.1);
    } else {
        return;
    }

    gainNode.gain.setValueAtTime(0.3, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    osc.start(time);
    osc.stop(time + 0.15);
}

function generateFlattenedNotes() {
    flattenedNotes = [];
    sequence.forEach((item, index) => {
        for (let r = 0; r < item.repeats; r++) {
            // Add steps
            item.steps.forEach(step => {
                let symbol = '•';
                let cls = 'rest';
                if (step === 'D') { symbol = '↓'; cls = 'down'; }
                if (step === 'U') { symbol = '↑'; cls = 'up'; }
                if (step === '.') { symbol = '•'; cls = 'rest'; } // dot alias

                flattenedNotes.push({ type: step === '.' ? '-' : step, symbol, class: cls });
            });
            // Add Bar Line
            flattenedNotes.push({ type: 'BAR', symbol: '', class: 'bar-line' });
        }
    });
}

// UI: Grid/Playlist Management
function renderPlaylist() {
    playlistContainer.innerHTML = '';
    sequence.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'playlist-item';

        // Header (Repeats + Remove)
        const header = document.createElement('div');
        header.className = 'playlist-header';

        const label = document.createElement('span');
        label.textContent = `Pattern ${index + 1} (${item.steps.length} steps)`;

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '10px';
        controls.style.alignItems = 'center';

        const repLabel = document.createElement('span');
        repLabel.textContent = 'x';
        repLabel.style.fontSize = '0.9rem';

        const repInput = document.createElement('input');
        repInput.type = 'number';
        repInput.value = item.repeats;
        repInput.min = 1;
        repInput.title = "Repetitions";
        repInput.onchange = (e) => {
            sequence[index].repeats = parseInt(e.target.value) || 1;
            restartIfPlaying();
        };

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
            sequence.splice(index, 1);
            renderPlaylist();
            restartIfPlaying();
        };

        controls.appendChild(repLabel);
        controls.appendChild(repInput);
        controls.appendChild(removeBtn);

        header.appendChild(label);
        header.appendChild(controls);

        // Builder Toolbar
        const builderToolbar = document.createElement('div');
        builderToolbar.className = 'builder-toolbar';
        builderToolbar.style.marginBottom = '10px';
        builderToolbar.style.display = 'flex';
        builderToolbar.style.gap = '5px';

        const addDownBtn = document.createElement('button');
        addDownBtn.className = 'btn small secondary';
        addDownBtn.textContent = '+ ↓';
        addDownBtn.onclick = () => {
            item.steps.push('D');
            renderPlaylist();
            restartIfPlaying();
        };

        const addUpBtn = document.createElement('button');
        addUpBtn.className = 'btn small secondary';
        addUpBtn.textContent = '+ ↑';
        addUpBtn.onclick = () => {
            item.steps.push('U');
            renderPlaylist();
            restartIfPlaying();
        };

        const addRestBtn = document.createElement('button');
        addRestBtn.className = 'btn small secondary';
        addRestBtn.textContent = '+ -';
        addRestBtn.onclick = () => {
            item.steps.push('-'); // using '-' for rest storage
            renderPlaylist();
            restartIfPlaying();
        };

        const removeStepBtn = document.createElement('button');
        removeStepBtn.className = 'btn small danger';
        removeStepBtn.textContent = '←';
        removeStepBtn.title = "Remove last step";
        removeStepBtn.onclick = () => {
            if (item.steps.length > 0) {
                item.steps.pop();
                renderPlaylist();
                restartIfPlaying();
            }
        };

        builderToolbar.appendChild(addDownBtn);
        builderToolbar.appendChild(addUpBtn);
        builderToolbar.appendChild(addRestBtn);
        builderToolbar.appendChild(removeStepBtn);

        // Grid Editor
        const grid = document.createElement('div');
        grid.className = 'grid-editor';
        grid.style.display = 'flex';
        grid.style.flexWrap = 'wrap';
        grid.style.gap = '5px';

        if (item.steps.length === 0) {
            grid.innerHTML = '<span style="color:#666; font-size:0.8rem; padding:10px;">Empty pattern. Add steps above.</span>';
        } else {
            item.steps.forEach((step, sIndex) => {
                const btn = document.createElement('button');
                btn.className = `step-btn ${step === 'D' ? 'down' : step === 'U' ? 'up' : ''}`;
                // symbol mapping
                let sym = '';
                if (step === 'D') sym = '↓';
                else if (step === 'U') sym = '↑';
                else if (step === '-' || step === '.') sym = '-';

                btn.textContent = sym;

                btn.onclick = () => {
                    // Toggle Cycle: - -> D -> U -> -
                    let next = '-';
                    if (step === '-' || step === '.') next = 'D';
                    else if (step === 'D') next = 'U';
                    else if (step === 'U') next = '-';

                    // Update Model
                    item.steps[sIndex] = next;

                    // Update UI visually
                    renderPlaylist();
                    restartIfPlaying();
                };
                grid.appendChild(btn);
            });
        }

        row.appendChild(header);
        row.appendChild(builderToolbar); // Add toolbar
        row.appendChild(grid);
        playlistContainer.appendChild(row);
    });
}

addPatternBtn.addEventListener('click', () => {
    // Start with a clean slate or a single rest
    sequence.push({ steps: ['-'], repeats: 2 });
    renderPlaylist();
    restartIfPlaying();
});

function restartIfPlaying() {
    generateFlattenedNotes();
    initTrack();
    if (isPlaying) {
        startAudio();
    }
}

// Visuals & Timing
function getPixelsPerSecond() {
    // BPM = Beats Per Minute.
    // What is a "Beat"?
    // In our Grid, we let BPM control the "Step Rate" logic implicitly?
    // Let's say:
    // If Grid=8 (4/4), 1 Beat = 2 Steps (8th notes).
    // If Grid=12 (6/8), 1 Beat (dotted quarter) = 3 Steps? 
    //    OR 1 Beat (quarter) = 2 Steps (triplets? no 3).

    // To keep it simple for the User:
    // "BPM" controls the speed of the "Quarter Note" concept.
    // We need to decide how many STEPS equal a QUARTER NOTE.
    // Standard 4/4: 1 Quarter = 2 Eighth notes (2 steps).
    // Standard 6/8: Dotted Quarter = 1 Beat. (3 eighth notes).

    // Let's standardise: 1 Step = 1 Eighth Note (always).
    // So 1 Quarter Note (BPM reference) = 2 Steps.
    // Speed (Steps per Minute) = BPM * 2.

    const stepsPerMin = bpm * 2;
    const stepsPerSec = stepsPerMin / 60;

    // Pixel Speed = stepsPerSec * noteWidth
    return stepsPerSec * noteWidth;
}

function initTrack() {
    track.innerHTML = '';
    const fragment = document.createDocumentFragment();
    let totalW = 0;

    flattenedNotes.forEach(note => {
        const el = document.createElement('div');
        el.className = `note ${note.class}`;
        el.textContent = note.symbol;
        if (note.type === 'BAR') {
            el.style.width = `${barWidth}px`;
            totalW += barWidth;
        } else {
            el.style.width = `${noteWidth}px`;
            totalW += noteWidth;
        }
        fragment.appendChild(el);
    });

    sequenceWidth = totalW;
    if (sequenceWidth === 0) return;

    // Wrapper approach
    const masterBlock = document.createElement('div');
    masterBlock.style.display = 'flex';
    masterBlock.style.flexShrink = '0';

    flattenedNotes.forEach(note => {
        const el = document.createElement('div');
        el.className = `note ${note.class}`;
        el.textContent = note.symbol;
        el.style.width = (note.type === 'BAR') ? `${barWidth}px` : `${noteWidth}px`;
        masterBlock.appendChild(el);
    });

    const screenW = document.querySelector('.display-area')?.clientWidth || 1000;
    const copies = Math.ceil(screenW / sequenceWidth) + 2;

    for (let i = 0; i < copies; i++) {
        track.appendChild(masterBlock.cloneNode(true));
    }
}

let nextNoteIndex = 0;
let nextScheduleTime = 0;

function startAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    startTime = audioCtx.currentTime;
    nextScheduleTime = startTime;
    nextNoteIndex = 0;
}

function scheduleAudio() {
    if (!isPlaying || !audioCtx) return;

    const pxPerSec = getPixelsPerSecond();
    const lookahead = 0.1;

    while (nextScheduleTime < audioCtx.currentTime + lookahead) {
        const note = flattenedNotes[nextNoteIndex % flattenedNotes.length];

        // Only play if close to current time to avoid burst after lag/background
        if (nextScheduleTime >= audioCtx.currentTime - 0.1) {
            if (note.type === 'D' || note.type === 'U') {
                playSound(note.type, nextScheduleTime);
            }
        }

        const width = (note.type === 'BAR') ? barWidth : noteWidth;
        const duration = width / pxPerSec;
        nextScheduleTime += duration;
        nextNoteIndex++;
    }
}

function animate() {
    if (!isPlaying) return;

    if (audioCtx) {
        const pxPerSec = getPixelsPerSecond();
        const timePassed = audioCtx.currentTime - startTime;
        const distance = timePassed * pxPerSec;
        const offset = distance % sequenceWidth;

        track.style.transform = `translateX(${-offset}px)`;
        scheduleAudio();
    }
    animationId = requestAnimationFrame(animate);
}

startStopBtn.addEventListener('click', () => {
    if (isPlaying) {
        isPlaying = false;
        startStopBtn.textContent = 'Start';
        startStopBtn.classList.remove('active');
        cancelAnimationFrame(animationId);
        if (audioCtx) audioCtx.suspend();
    } else {
        startAudio();
        isPlaying = true;
        startStopBtn.textContent = 'Stop';
        startStopBtn.classList.add('active');
        animate();
    }
});

bpmInput.addEventListener('input', (e) => {
    bpm = parseInt(e.target.value);
    bpmValue.textContent = bpm;
    // For smoothness, we assume Step=Eighth Note logic holds.
    if (isPlaying) {
        startAudio(); // resync
    }
});

// Init
renderPlaylist();
generateFlattenedNotes();
setTimeout(() => initTrack(), 0);
window.addEventListener('resize', initTrack);
