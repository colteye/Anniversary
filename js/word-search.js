// Word Search Game Implementation
class WordSearchGame {
    constructor(puzzle, onComplete) {
        this.puzzle = puzzle;
        this.onComplete = onComplete;
        this.foundWords = new Set();
        this.selectedCells = [];
        this.isSelecting = false;
        
        // Convert string grid to character grid
        this.grid = this.puzzle.grid.map(row => 
            typeof row === 'string' ? row.split('') : row
        );
        
        this.wordPositions = this.findWordPositions();
    }

    findWordPositions() {
        const positions = {};
        const grid = this.grid;
        const words = this.puzzle.words;

        words.forEach(word => {
            // Search horizontally
            for (let row = 0; row < grid.length; row++) {
                for (let col = 0; col <= grid[row].length - word.length; col++) {
                    let found = true;
                    for (let i = 0; i < word.length; i++) {
                        if (grid[row][col + i] !== word[i]) {
                            found = false;
                            break;
                        }
                    }
                    if (found) {
                        positions[word] = positions[word] || [];
                        positions[word].push({
                            start: { row, col },
                            end: { row, col: col + word.length - 1 },
                            direction: 'horizontal'
                        });
                    }
                }
            }

            // Search vertically
            for (let col = 0; col < grid[0].length; col++) {
                for (let row = 0; row <= grid.length - word.length; row++) {
                    let found = true;
                    for (let i = 0; i < word.length; i++) {
                        if (grid[row + i][col] !== word[i]) {
                            found = false;
                            break;
                        }
                    }
                    if (found) {
                        positions[word] = positions[word] || [];
                        positions[word].push({
                            start: { row, col },
                            end: { row: row + word.length - 1, col },
                            direction: 'vertical'
                        });
                    }
                }
            }

            // Search diagonally (down-right)
            for (let row = 0; row <= grid.length - word.length; row++) {
                for (let col = 0; col <= grid[row].length - word.length; col++) {
                    let found = true;
                    for (let i = 0; i < word.length; i++) {
                        if (grid[row + i][col + i] !== word[i]) {
                            found = false;
                            break;
                        }
                    }
                    if (found) {
                        positions[word] = positions[word] || [];
                        positions[word].push({
                            start: { row, col },
                            end: { row: row + word.length - 1, col: col + word.length - 1 },
                            direction: 'diagonal'
                        });
                    }
                }
            }

            // Search diagonally (down-left)
            for (let row = 0; row <= grid.length - word.length; row++) {
                for (let col = word.length - 1; col < grid[row].length; col++) {
                    let found = true;
                    for (let i = 0; i < word.length; i++) {
                        if (grid[row + i][col - i] !== word[i]) {
                            found = false;
                            break;
                        }
                    }
                    if (found) {
                        positions[word] = positions[word] || [];
                        positions[word].push({
                            start: { row, col },
                            end: { row: row + word.length - 1, col: col - word.length + 1 },
                            direction: 'diagonal-left'
                        });
                    }
                }
            }
        });

        return positions;
    }

    render() {
        const gridElement = document.getElementById('word-search-grid');
        const titleElement = document.getElementById('puzzle-title');
        const wordsListElement = document.getElementById('words-list');

        console.log('Rendering puzzle:', this.puzzle.title);
        console.log('Grid element:', gridElement);
        console.log('Words list element:', wordsListElement);

        titleElement.textContent = this.puzzle.title;
        gridElement.innerHTML = '';
        gridElement.style.gridTemplateColumns = `repeat(${this.grid[0].length}, 1fr)`;

        // Create grid cells
        this.grid.forEach((row, rowIndex) => {
            row.forEach((letter, colIndex) => {
                const cell = document.createElement('div');
                cell.className = 'word-search-cell';
                cell.textContent = letter;
                cell.dataset.row = rowIndex;
                cell.dataset.col = colIndex;
                
                cell.addEventListener('mousedown', (e) => this.startSelection(e, rowIndex, colIndex));
                cell.addEventListener('mouseover', (e) => this.updateSelection(e, rowIndex, colIndex));
                cell.addEventListener('mouseup', () => this.endSelection());
                
                gridElement.appendChild(cell);
            });
        });

        // Create words list - SIMPLE APPROACH
        wordsListElement.innerHTML = '';
        this.puzzle.words.forEach(word => {
            const wordElement = document.createElement('div');
            wordElement.className = 'word-item';
            wordElement.textContent = word;
            wordElement.dataset.word = word;
            wordsListElement.appendChild(wordElement);
        });

        console.log('Created word elements:', wordsListElement.children.length);

        // Prevent text selection on the grid
        gridElement.addEventListener('selectstart', (e) => e.preventDefault());
    }

    startSelection(e, row, col) {
        e.preventDefault();
        this.isSelecting = true;
        this.selectedCells = [{ row, col }];
        this.updateSelectedCells();
    }

    updateSelection(e, row, col) {
        if (!this.isSelecting) return;
        
        const startCell = this.selectedCells[0];
        this.selectedCells = this.getCellsBetween(startCell.row, startCell.col, row, col);
        this.updateSelectedCells();
    }

    endSelection() {
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        const selectedWord = this.getSelectedWord();
        
        console.log('Selected word:', selectedWord);
        console.log('Target words:', this.puzzle.words);
        console.log('Already found:', Array.from(this.foundWords));
        
        if (this.puzzle.words.includes(selectedWord) && !this.foundWords.has(selectedWord)) {
            console.log('Found new word:', selectedWord);
            this.foundWords.add(selectedWord);
            this.markWordAsFound(selectedWord);
            this.updateWordInList(selectedWord);
            
            if (this.foundWords.size === this.puzzle.words.length) {
                setTimeout(() => {
                    document.getElementById('puzzle-complete').classList.add('show');
                    setTimeout(() => {
                        this.onComplete();
                    }, 1500);
                }, 500);
            }
        } else {
            this.clearSelection();
        }
    }

    getCellsBetween(startRow, startCol, endRow, endCol) {
        const cells = [];
        const deltaRow = endRow - startRow;
        const deltaCol = endCol - startCol;
        const distance = Math.max(Math.abs(deltaRow), Math.abs(deltaCol));
        
        if (distance === 0) {
            return [{ row: startRow, col: startCol }];
        }
        
        const stepRow = deltaRow === 0 ? 0 : deltaRow / Math.abs(deltaRow);
        const stepCol = deltaCol === 0 ? 0 : deltaCol / Math.abs(deltaCol);
        
        // Only allow straight lines (horizontal, vertical, diagonal)
        if (Math.abs(deltaRow) !== 0 && Math.abs(deltaCol) !== 0 && Math.abs(deltaRow) !== Math.abs(deltaCol)) {
            return [{ row: startRow, col: startCol }];
        }
        
        for (let i = 0; i <= distance; i++) {
            const row = startRow + stepRow * i;
            const col = startCol + stepCol * i;
            if (row >= 0 && row < this.grid.length && col >= 0 && col < this.grid[0].length) {
                cells.push({ row, col });
            }
        }
        
        return cells;
    }

    getSelectedWord() {
        return this.selectedCells
            .map(cell => this.grid[cell.row][cell.col])
            .join('');
    }

    updateSelectedCells() {
        // Clear previous selection
        document.querySelectorAll('.word-search-cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
        
        // Add selection to current cells
        this.selectedCells.forEach(cell => {
            const cellElement = document.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
            if (cellElement && !cellElement.classList.contains('found')) {
                cellElement.classList.add('selected');
            }
        });
    }

    markWordAsFound(word) {
        console.log('Marking word as found:', word);
        
        if (this.wordPositions[word]) {
            const position = this.wordPositions[word][0];
            const cells = this.getCellsBetween(
                position.start.row, position.start.col,
                position.end.row, position.end.col
            );
            
            cells.forEach(cell => {
                const cellElement = document.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
                if (cellElement) {
                    cellElement.classList.remove('selected');
                    cellElement.classList.add('found');
                }
            });
        }
    }

    updateWordInList(word) {
        const wordElement = document.querySelector(`[data-word="${word}"]`);
        if (wordElement) {
            wordElement.classList.add('found');
            console.log('Updated word in list:', word);
        } else {
            console.log('Could not find word element for:', word);
        }
    }

    clearSelection() {
        document.querySelectorAll('.word-search-cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
        this.selectedCells = [];
    }
}

// Global variables for word search
let currentWordSearchGame = null;

// Get puzzles from multiple possible sources
function getWordSearchPuzzles() {
    if (typeof window.wordSearchPuzzles !== 'undefined') {
        return window.wordSearchPuzzles;
    }
    if (typeof wordSearchPuzzles !== 'undefined') {
        return wordSearchPuzzles;
    }
    
    console.warn('No word search puzzles loaded, using fallback');
    return [
        {
            title: "Dubai Adventure",
            words: ["DUBAI", "CHOCOLATE", "LABUBU"],
            grid: [
                'DBOAULOOAU',
                'BAITHABULC',
                'IUUULBBCAH',
                'HUUBDUBAIO',
                'ATLTBBAOTC',
                'AAABBUUABO',
                'OTULUAABLL',
                'BBCEUUBOAE'
            ]
        }
    ];
}

function showWordSearch(imageIndex) {
    console.log('Show word search for image index:', imageIndex);
    
    const puzzles = getWordSearchPuzzles();
    
    if (!puzzles || puzzles.length === 0) {
        console.error('No word search puzzles available');
        return;
    }
    
    const puzzleIndex = imageIndex % puzzles.length;
    const puzzle = puzzles[puzzleIndex];
    
    console.log('Using puzzle:', puzzle);
    
    currentWordSearchGame = new WordSearchGame(puzzle, () => {
        console.log('Puzzle completed, unlocking image');
        if (typeof window.unlockCurrentImage === 'function') {
            window.unlockCurrentImage();
        } else if (typeof unlockCurrentImage === 'function') {
            unlockCurrentImage();
        } else {
            console.error('unlockCurrentImage function not available');
        }
        hideWordSearch();
    });
    
    currentWordSearchGame.render();
    document.getElementById('word-search-popup').classList.add('show');
}

function hideWordSearch() {
    document.getElementById('word-search-popup').classList.remove('show');
    document.getElementById('puzzle-complete').classList.remove('show');
    currentWordSearchGame = null;
}

window.showWordSearch = showWordSearch;
window.hideWordSearch = hideWordSearch;

function initWordSearch() {
    console.log('Initializing word search...');
    const puzzles = getWordSearchPuzzles();
    console.log('Available puzzles:', puzzles);
    
    const closeButton = document.getElementById('close-word-search');
    const popup = document.getElementById('word-search-popup');
    
    if (closeButton) {
        closeButton.addEventListener('click', hideWordSearch);
    }
    
    if (popup) {
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                hideWordSearch();
            }
        });
    }
}
