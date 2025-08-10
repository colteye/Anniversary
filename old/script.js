(() => {
    // Elements
    const fileInput = document.getElementById("fileInput");
    const crosswordGrid = document.getElementById("crosswordGrid");
    const acrossCluesEl = document.getElementById("acrossClues");
    const downCluesEl = document.getElementById("downClues");
    const titleEl = document.getElementById("puzzleTitle");
    const authorEl = document.getElementById("puzzleAuthor");
    const statusEl = document.getElementById("status");

    const checkDropdown = document.getElementById("checkDropdown");
    const revealDropdown = document.getElementById("revealDropdown");
    const resetDropdown = document.getElementById("resetDropdown");

    // State
    let puzzle = null;
    let size = {
        rows: 0,
        cols: 0
    };

    let cells = [];
    let userGrid = [];
    let direction = "across"; // 'across' or 'down'
    let cursorIndex = 0;

    // clue maps: index -> number, number -> indices of word
    let clueIndexMap = {
        across: [],
        down: []
    };
    let numberToCells = {};
    // Overlay numbers for cells that start a word (prefer across when both)
    let overlayNumbers = {};

    // Timer state
    let timerInterval = null;
    let startTime = null;
    let elapsedBeforePause = 0;

    const timerDisplay = document.getElementById("timerDisplay");

    function onCellClick(e) {
        const i = Number(e.currentTarget.dataset.index);
        if (!puzzle) return;
        if (isBlock(i)) {
            // Clicking a block toggles direction only
            toggleDirection();
            updateHighlight();
            return;
        }
        if (i === cursorIndex) {
            // Repeated click on the same cell toggles direction
            toggleDirection();
        } else {
            cursorIndex = i;
        }
        updateHighlight();
        cells[cursorIndex].focus();
    }

    function startTimer() {
        if (timerInterval) return; // already running
        startTime = Date.now();
        timerInterval = setInterval(() => {
            updateTimerDisplay();
        }, 1000);
    }

    function pauseTimer() {
        if (!timerInterval) return;
        clearInterval(timerInterval);
        timerInterval = null;
        elapsedBeforePause += Date.now() - startTime;
        updateTimerDisplay();
    }

    function resetTimer() {
        pauseTimer();
        elapsedBeforePause = 0;
        startTime = null;
        updateTimerDisplay();
    }

    function updateTimerDisplay() {
        let elapsed = elapsedBeforePause;
        if (timerInterval) {
            elapsed += Date.now() - startTime;
        }
        const totalSeconds = Math.floor(elapsed / 1000);
        const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
        const s = String(totalSeconds % 60).padStart(2, "0");
        timerDisplay.textContent = `${m}:${s}`;
    }

    // --- Load puzzle from file ---
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                loadPuzzle(data);
                status("");
            } catch (err) {
                console.error('Failed to load puzzle:', err);
                status(err && err.message ? `Error: ${err.message}` : 'Failed to load puzzle');
            }
        };
        reader.readAsText(file);
    });

    // --- Puzzle loading & setup ---
    function loadPuzzle(data) {
        puzzle = normalizePuzzle(data);
        size = {
            ...puzzle.size
        };
        titleEl.textContent = puzzle.title;
        authorEl.textContent = puzzle.author ? `By ${puzzle.author}` : "";
        userGrid = puzzle.grid.map((ch) => (ch === "#" ? "#" : ""));
        buildClueMaps();
        renderGrid();
        renderClues();
        cursorIndex = firstNonBlock();
        direction = "across";
        updateHighlight();

        resetTimer();
        startTimer();
    }

    function isPuzzleComplete() {
        for (let i = 0; i < puzzle.grid.length; i++) {
            if (puzzle.grid[i] === "#") continue;
            if (userGrid[i] !== puzzle.grid[i]) return false;
        }
        return true;
    }

    function normalizePuzzle(data) {
        const rows = (data.size && typeof data.size.rows === 'number') ? data.size.rows : 0;
        const cols = (data.size && typeof data.size.cols === 'number') ? data.size.cols : 0;
        let grid = Array.isArray(data.grid) ? data.grid : [];
        if (grid.length !== rows * cols) {
            throw new Error("Grid size does not match rows*cols");
        }
        return {
            title: data.title || "Untitled",
            author: data.author || "",
            size: {
                rows,
                cols
            },
            grid,
            clues: {
                across: (data.clues && Array.isArray(data.clues.across)) ? data.clues.across : [],
                down: (data.clues && Array.isArray(data.clues.down)) ? data.clues.down : [],
            },
        };
    }

    function firstNonBlock() {
        return userGrid.findIndex((ch) => ch !== "#");
    }

    // --- Build clue index maps and word indices ---
    function buildClueMaps() {
        clueIndexMap = {
            across: Array(puzzle.grid.length).fill(null),
            down: Array(puzzle.grid.length).fill(null),
        };
        numberToCells = {};
        overlayNumbers = {};

        // 1) Build across word starts (row-major) and map 1:1 to JSON across list
        const acrossStarts = [];
        for (let r = 0; r < size.rows; r++) {
            for (let c = 0; c < size.cols; c++) {
                const i = r * size.cols + c;
                if (puzzle.grid[i] === '#') continue;
                const isStartAcross = c === 0 || puzzle.grid[r * size.cols + c - 1] === '#';
                if (!isStartAcross) continue;
                const seq = [];
                let cc = c;
                while (cc < size.cols && puzzle.grid[r * size.cols + cc] !== '#') {
                    seq.push(r * size.cols + cc);
                    cc++;
                }
                acrossStarts.push({
                    start: i,
                    seq
                });
            }
        }
        if ((puzzle.clues.across || []).length !== acrossStarts.length) {
            status(`Across clues (${(puzzle.clues.across || []).length}) do not match across entries in grid (${acrossStarts.length}).`);
        }
        acrossStarts.forEach((w, idx) => {
            const jsonClue = (puzzle.clues.across || [])[idx];
            if (!jsonClue) return;
            const num = jsonClue.number;
            numberToCells['A-' + num] = w.seq;
            w.seq.forEach(ii => {
                clueIndexMap.across[ii] = num;
            });
            if (overlayNumbers[w.start] == null) overlayNumbers[w.start] = num;
        });

        // 2) Build down word starts (top-to-bottom, left-to-right) and map 1:1 to JSON down list
        const downStarts = [];
        for (let r = 0; r < size.rows; r++) {
            for (let c = 0; c < size.cols; c++) {
                const i = r * size.cols + c;
                if (puzzle.grid[i] === '#') continue;
                const isStartDown = r === 0 || puzzle.grid[(r - 1) * size.cols + c] === '#';
                if (!isStartDown) continue;
                const seq = [];
                let rr = r;
                while (rr < size.rows && puzzle.grid[rr * size.cols + c] !== '#') {
                    seq.push(rr * size.cols + c);
                    rr++;
                }
                downStarts.push({
                    start: i,
                    seq
                });
            }
        }
        if ((puzzle.clues.down || []).length !== downStarts.length) {
            status(`Down clues (${(puzzle.clues.down || []).length}) do not match down entries in grid (${downStarts.length}).`);
        }
        downStarts.forEach((w, idx) => {
            const jsonClue = (puzzle.clues.down || [])[idx];
            if (!jsonClue) return;
            const num = jsonClue.number;
            numberToCells['D-' + num] = w.seq;
            w.seq.forEach(ii => {
                clueIndexMap.down[ii] = num;
            });
            if (overlayNumbers[w.start] == null) overlayNumbers[w.start] = num; // prefer across number if both
        });
    }

    // Numbers start at 1 and increment each clue start found scanning rows top to bottom, left to right
    function numberForCell(r, c) {
        let num = 0;
        for (let rr = 0; rr <= r; rr++) {
            for (let cc = 0; cc < size.cols; cc++) {
                const i = rr * size.cols + cc;
                if (puzzle.grid[i] === "#") continue;
                const isStartAcross = cc === 0 || puzzle.grid[rr * size.cols + cc - 1] === "#";
                const isStartDown = rr === 0 || puzzle.grid[(rr - 1) * size.cols + cc] === "#";
                if (isStartAcross || isStartDown) num++;
                if (rr === r && cc === c) return num;
            }
        }
        return 0;
    }

    // removed: buildComputedClueLists

    // --- Render grid ---
    function renderGrid() {
        crosswordGrid.innerHTML = "";
        crosswordGrid.style.gridTemplateColumns = `repeat(${size.cols}, 40px)`;
        crosswordGrid.style.gridTemplateRows = `repeat(${size.rows}, 40px)`;
        cells = [];

        for (let i = 0; i < puzzle.grid.length; i++) {
            const ch = puzzle.grid[i];
            const cell = document.createElement("div");
            cell.className = "cell";
            if (ch === "#") {
                cell.classList.add("block");
                cell.setAttribute("aria-label", "Block");
            } else {
                cell.setAttribute("tabindex", 0);
                cell.setAttribute("role", "textbox");
                cell.setAttribute("aria-multiline", "false");
                cell.setAttribute("aria-label", "Crossword cell");
            }
            cell.dataset.index = i;

            if (ch !== "#") {
                const num = overlayNumbers[i];
                if (num != null) {
                    const numEl = document.createElement("div");
                    numEl.className = "number";
                    numEl.textContent = num;
                    cell.appendChild(numEl);
                }

                // Add letter span for input and display
                const letterSpan = document.createElement("span");
                letterSpan.className = "letter";
                letterSpan.textContent = userGrid[i] || "";
                cell.appendChild(letterSpan);

                // Keyboard input handling
                cell.addEventListener("keydown", onKeyDown);
            }
            // Click handling for all cells (including blocks) to support toggle on repeated clicks
            cell.addEventListener("click", onCellClick);

            cells.push(cell);
            crosswordGrid.appendChild(cell);
        }
    }

    // --- Helpers ---
    function isBlock(i) {
        return puzzle && puzzle.grid[i] === "#";
    }

    // --- Highlight logic ---
    function updateHighlight() {
        cells.forEach((c) => {
            c.classList.remove("highlight", "cursor", "incorrect");
        });
        if (puzzle.grid[cursorIndex] === "#") return;

        // Highlight current word cells if mapping exists
        const wordNum = clueIndexMap[direction][cursorIndex];
        let wordCellsToHighlight = [];
        if (wordNum) {
            const key = (direction === "across" ? "A-" : "D-") + wordNum;
            wordCellsToHighlight = numberToCells[key] || [];
        }
        if (!wordCellsToHighlight.length) {
            wordCellsToHighlight = getContiguousWordCells(cursorIndex, direction);
        }
        wordCellsToHighlight.forEach((i) => cells[i].classList.add("highlight"));

        // Always show cursor on the current cell (if not a block)
        cells[cursorIndex].classList.add("cursor");

        // Highlight active clue in list (only if a number exists)
        document.querySelectorAll("#clues li").forEach((li) =>
            li.classList.remove("active")
        );
        if (wordNum) {
            const activeLi = document.querySelector(
                `#clues li[data-dir="${direction}"][data-num="${wordNum}"]`
            );
            if (activeLi) activeLi.classList.add("active");
        }
    }

    // Returns the contiguous sequence indices for the current cell and direction
    function getContiguousWordCells(index, dir) {
        const seq = [];
        if (puzzle.grid[index] === '#') return seq;
        const cols = size.cols;
        const r = Math.floor(index / cols);
        const c = index % cols;
        if (dir === 'across') {
            // scan left
            let cc = c;
            while (cc - 1 >= 0 && puzzle.grid[r * cols + (cc - 1)] !== '#') cc--;
            // forward
            while (cc < cols && puzzle.grid[r * cols + cc] !== '#') {
                seq.push(r * cols + cc);
                cc++;
            }
        } else {
            // scan up
            let rr = r;
            while (rr - 1 >= 0 && puzzle.grid[(rr - 1) * cols + c] !== '#') rr--;
            // forward
            while (rr < size.rows && puzzle.grid[rr * cols + c] !== '#') {
                seq.push(rr * cols + c);
                rr++;
            }
        }
        return seq;
    }

    // --- Keyboard input ---
    function onKeyDown(e) {
        if (!puzzle) return;
        const key = e.key;
        if (/^[a-zA-Z]$/.test(key)) {
            setCellLetter(cursorIndex, key.toUpperCase());
            moveCursor(1);
            e.preventDefault();
            return;
        }

        switch (key) {
            case "Backspace":
                clearCell(cursorIndex);
                moveCursor(-1);
                e.preventDefault();
                break;
            case "Delete":
                clearCell(cursorIndex);
                e.preventDefault();
                break;
            case "ArrowLeft":
                if (direction !== "across") direction = "across";
                moveCursor(-1);
                e.preventDefault();
                break;
            case "ArrowRight":
                if (direction !== "across") direction = "across";
                moveCursor(1);
                e.preventDefault();
                break;
            case "ArrowUp":
                if (direction !== "down") direction = "down";
                moveCursor(-1);
                e.preventDefault();
                break;
            case "ArrowDown":
                if (direction !== "down") direction = "down";
                moveCursor(1);
                e.preventDefault();
                break;
            case "Tab":
                e.preventDefault();
                nextClue(e.shiftKey ? -1 : 1);
                break;
            case " ":
            case "Spacebar":
                e.preventDefault();
                toggleDirection();
                updateHighlight();
                break;
            case "Enter":
                e.preventDefault();
                nextClue(1);
                break;
        }
    }

    function setCellLetter(i, ch) {
        if (puzzle.grid[i] === "#") return;
        userGrid[i] = ch;
        cells[i].querySelector(".letter").textContent = ch;
        cells[i].classList.remove("incorrect");
        checkCompletion();
    }

    function clearCell(i) {
        if (puzzle.grid[i] === "#") return;
        userGrid[i] = "";
        cells[i].querySelector(".letter").textContent = "";
        cells[i].classList.remove("incorrect");
        checkCompletion();
    }

    function checkCompletion() {
        if (isPuzzleComplete()) {
            pauseTimer();
            status("🎉 Puzzle complete! Time stopped.");
        } else {
            status("");
        }
    }

    // --- Cursor movement within current word ---
    function moveCursor(step) {
        const wordNum = clueIndexMap[direction][cursorIndex];
        const key = (direction === "across" ? "A-" : "D-") + wordNum;
        const wordCells = numberToCells[key] || [cursorIndex];
        let pos = wordCells.indexOf(cursorIndex);
        if (pos === -1) pos = 0;
        pos = Math.min(Math.max(0, pos + step), wordCells.length - 1);
        cursorIndex = wordCells[pos];
        updateHighlight();
        cells[cursorIndex].focus();
    }

    // --- Toggle across/down ---
    function toggleDirection() {
        direction = direction === "across" ? "down" : "across";
    }

    // --- Move to next/prev clue ---
    function nextClue(delta) {
        const clues = puzzle.clues[direction] || [];
        const wordNum = clueIndexMap[direction][cursorIndex];
        let idx = clues.findIndex((c) => c.number === wordNum);
        if (idx < 0) idx = 0;
        let stepsTried = 0;
        while (stepsTried < clues.length) {
            idx = (idx + delta + clues.length) % clues.length;
            const candidate = clues[idx];
            const key = (direction === "across" ? "A-" : "D-") + candidate.number;
            const newCells = numberToCells[key];
            if (newCells && newCells.length) {
                cursorIndex = newCells[0];
                updateHighlight();
                cells[cursorIndex].focus();
                return;
            }
            stepsTried++;
        }
    }

    // --- Clues rendering ---
    function renderClues() {
        acrossCluesEl.innerHTML = "";
        downCluesEl.innerHTML = "";

        (puzzle.clues.across || []).forEach((clue) => {
            const li = document.createElement("li");
            li.innerHTML = `<span class="clue-num">${clue.number}.</span> <span class="clue-text">${clue.clue}</span>`;
            li.dataset.dir = "across";
            li.dataset.num = clue.number;
            li.tabIndex = 0;
            li.addEventListener("click", () => {
                focusClue("across", clue.number);
            });
            li.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    focusClue("across", clue.number);
                    e.preventDefault();
                }
            });
            acrossCluesEl.appendChild(li);
        });

        (puzzle.clues.down || []).forEach((clue) => {
            const li = document.createElement("li");
            li.innerHTML = `<span class="clue-num">${clue.number}.</span> <span class="clue-text">${clue.clue}</span>`;
            li.dataset.dir = "down";
            li.dataset.num = clue.number;
            li.tabIndex = 0;
            li.addEventListener("click", () => {
                focusClue("down", clue.number);
            });
            li.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    focusClue("down", clue.number);
                    e.preventDefault();
                }
            });
            downCluesEl.appendChild(li);
        });
    }

    // --- Focus a clue by direction + number ---
    function focusClue(dir, number) {
        direction = dir;
        const key = (dir === "across" ? "A-" : "D-") + number;
        const wordCells = numberToCells[key];
        if (wordCells && wordCells.length) {
            cursorIndex = wordCells[0];
            updateHighlight();
            cells[cursorIndex].focus();
        }
    }

    // --- Check / Reveal / Reset logic ---
    function checkCells(target) {
        const indices = getTargetIndices(target);
        if (!indices.length) return;

        let incorrectCount = 0;
        indices.forEach((i) => {
            if (userGrid[i] === "" || userGrid[i] !== puzzle.grid[i]) {
                cells[i].classList.add("incorrect");
                incorrectCount++;
            } else {
                cells[i].classList.remove("incorrect");
            }
        });
        status(`${incorrectCount} incorrect square(s) checked.`);
    }

    function revealCells(target) {
        const indices = getTargetIndices(target);
        if (!indices.length) return;

        indices.forEach((i) => {
            if (puzzle.grid[i] !== "#") {
                userGrid[i] = puzzle.grid[i];
                cells[i].querySelector(".letter").textContent = puzzle.grid[i];
                cells[i].classList.remove("incorrect");
            }
        });
        status(`Revealed ${indices.length} square(s).`);
    }

    function resetCells(target) {
        const indices = getTargetIndices(target);
        if (!indices.length) return;

        indices.forEach((i) => {
            if (puzzle.grid[i] !== "#") {
                userGrid[i] = "";
                cells[i].querySelector(".letter").textContent = "";
                cells[i].classList.remove("incorrect");
            }
        });
        status(`Reset ${indices.length} square(s).`);
    }

    // --- Get cell indices based on target scope ---
    // target: 'square' | 'word' | 'puzzle'
    function getTargetIndices(target) {
        if (!puzzle) return [];

        if (target === "square") {
            if (puzzle.grid[cursorIndex] === "#") return [];
            return [cursorIndex];
        } else if (target === "word") {
            const wordNum = clueIndexMap[direction][cursorIndex];
            if (!wordNum) return [];
            const key = (direction === "across" ? "A-" : "D-") + wordNum;
            return numberToCells[key] || [];
        } else if (target === "puzzle") {
            return userGrid
                .map((ch, i) => (ch === "#" ? null : i))
                .filter((v) => v !== null);
        }
        return [];
    }

    // --- Toolbar dropdown buttons ---
    function setupToolbar() {
        // Utility to handle dropdown clicks for check/reveal/reset
        function setupDropdown(btn, dropdown, handler) {
            dropdown.querySelectorAll("button").forEach((b) => {
                b.addEventListener("click", () => {
                    dropdown.style.display = "none";
                    handler(b.dataset.action);
                });
            });

            // Show/hide dropdown on button click
            btn.addEventListener("click", () => {
                // Close other dropdowns
                [checkDropdown, revealDropdown, resetDropdown].forEach((dd) => {
                    if (dd !== dropdown) dd.style.display = "none";
                });
                dropdown.style.display =
                    dropdown.style.display === "block" ? "none" : "block";
            });

            // Hide dropdown if clicked outside
            document.addEventListener("click", (e) => {
                if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.style.display = "none";
                }
            });
        }

        setupDropdown(checkBtn, checkDropdown, (action) => {
            checkCells(action);
        });
        setupDropdown(revealBtn, revealDropdown, (action) => {
            revealCells(action);
        });
        setupDropdown(resetBtn, resetDropdown, (action) => {
            if (action === "timer") {
                resetTimer();
                startTimer();
            } else {
                resetCells(action);
            }
        });
    }

    const checkBtn = document.getElementById("checkBtn");
    const revealBtn = document.getElementById("revealBtn");
    const resetBtn = document.getElementById("resetBtn");
    setupToolbar();

    // --- Status message helper ---
    function status(msg) {
        statusEl.textContent = msg;
    }
})();