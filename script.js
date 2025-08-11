console.log("現金流遊戲腳本已載入！");

// --- Game State ---
let gameState = {};
const SAVE_KEY = 'cashflowGameState';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("遊戲已準備就緒！");
    initializeGame();
});

async function initializeGame() {
    // Setup UI Listeners
    document.getElementById('roll-dice-btn').addEventListener('click', rollDice);
    document.getElementById('close-modal-btn').addEventListener('click', () => closeCardModal());
    document.getElementById('save-game-btn').addEventListener('click', saveGame);
    document.getElementById('new-game-btn').addEventListener('click', newGame);

    // Load all game data (cards, professions)
    const professions = await loadData('data/professions.json');
    const opportunityCards = await loadData('data/opportunity_cards.json');
    const marketCards = await loadData('data/market_cards.json');
    const doodadCards = await loadData('data/doodad_cards.json');

    if (!loadGame(professions)) {
        // If no save game, start a new one
        setupNewGame(professions, opportunityCards, marketCards, doodadCards);
    }

    // Render the loaded/new game state
    rebuildUI();
}

function rebuildUI() {
    createGameBoard();
    renderPlayerDashboard();
    createPlayerToken();
    movePlayerToken(gameState.players[gameState.currentPlayerIndex].position);
}

// --- Data & State Management ---
async function loadData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (e) {
        console.error(`無法載入資料: ${url}`, e);
        return [];
    }
}

function setupNewGame(professions, opportunityCards, marketCards, doodadCards) {
    const p = professions[0];
    const totalExpenses = Object.values(p.expenses).reduce((s, e) => s + e, 0);
    const initialAssets = { '儲蓄': { type: 'savings', cost: p.assets.savings, cashflow: 0 } };
    
    gameState = {
        players: [{
            id: 0, profession: p.title,
            financials: {
                income: p.income, expenses: p.expenses, assets: initialAssets, liabilities: p.liabilities,
                totalExpenses, cashflow: p.income - totalExpenses, cash: p.assets.savings,
            },
            position: 0, missTurns: 0, childCount: 0,
        }],
        opportunityCards, marketCards, doodadCards,
        currentPlayerIndex: 0,
        ratRaceTrack: [], // Populated by createGameBoard
        gameWon: false,
    };
}

function saveGame() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
        alert("遊戲已儲存！");
    } catch (e) {
        console.error("無法儲存遊戲:", e);
        alert("儲存遊戲失敗。");
    }
}

function loadGame(professions) {
    const savedState = localStorage.getItem(SAVE_KEY);
    if (savedState) {
        try {
            gameState = JSON.parse(savedState);
            // Re-establish card data in case it's not in the save file for some reason
            if (!gameState.opportunityCards) gameState.opportunityCards = []; 
            alert("已載入之前的遊戲進度。");
            return true;
        } catch (e) {
            console.error("無法載入遊戲存檔:", e);
            return false;
        }
    }
    return false;
}

function newGame() {
    if (confirm("你確定要開始一個新遊戲嗎？所有未儲存的進度將會遺失。")) {
        localStorage.removeItem(SAVE_KEY);
        location.reload();
    }
}

// --- UI Rendering ---
function renderPlayerDashboard() {
    const p = gameState.players[gameState.currentPlayerIndex];
    if (!p) return;
    const dash = document.getElementById('player-info');
    const { financials: fin } = p;
    const genAssetRows = (d) => Object.entries(d).map(([k, v]) => `<tr><td>${k}</td><td class="amount">${v.cost.toLocaleString()}</td></tr>`).join('');
    const genLiabilityRows = (d) => Object.entries(d).map(([k, v]) => `<tr><td>${k}</td><td class="amount">${v.toLocaleString()}</td></tr>`).join('');
    
    dash.innerHTML = `
        <h3>職業: ${p.profession}</h3>
        <div class="financial-sheet">
            <h4>損益表</h4>
            <table>
                <tr><th>總收入</th><td class="amount">${fin.income.toLocaleString()}</td></tr>
                <tr><th>總支出</th><td class="amount">${fin.totalExpenses.toLocaleString()}</td></tr>
                <tr class="highlight"><th>月現金流</th><td class="amount">${fin.cashflow.toLocaleString()}</td></tr>
                <tr><th>非工資收入</th><td class="amount">${calculatePassiveIncome(p).toLocaleString()}</td></tr>
            </table>
            <h4>資產</h4>
            <table><thead><tr><th>項目</th><th>成本</th></tr></thead><tbody>${genAssetRows(fin.assets)}</tbody></table>
            <h4>負債</h4>
            <table><thead><tr><th>項目</th><th>金額</th></tr></thead><tbody>${genLiabilityRows(fin.liabilities)}</tbody></table>
            <h4>目前現金</h4>
            <p class="cash-display">$${fin.cash.toLocaleString()}</p>
        </div>
    `;
    checkWinCondition();
}

function createGameBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    const layout = [
        { t: 'start', T: '🏁 起點' },{ t: 'opportunity', T: '機會' },{ t: 'market', T: '市場風雲' },{ t: 'doodad', T: '額外支出' },{ t: 'opportunity', T: '機會' },{ t: 'charity', T: '慈善事業' },{ t: 'opportunity', T: '機會' },{ t: 'payday', T: '發薪日' },
        { t: 'baby', T: '生小孩' },{ t: 'opportunity', T: '機會' },{ t: 'market', T: '市場風雲' },{ t: 'doodad', T: '額外支出' },
        { t: 'payday', T: '發薪日' },{ t: 'opportunity', T: '機會' },{ t: 'downsized', T: '失業' },{ t: 'opportunity', T: '機會' },{ t: 'market', T: '市場風雲' },{ t: 'doodad', T: '額外支出' },
        { t: 'payday', T: '發薪日' },{ t: 'opportunity', T: '機會' },{ t: 'market', T: '市場風雲' },{ t: 'doodad', T: '額外支出' },{ t: 'opportunity', T: '機會' },{ t: 'payday', T: '發薪日' },
    ];
    gameState.ratRaceTrack = layout.map(c => ({ type: c.t, text: c.T }));
    layout.forEach((c, i) => {
        const cell = document.createElement('div');
        cell.classList.add('board-cell', `cell-${i}`, `cell-${c.t}`);
        cell.innerHTML = `<span>${c.T}</span>`;
        board.appendChild(cell);
    });
    const center = document.createElement('div');
    center.className = 'center-area';
    center.textContent = '老鼠賽跑';
    board.appendChild(center);
}

function createPlayerToken() {
    const p = gameState.players[gameState.currentPlayerIndex];
    const board = document.getElementById('game-board');
    // Remove existing token if it's there
    const existingToken = document.getElementById(`player-token-${p.id}`);
    if (existingToken) existingToken.remove();

    const token = document.createElement('div');
    token.id = `player-token-${p.id}`;
    token.className = 'player-token';
    token.textContent = `P${p.id + 1}`;
    board.appendChild(token);
}

function movePlayerToken(pos) {
    const p = gameState.players[gameState.currentPlayerIndex];
    const token = document.getElementById(`player-token-${p.id}`);
    const cell = document.querySelector(`.cell-${pos}`);
    if (token && cell) {
        const cellRect = cell.getBoundingClientRect();
        const boardRect = cell.parentElement.getBoundingClientRect();
        token.style.top = `${cellRect.top - boardRect.top + (cellRect.height / 2) - 15}px`;
        token.style.left = `${cellRect.left - boardRect.left + (cellRect.width / 2) - 15}px`;
    }
}

// --- Game Logic ---
function rollDice() {
    if (gameState.gameWon) return;
    const player = gameState.players[gameState.currentPlayerIndex];
    if (player.missTurns > 0) {
        player.missTurns--;
        alert(`你暫停一回合，還剩下 ${player.missTurns} 回合。`);
        saveGame(); // Auto-save state
        return;
    }

    const dice = Math.floor(Math.random() * 6) + 1;
    document.getElementById('dice-result').textContent = dice;
    const len = gameState.ratRaceTrack.length;
    const oldPos = player.position;
    let passedPayday = false;
    for (let i = 1; i <= dice; i++) {
        if (gameState.ratRaceTrack[(oldPos + i) % len].type === 'payday') {
            handlePayday();
            passedPayday = true;
            break;
        }
    }
    const newPos = (oldPos + dice) % len;
    player.position = newPos;
    movePlayerToken(newPos);
    const newCell = gameState.ratRaceTrack[newPos];
    if (!(newCell.type === 'payday' && passedPayday)) {
        handleCellAction(newCell.type);
    }
    saveGame(); // Auto-save after every move
}

function handlePayday() {
    const p = gameState.players[gameState.currentPlayerIndex];
    p.financials.cash += p.financials.cashflow;
    renderPlayerDashboard();
}

function handleCellAction(cellType) {
    const player = gameState.players[gameState.currentPlayerIndex];
    const fin = player.financials;

    switch (cellType) {
        case 'opportunity': drawCard('opportunity'); break;
        case 'market': drawCard('market'); break;
        case 'doodad': drawCard('doodad'); break;
        case 'baby':
            player.childCount++;
            const childExpense = player.financials.expenses.child_expense_per || 400;
            fin.expenses.child_expenses = (fin.expenses.child_expenses || 0) + childExpense;
            fin.totalExpenses += childExpense;
            fin.cashflow -= childExpense;
            alert(`恭喜，你生了一個小孩！你的支出增加了 $${childExpense}。`);
            renderPlayerDashboard();
            break;
        case 'downsized':
            alert('你失業了！支付你的總支出，並休息兩回合。');
            fin.cash -= fin.totalExpenses;
            player.missTurns = 2;
            renderPlayerDashboard();
            break;
    }
}

function drawCard(deckType) {
    const deck = gameState[`${deckType}Cards`];
    if (!deck || deck.length === 0) return;
    const card = deck[Math.floor(Math.random() * deck.length)];
    showCardModal(card);
}

function showCardModal(card) {
    document.getElementById('card-title').textContent = card.title;
    document.getElementById('card-description').textContent = card.description;
    const details = document.getElementById('card-details');
    let detailsHtml = '';
    if (card.cost) detailsHtml += `<p><strong>費用:</strong> $${card.cost.toLocaleString()}</p>`;
    if (card.down_payment) detailsHtml += `<p><strong>頭期款:</strong> $${card.down_payment.toLocaleString()}</p>`;
    if (card.cashflow) detailsHtml += `<p><strong>現金流:</strong> $${card.cashflow.toLocaleString()}</p>`;
    if (card.cost_per_share) detailsHtml += `<p><strong>每股成本:</strong> $${card.cost_per_share.toLocaleString()}</p>`;
    if (card.trading_range) detailsHtml += `<p><strong>交易範圍:</strong> $${card.trading_range}</p>`;
    if (card.offer) detailsHtml += `<p><strong>收購價:</b> $${card.offer.toLocaleString()}</p>`;
    details.innerHTML = detailsHtml;

    const actions = document.getElementById('card-actions');
    actions.innerHTML = '<button id="close-modal-btn">關閉</button>';
    document.getElementById('close-modal-btn').addEventListener('click', () => closeCardModal());

    if (card.action_text) {
        const btn = document.createElement('button');
        btn.textContent = card.action_text;
        btn.onclick = () => handleCardAction(card);
        actions.insertBefore(btn, actions.firstChild);
    }
    document.getElementById('card-modal').style.display = 'flex';
}

function closeCardModal(callback) {
    document.getElementById('card-modal').style.display = 'none';
    if (typeof callback === 'function') setTimeout(callback, 10);
}

function handleCardAction(card) {
    const player = gameState.players[gameState.currentPlayerIndex];
    const fin = player.financials;

    switch (card.card_type) {
        case 'stock': {
            const shares = parseInt(prompt(`你要購買多少股 "${card.title}"？ (每股 $${card.cost_per_share})`), 10);
            if (isNaN(shares) || shares <= 0) return closeCardModal(() => alert('請輸入有效的股數。'));
            const totalCost = shares * card.cost_per_share;
            if (fin.cash < totalCost) return closeCardModal(() => alert('現金不足！'));
            
            fin.cash -= totalCost;
            const assetKey = `股票: ${card.title}`;
            if (fin.assets[assetKey]) {
                fin.assets[assetKey].shares += shares;
                fin.assets[assetKey].cost += totalCost;
            } else {
                fin.assets[assetKey] = { type: 'stock', shares, cost: totalCost, cashflow: 0 };
            }
            break;
        }
        case 'doodad': {
            if (fin.cash < card.cost) return closeCardModal(() => alert('現金不足！你需要想辦法籌錢。'));
            fin.cash -= card.cost;
            break;
        }
        case 'real_estate': {
            if (!confirm(`你確定要購買 "${card.title}" 嗎？`)) return closeCardModal();
            if (fin.cash < card.down_payment) return closeCardModal(() => alert('現金不足以支付頭期款！'));

            fin.cash -= card.down_payment;
            fin.cashflow += card.cashflow;
            const assetKey = `房地產: ${card.title}`;
            fin.assets[assetKey] = { type: 'real_estate', cost: card.cost, cashflow: card.cashflow };
            const liabilityKey = `房貸: ${card.title}`;
            fin.liabilities[liabilityKey] = card.mortgage;
            break;
        }
        case 'market': {
            const assetKey = `房地產: ${card.property_type}`;
            if (!fin.assets[assetKey]) return closeCardModal(() => alert(`你沒有 "${card.property_type}" 可以出售。`));
            if (!confirm(`你要以 $${card.offer.toLocaleString()} 的價格出售你的 ${card.property_type} 嗎？`)) return closeCardModal();

            fin.cash += card.offer;
            fin.cashflow -= fin.assets[assetKey].cashflow;
            delete fin.assets[assetKey];
            const liabilityKey = `房貸: ${card.property_type}`;
            if(fin.liabilities[liabilityKey]) {
                delete fin.liabilities[liabilityKey];
            }
            break;
        }
    }
    renderPlayerDashboard();
    closeCardModal();
}

function calculatePassiveIncome(player) {
    return Object.values(player.financials.assets).reduce((total, asset) => total + (asset.cashflow || 0), 0);
}

function checkWinCondition() {
    if (gameState.gameWon) return;
    const player = gameState.players[gameState.currentPlayerIndex];
    const passiveIncome = calculatePassiveIncome(player);
    if (passiveIncome > player.financials.totalExpenses) {
        gameState.gameWon = true;
        document.getElementById('roll-dice-btn').disabled = true;
        setTimeout(() => {
            alert(`恭喜！你的非工資收入 ($${passiveIncome.toLocaleString()}) 已超過總支出 ($${player.financials.totalExpenses.toLocaleString()}).\n\n你已成功跳出老鼠賽跑！`);
        }, 500);
    }
}

function translateFinancialTerm(term) {
    const terms = {
        savings: '儲蓄', income: '收入', expenses: '支出', assets: '資產', liabilities: '負債',
        home_mortgage: '房屋貸款', school_loans: '就學貸款', car_loans: '汽車貸款', credit_card_debt: '信用卡債',
        taxes: '稅', home_mortgage_payment: '房貸支出', school_loan_payment: '學貸支出',
        car_payment: '車貸支出', credit_card_payment: '信用卡支出', other_expenses: '其他支出',
        child_expenses: '育兒支出'
    };
    return terms[term] || term;
}