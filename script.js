const DateTime = luxon.DateTime;

// Anti-copy security (already in HTML protection, but kept for redundancy)
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', event => {
    if (event.ctrlKey && (event.key === 'c' || event.key === 'C' || event.key === 'u' || event.key === 'U')) {
        event.preventDefault();
        showNotification('Copying is disabled for security reasons', 'warning');
    }
    if (event.key === 'F12') {
        event.preventDefault();
        showNotification('Developer tools are disabled', 'warning');
    }
});

const ADMIN_SECRET = 'admin123';
let currentUser = null;
let activeSessions = JSON.parse(localStorage.getItem('activeSessions')) || {};
let usersData = JSON.parse(localStorage.getItem('usersData')) || {};
let selectedExpiryDays = 30;

setInterval(checkAllExpiry, 3600000);

function selectExpiry(days) {
    selectedExpiryDays = days;
    document.querySelectorAll('.expiry-option').forEach(opt => opt.classList.remove('selected'));
    document.getElementById(`expiry${days}`).classList.add('selected');
}

function checkAllExpiry() {
    const today = DateTime.now().toISODate();
    let expired = 0;

    Object.keys(usersData).forEach(code => {
        if (usersData[code].expiry < today) {
            delete usersData[code];
            if (activeSessions[code]) delete activeSessions[code];
            expired++;
        }
    });

    localStorage.setItem('usersData', JSON.stringify(usersData));
    localStorage.setItem('activeSessions', JSON.stringify(activeSessions));

    if (expired > 0) showNotification(`${expired} expired code(s) removed`, 'info');
    document.getElementById('lastExpiryCheck').textContent = DateTime.now().toFormat('HH:mm:ss');
}

function checkAdminAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === ADMIN_SECRET) {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('mainWebsite').style.display = 'none';
        checkAllExpiry();
        loadUsersList();
        return true;
    }
    return false;
}

function checkUserSession() {
    const sessionId = localStorage.getItem('sessionId');
    const userCode = localStorage.getItem('userCode');

    if (sessionId && userCode && activeSessions[userCode] === sessionId) {
        const today = DateTime.now().toISODate();
        if (usersData[userCode] && usersData[userCode].expiry < today) {
            logout();
            return false;
        }

        if (usersData[userCode]) {
            currentUser = userCode;
            if (!usersData[userCode].tradingData) {
                usersData[userCode].tradingData = {
                    balance: 10000,
                    totalTrades: 0,
                    winTrades: 0,
                    totalProfit: 0,
                    positions: []
                };
                localStorage.setItem('usersData', JSON.stringify(usersData));
            }

            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'none';
            document.getElementById('mainWebsite').style.display = 'block';
            document.getElementById('userCodeDisplay').textContent = userCode;

            loadUserTradingData();
            return true;
        }
    }
    return false;
}

function loginWithCode() {
    const code = document.getElementById('tradingCode').value.trim();

    if (!code || !usersData[code]) {
        document.getElementById('loginError').style.display = 'block';
        return;
    }

    const today = DateTime.now().toISODate();
    if (usersData[code].expiry < today) {
        document.getElementById('loginError').textContent = 'Trading code has expired!';
        document.getElementById('loginError').style.display = 'block';
        delete usersData[code];
        localStorage.setItem('usersData', JSON.stringify(usersData));
        return;
    }

    const sessionId = Math.random().toString(36).substring(2) + Date.now();

    if (activeSessions[code]) delete activeSessions[code];

    if (!usersData[code].tradingData) {
        usersData[code].tradingData = {
            balance: 10000,
            totalTrades: 0,
            winTrades: 0,
            totalProfit: 0,
            positions: []
        };
    }

    activeSessions[code] = sessionId;
    localStorage.setItem('activeSessions', JSON.stringify(activeSessions));
    localStorage.setItem('sessionId', sessionId);
    localStorage.setItem('userCode', code);

    currentUser = code;

    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('mainWebsite').style.display = 'block';
    document.getElementById('userCodeDisplay').textContent = code;

    loadUserTradingData();
    showNotification('Login successful! Welcome to PrimeAI Trade.', 'success');
}

function loadUserTradingData() {
    if (!currentUser || !usersData[currentUser] || !usersData[currentUser].tradingData) return;

    const data = usersData[currentUser].tradingData;

    document.getElementById('balance').textContent = '$' + data.balance.toFixed(2);
    document.getElementById('totalTrades').textContent = data.totalTrades;

    const winRate = data.totalTrades > 0 ? (data.winTrades / data.totalTrades * 100).toFixed(1) : 99.7;
    document.getElementById('winRate').textContent = winRate + '%';

    document.getElementById('totalProfit').textContent = '$' + data.totalProfit.toFixed(2);
    document.getElementById('totalProfit').className = data.totalProfit >= 0 ? 'stat-value win' : 'stat-value loss';
    document.getElementById('totalPnl').textContent = '$' + data.totalProfit.toFixed(2);
    document.getElementById('totalPnl').className = data.totalProfit >= 0 ? 'balance-value positive' : 'balance-value negative';

    updatePositionsDisplay(data.positions);
}

function updatePositionsDisplay(positions) {
    const positionsDiv = document.getElementById('openPositions');

    if (!positions || positions.length === 0) {
        positionsDiv.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:10px;">No open positions</div>';
        return;
    }

    positionsDiv.innerHTML = positions.map(p => {
        const priceDiff = p.type === 'buy' 
            ? (currentPrice - p.entryPrice)
            : (p.entryPrice - currentPrice);
        const pnl = (priceDiff / p.entryPrice) * p.positionSize;
        const pnlPercent = (priceDiff / p.entryPrice) * 100 * p.leverage;

        return `
            <div class="position-item ${p.type}">
                <div>
                    <div style="font-weight:600">${p.symbol.replace('USDT', '')} ${p.type.toUpperCase()} ${p.leverage}X</div>
                    <div style="font-size:0.7rem;">$${p.amount}</div>
                    <div style="font-size:0.65rem; color:#94A3B8;">@ $${p.entryPrice.toFixed(2)}</div>
                </div>
                <div>
                    <div class="position-pnl ${pnl >= 0 ? 'positive' : 'negative'}">$${pnl.toFixed(2)}</div>
                    <div style="font-size:0.7rem; color:${pnl >= 0 ? '#22C55E' : '#EF4444'}">${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%</div>
                    <button class="close-btn" onclick="closePosition(${p.id})">X</button>
                </div>
            </div>
        `;
    }).join('');
}

function saveUserTradingData() {
    if (!currentUser || !usersData[currentUser]) return;
    localStorage.setItem('usersData', JSON.stringify(usersData));
}

function logout() {
    if (currentUser && activeSessions[currentUser]) {
        delete activeSessions[currentUser];
        localStorage.setItem('activeSessions', JSON.stringify(activeSessions));
    }

    localStorage.removeItem('sessionId');
    localStorage.removeItem('userCode');
    currentUser = null;

    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('mainWebsite').style.display = 'none';

    showNotification('Logged out successfully', 'info');
}

function logoutFromAdmin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('mainWebsite').style.display = 'none';
}

function generateNewCode() {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('newCode').textContent = newCode;

    const expiryDate = DateTime.now().plus({ days: selectedExpiryDays }).toISODate();
    const createdAt = DateTime.now().toISODate();

    usersData[newCode] = {
        expiry: expiryDate,
        createdAt: createdAt,
        days: selectedExpiryDays,
        tradingData: {
            balance: 10000,
            totalTrades: 0,
            winTrades: 0,
            totalProfit: 0,
            positions: []
        }
    };

    localStorage.setItem('usersData', JSON.stringify(usersData));

    showNotification(`New code: ${newCode} (expires in ${selectedExpiryDays} days)`, 'success');
    loadUsersList();
}

function removeUser() {
    const code = document.getElementById('removeCode').value.trim();

    if (!code) {
        showNotification('Please enter a trading code', 'error');
        return;
    }

    if (usersData[code]) {
        delete usersData[code];
        localStorage.setItem('usersData', JSON.stringify(usersData));

        if (activeSessions[code]) {
            delete activeSessions[code];
            localStorage.setItem('activeSessions', JSON.stringify(activeSessions));
        }

        showNotification('User ' + code + ' removed', 'success');
        loadUsersList();
        document.getElementById('removeCode').value = '';
    } else {
        showNotification('Trading code not found', 'error');
    }
}

function removeUserByCode(code) {
    if (confirm(`Remove user ${code}?`)) {
        delete usersData[code];
        localStorage.setItem('usersData', JSON.stringify(usersData));

        if (activeSessions[code]) {
            delete activeSessions[code];
            localStorage.setItem('activeSessions', JSON.stringify(activeSessions));
        }

        showNotification('User ' + code + ' removed', 'success');
        loadUsersList();
    }
}

// Edit User Expiry
function editUserExpiry(code) {
    const userItem = document.getElementById(`user-${code}`);
    const expirySpan = userItem.querySelector('.expiry-text');
    const currentExpiry = usersData[code].expiry;

    const input = document.createElement('input');
    input.type = 'date';
    input.value = currentExpiry;
    input.className = 'user-expiry-input';
    input.id = `expiry-input-${code}`;

    expirySpan.innerHTML = '';
    expirySpan.appendChild(input);

    const editBtn = userItem.querySelector('.user-action-btn.edit');
    editBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    editBtn.classList.remove('edit');
    editBtn.classList.add('save');
    editBtn.onclick = () => saveUserExpiry(code);
}

function saveUserExpiry(code) {
    const input = document.getElementById(`expiry-input-${code}`);
    const newExpiry = input.value;

    if (!newExpiry) {
        showNotification('Please select a date', 'error');
        return;
    }

    const expiryDate = DateTime.fromISO(newExpiry);
    const today = DateTime.now();
    const days = Math.round(expiryDate.diff(today, 'days').days);

    usersData[code].expiry = newExpiry;
    usersData[code].days = days;

    localStorage.setItem('usersData', JSON.stringify(usersData));

    showNotification(`Expiry updated for ${code}`, 'success');
    loadUsersList();
}

// Reset User Balance
function resetUserBalance(code) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'resetModal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>⚠️ Reset User Balance</h3>
            <p>Are you sure you want to reset balance for user <strong>${code}</strong>?</p>
            <p>Current balance: $${usersData[code].tradingData?.balance?.toFixed(2) || '10000.00'}</p>
            <p>This will reset to <strong>$10,000.00</strong> and clear all trading history.</p>
            <div class="modal-buttons">
                <button class="modal-btn confirm" onclick="confirmReset('${code}')">Yes, Reset</button>
                <button class="modal-btn cancel" onclick="closeModal()">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmReset(code) {
    usersData[code].tradingData = {
        balance: 10000,
        totalTrades: 0,
        winTrades: 0,
        totalProfit: 0,
        positions: []
    };

    localStorage.setItem('usersData', JSON.stringify(usersData));

    if (activeSessions[code]) {
        showNotification(`User ${code} will see reset balance on next login`, 'info');
    }

    showNotification(`Balance reset for ${code} to $10,000`, 'success');
    closeModal();
    loadUsersList();
}

function closeModal() {
    const modal = document.getElementById('resetModal');
    if (modal) modal.remove();
}

function loadUsersList() {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';

    const today = DateTime.now().toISODate();
    const sortedCodes = Object.keys(usersData).sort((a, b) => usersData[b].createdAt.localeCompare(usersData[a].createdAt));

    sortedCodes.forEach(code => {
        const userData = usersData[code];
        const isActive = !!activeSessions[code];
        const isExpired = userData.expiry < today;
        const expiryDate = DateTime.fromISO(userData.expiry).toFormat('dd MMM yyyy');
        const daysLeft = Math.round(DateTime.fromISO(userData.expiry).diff(DateTime.now(), 'days').days);
        const profit = userData.tradingData?.totalProfit || 0;

        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.id = `user-${code}`;
        userItem.innerHTML = `
            <div class="user-info">
                <div class="user-info-row">
                    <span class="user-code">${code}</span>
                    <span class="user-status ${isActive ? 'status-active' : isExpired ? 'status-inactive' : 'status-inactive'}">
                        ${isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive'}
                    </span>
                </div>
                <div class="user-info-row">
                    <div class="user-expiry">
                        <i class="fas fa-calendar-alt"></i>
                        <span class="expiry-text">${expiryDate} (${daysLeft} days left)</span>
                    </div>
                </div>
                <div class="user-info-row">
                    <span class="user-balance">💰 Balance: $${userData.tradingData?.balance?.toFixed(2) || '10000.00'}</span>
                    <span class="user-trades">📊 Trades: ${userData.tradingData?.totalTrades || 0}</span>
                    <span class="user-profit ${profit >= 0 ? 'positive' : 'negative'}">📈 Profit: $${profit.toFixed(2)}</span>
                </div>
                <span class="user-device">${isActive ? '✅ Active on 1 device' : '❌ No active session'}</span>
            </div>
            <div class="user-actions">
                <button class="user-action-btn edit" onclick="editUserExpiry('${code}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="user-action-btn reset" onclick="resetUserBalance('${code}')">
                    <i class="fas fa-undo"></i> Reset
                </button>
                <button class="user-action-btn remove" onclick="removeUserByCode('${code}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        `;
        usersList.appendChild(userItem);
    });

    document.getElementById('totalUsers').textContent = sortedCodes.length;
}

function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,es,fr,de,it,pt,ru,ja,ko,zh-CN,ar,hi,bn,ta,te',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
    }, 'google_translate_element');
}

let audioAlertsEnabled = true;
let lastAlertTime = 0;
let lastConfidence = 0;

function playAlert80() {
    if (!audioAlertsEnabled) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;

    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 880;

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);

    setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();

        osc2.type = 'sine';
        osc2.frequency.value = 880;

        gain2.gain.setValueAtTime(0.3, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);

        osc2.start(now + 0.1);
        osc2.stop(now + 0.6);
    }, 100);

    document.body.classList.add('alert-active');
    setTimeout(() => document.body.classList.remove('alert-active'), 1000);

    showNotification('🔊 80%+ Confidence Alert!', 'warning');
}

function playAlert90() {
    if (!audioAlertsEnabled) return;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;

    for (let i = 0; i < 3; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 1046.5 + (i * 100);

        gain.gain.setValueAtTime(0.4, now + (i * 0.15));
        gain.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.15) + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + (i * 0.15));
        osc.stop(now + (i * 0.15) + 0.3);
    }

    document.body.classList.add('alert-active');
    setTimeout(() => document.body.classList.remove('alert-active'), 1500);

    showNotification('🔊🔊 90%+ Confidence Alert! Strong Signal!', 'success');
}

function testAlert(level) {
    if (level === 80) playAlert80();
    else if (level === 90) playAlert90();
}

function toggleAlerts() {
    audioAlertsEnabled = !audioAlertsEnabled;
    document.getElementById('alertToggle').classList.toggle('active', audioAlertsEnabled);
    showNotification(audioAlertsEnabled ? '🔔 Audio Alerts Enabled' : '🔕 Audio Alerts Disabled', 'info');
}

function checkConfidenceAlert(confidence) {
    if (!audioAlertsEnabled) return;

    const now = Date.now();
    if (now - lastAlertTime < 10000 && Math.abs(confidence - lastConfidence) < 5) return;

    if (confidence >= 90) {
        playAlert90();
        lastAlertTime = now;
        lastConfidence = confidence;
    } else if (confidence >= 80) {
        playAlert80();
        lastAlertTime = now;
        lastConfidence = confidence;
    }
}

function updateRecommendationBox(price, support, resistance) {
    const supportLow = support;
    const supportHigh = support * 1.005;
    const resistanceLow = resistance * 0.995;
    const resistanceHigh = resistance;

    document.getElementById('supportRange').textContent = `$${supportLow.toFixed(2)} - $${supportHigh.toFixed(2)}`;
    document.getElementById('resistanceRange').textContent = `$${resistanceLow.toFixed(2)} - $${resistanceHigh.toFixed(2)}`;

    const rsi = parseFloat(document.getElementById('rsiValue').textContent);
    const bullishPatterns = parseInt(document.getElementById('bullishCount').textContent);
    const bearishPatterns = parseInt(document.getElementById('bearishCount').textContent);

    const breakoutUpChance = Math.min(95, 50 + (rsi < 30 ? 25 : 0) + (bullishPatterns * 5));
    const breakoutDownChance = Math.min(95, 50 + (rsi > 70 ? 25 : 0) + (bearishPatterns * 5));

    document.getElementById('breakoutUp').innerHTML = `📈 Breakout Up: <span style="color:#22C55E;">${breakoutUpChance}% chance</span>`;
    document.getElementById('breakoutDown').innerHTML = `📉 Breakout Down: <span style="color:#EF4444;">${breakoutDownChance}% chance</span>`;

    const supportTargetLow = support * 1.01;
    const supportTargetHigh = support * 1.02;
    const resistanceTargetLow = resistance * 0.99;
    const resistanceTargetHigh = resistance * 0.98;

    document.getElementById('supportTarget').textContent = `$${supportTargetLow.toFixed(2)} - $${supportTargetHigh.toFixed(2)}`;
    document.getElementById('resistanceTarget').textContent = `$${resistanceTargetLow.toFixed(2)} - $${resistanceTargetHigh.toFixed(2)}`;

    document.getElementById('currentZonePrice').textContent = `$${price.toFixed(2)}`;

    if (price <= supportHigh) {
        document.getElementById('currentZone').textContent = 'SUPPORT';
        document.getElementById('currentZone').style.color = '#22C55E';
        document.getElementById('currentAction').className = 'action action-buy';
        document.getElementById('currentAction').textContent = 'CONSIDER BUY';
    } else if (price >= resistanceLow) {
        document.getElementById('currentZone').textContent = 'RESISTANCE';
        document.getElementById('currentZone').style.color = '#EF4444';
        document.getElementById('currentAction').className = 'action action-sell';
        document.getElementById('currentAction').textContent = 'CONSIDER SELL';
    } else {
        document.getElementById('currentZone').textContent = 'NEUTRAL';
        document.getElementById('currentZone').style.color = '#F59E0B';
        document.getElementById('currentAction').className = 'action action-wait';
        document.getElementById('currentAction').textContent = 'WAIT';
    }
}

const topCoins = [
    { symbol: 'BTC', name: 'Bitcoin', icon: '₿', color: '#F7931A' },
    { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', color: '#627EEA' },
    { symbol: 'BNB', name: 'Binance Coin', icon: 'BNB', color: '#F3BA2F' },
    { symbol: 'SOL', name: 'Solana', icon: 'SOL', color: '#9945FF' },
    { symbol: 'XRP', name: 'Ripple', icon: 'XRP', color: '#23292F' },
    { symbol: 'ADA', name: 'Cardano', icon: 'ADA', color: '#0033AD' },
    { symbol: 'AVAX', name: 'Avalanche', icon: 'AVAX', color: '#E84142' },
    { symbol: 'DOGE', name: 'Dogecoin', icon: 'Ð', color: '#C2A633' },
    { symbol: 'DOT', name: 'Polkadot', icon: 'DOT', color: '#E6007A' },
    { symbol: 'TRX', name: 'TRON', icon: 'TRX', color: '#EF0027' },
    { symbol: 'LINK', name: 'Chainlink', icon: 'LINK', color: '#2A5ADA' },
    { symbol: 'MATIC', name: 'Polygon', icon: 'MATIC', color: '#8247E5' },
    { symbol: 'ICP', name: 'Internet Computer', icon: 'ICP', color: '#29ABE2' },
    { symbol: 'SHIB', name: 'Shiba Inu', icon: 'SHIB', color: '#FFA409' },
    { symbol: 'LTC', name: 'Litecoin', icon: 'Ł', color: '#345D9D' },
    { symbol: 'UNI', name: 'Uniswap', icon: 'UNI', color: '#FF007A' },
    { symbol: 'ATOM', name: 'Cosmos', icon: 'ATOM', color: '#2E3148' },
    { symbol: 'ETC', name: 'Ethereum Classic', icon: 'ETC', color: '#33FF99' },
    { symbol: 'XLM', name: 'Stellar', icon: 'XLM', color: '#000000' },
    { symbol: 'BCH', name: 'Bitcoin Cash', icon: 'BCH', color: '#8DC351' },
    { symbol: 'FIL', name: 'Filecoin', icon: 'FIL', color: '#0090FF' },
    { symbol: 'APT', name: 'Aptos', icon: 'APT', color: '#00E3B6' },
    { symbol: 'NEAR', name: 'Near Protocol', icon: 'NEAR', color: '#000000' },
    { symbol: 'VET', name: 'VeChain', icon: 'VET', color: '#15BDFF' },
    { symbol: 'QNT', name: 'Quant', icon: 'QNT', color: '#000000' },
    { symbol: 'ALGO', name: 'Algorand', icon: 'ALGO', color: '#000000' },
    { symbol: 'GRT', name: 'The Graph', icon: 'GRT', color: '#6747E7' },
    { symbol: 'FTM', name: 'Fantom', icon: 'FTM', color: '#1969FF' },
    { symbol: 'SAND', name: 'The Sandbox', icon: 'SAND', color: '#04ADEF' },
    { symbol: 'MANA', name: 'Decentraland', icon: 'MANA', color: '#FF2D55' },
    { symbol: 'AXS', name: 'Axie Infinity', icon: 'AXS', color: '#0055D0' },
    { symbol: 'THETA', name: 'Theta Network', icon: 'THETA', color: '#2AB8E6' },
    { symbol: 'EOS', name: 'EOS', icon: 'EOS', color: '#000000' },
    { symbol: 'KSM', name: 'Kusama', icon: 'KSM', color: '#000000' },
    { symbol: 'ZEC', name: 'Zcash', icon: 'ZEC', color: '#F4B728' },
    { symbol: 'XMR', name: 'Monero', icon: 'XMR', color: '#F60' },
    { symbol: 'DASH', name: 'Dash', icon: 'DASH', color: '#1C75BC' },
    { symbol: 'NEO', name: 'Neo', icon: 'NEO', color: '#58BF00' },
    { symbol: 'IOTA', name: 'IOTA', icon: 'IOTA', color: '#242424' },
    { symbol: 'WAVES', name: 'Waves', icon: 'WAVES', color: '#0055FF' },
    { symbol: 'ONT', name: 'Ontology', icon: 'ONT', color: '#32A4BE' },
    { symbol: 'QTUM', name: 'Qtum', icon: 'QTUM', color: '#2E9AD0' },
    { symbol: 'ZIL', name: 'Zilliqa', icon: 'ZIL', color: '#49C1BF' },
    { symbol: 'BAT', name: 'Basic Attention', icon: 'BAT', color: '#FF5000' },
    { symbol: 'OMG', name: 'OMG Network', icon: 'OMG', color: '#1A53F0' },
    { symbol: 'LSK', name: 'Lisk', icon: 'LSK', color: '#0D4EA0' },
    { symbol: 'STEEM', name: 'Steem', icon: 'STEEM', color: '#4BA2F2' },
    { symbol: 'XVG', name: 'Verge', icon: 'XVG', color: '#00CBFF' },
    { symbol: 'STRAX', name: 'Stratis', icon: 'STRAX', color: '#1382C2' },
    { symbol: 'ARK', name: 'Ark', icon: 'ARK', color: '#F70000' },
    { symbol: 'DGB', name: 'DigiByte', icon: 'DGB', color: '#0066CC' },
    { symbol: 'RVN', name: 'Ravencoin', icon: 'RVN', color: '#384182' },
    { symbol: 'KDA', name: 'Kadena', icon: 'KDA', color: '#ED1C24' },
    { symbol: 'LRC', name: 'Loopring', icon: 'LRC', color: '#1C60FF' },
    { symbol: 'ENJ', name: 'Enjin Coin', icon: 'ENJ', color: '#786DBC' },
    { symbol: 'CHZ', name: 'Chiliz', icon: 'CHZ', color: '#A8E01C' },
    { symbol: 'HOT', name: 'Holo', icon: 'HOT', color: '#00A2B5' },
    { symbol: 'ONE', name: 'Harmony', icon: 'ONE', color: '#00AEE9' },
    { symbol: 'CELO', name: 'Celo', icon: 'CELO', color: '#35D07F' },
    { symbol: 'AR', name: 'Arweave', icon: 'AR', color: '#222222' },
    { symbol: 'ROSE', name: 'Oasis Network', icon: 'ROSE', color: '#1B1F2B' },
    { symbol: 'MINA', name: 'Mina Protocol', icon: 'MINA', color: '#000000' },
    { symbol: 'FLOW', name: 'Flow', icon: 'FLOW', color: '#00EF8B' },
    { symbol: 'EGLD', name: 'Elrond', icon: 'EGLD', color: '#23F7DD' },
    { symbol: 'KAVA', name: 'Kava', icon: 'KAVA', color: '#FF433E' },
    { symbol: 'XDC', name: 'XDC Network', icon: 'XDC', color: '#B7B7B7' },
    { symbol: 'IOST', name: 'IOST', icon: 'IOST', color: '#1C1C1C' },
    { symbol: 'WAXP', name: 'WAX', icon: 'WAXP', color: '#F89022' },
    { symbol: 'GLMR', name: 'Moonbeam', icon: 'GLMR', color: '#53CBC8' },
    { symbol: 'ASTR', name: 'Astar', icon: 'ASTR', color: '#316FF6' },
    { symbol: 'SCRT', name: 'Secret Network', icon: 'SCRT', color: '#1B1B1B' },
    { symbol: 'FET', name: 'Fetch.ai', icon: 'FET', color: '#1C1C1C' },
    { symbol: 'OCEAN', name: 'Ocean Protocol', icon: 'OCEAN', color: '#141414' },
    { symbol: 'BAND', name: 'Band Protocol', icon: 'BAND', color: '#516AFF' },
    { symbol: 'REN', name: 'Ren', icon: 'REN', color: '#1C1C1C' },
    { symbol: 'SKL', name: 'SKALE', icon: 'SKL', color: '#000000' },
    { symbol: 'NU', name: 'NuCypher', icon: 'NU', color: '#1C1C1C' },
    { symbol: 'KEEP', name: 'Keep Network', icon: 'KEEP', color: '#46A2D9' },
    { symbol: 'CRV', name: 'Curve DAO', icon: 'CRV', color: '#F5C542' },
    { symbol: 'BAL', name: 'Balancer', icon: 'BAL', color: '#1C1C1C' },
    { symbol: 'YFI', name: 'Yearn Finance', icon: 'YFI', color: '#006AE4' },
    { symbol: 'AAVE', name: 'Aave', icon: 'AAVE', color: '#B6509E' },
    { symbol: 'COMP', name: 'Compound', icon: 'COMP', color: '#00D395' },
    { symbol: 'MKR', name: 'Maker', icon: 'MKR', color: '#1AAB9B' },
    { symbol: 'SNX', name: 'Synthetix', icon: 'SNX', color: '#00D1FF' },
    { symbol: 'UMA', name: 'UMA', icon: 'UMA', color: '#FF4A4A' },
    { symbol: 'RLC', name: 'iExec RLC', icon: 'RLC', color: '#FFB800' },
    { symbol: 'NMR', name: 'Numeraire', icon: 'NMR', color: '#1C1C1C' },
    { symbol: 'MLN', name: 'Enzyme', icon: 'MLN', color: '#1C1C1C' },
    { symbol: 'BNT', name: 'Bancor', icon: 'BNT', color: '#000000' },
    { symbol: 'KNC', name: 'Kyber Network', icon: 'KNC', color: '#31CB9E' },
    { symbol: 'ZRX', name: '0x', icon: 'ZRX', color: '#000000' },
    { symbol: 'STORJ', name: 'Storj', icon: 'STORJ', color: '#2683FF' },
    { symbol: 'ANKR', name: 'Ankr', icon: 'ANKR', color: '#2E6BF6' },
    { symbol: 'COTI', name: 'COTI', icon: 'COTI', color: '#00B3B3' },
    { symbol: 'CTSI', name: 'Cartesi', icon: 'CTSI', color: '#5A5A5A' },
    { symbol: 'CHR', name: 'Chromia', icon: 'CHR', color: '#1C1C1C' },
    { symbol: 'CKB', name: 'Nervos Network', icon: 'CKB', color: '#1C1C1C' },
    { symbol: 'CVC', name: 'Civic', icon: 'CVC', color: '#3B5C9B' },
    { symbol: 'POWR', name: 'Powerledger', icon: 'POWR', color: '#05B3A3' },
    { symbol: 'POLY', name: 'Polymath', icon: 'POLY', color: '#1C1C1C' },
    { symbol: 'DENT', name: 'Dent', icon: 'DENT', color: '#1C1C1C' },
    { symbol: 'FUN', name: 'FunFair', icon: 'FUN', color: '#ED196B' },
    { symbol: 'GTO', name: 'Gifto', icon: 'GTO', color: '#1C1C1C' },
    { symbol: 'LOOM', name: 'Loom Network', icon: 'LOOM', color: '#1C1C1C' },
    { symbol: 'MTL', name: 'Metal', icon: 'MTL', color: '#1C1C1C' },
    { symbol: 'NKN', name: 'NKN', icon: 'NKN', color: '#1C1C1C' },
    { symbol: 'OXT', name: 'Orchid', icon: 'OXT', color: '#1C1C1C' },
    { symbol: 'PERL', name: 'Perlin', icon: 'PERL', color: '#1C1C1C' },
    { symbol: 'QKC', name: 'QuarkChain', icon: 'QKC', color: '#1C1C1C' },
    { symbol: 'RDN', name: 'Raiden Network', icon: 'RDN', color: '#1C1C1C' },
    { symbol: 'REP', name: 'Augur', icon: 'REP', color: '#1C1C1C' },
    { symbol: 'SFP', name: 'SafePal', icon: 'SFP', color: '#1C1C1C' },
    { symbol: 'SRM', name: 'Serum', icon: 'SRM', color: '#1C1C1C' },
    { symbol: 'STMX', name: 'StormX', icon: 'STMX', color: '#1C1C1C' },
    { symbol: 'SUSHI', name: 'SushiSwap', icon: 'SUSHI', color: '#FA52A0' },
    { symbol: 'TOMO', name: 'TomoChain', icon: 'TOMO', color: '#1C1C1C' },
    { symbol: 'TRB', name: 'Tellor', icon: 'TRB', color: '#1C1C1C' },
    { symbol: 'TWT', name: 'Trust Wallet', icon: 'TWT', color: '#1C1C1C' },
    { symbol: 'UTK', name: 'Utrust', icon: 'UTK', color: '#1C1C1C' },
    { symbol: 'VTHO', name: 'VeThor', icon: 'VTHO', color: '#1C1C1C' },
    { symbol: 'WAN', name: 'Wanchain', icon: 'WAN', color: '#1C1C1C' },
    { symbol: 'XEM', name: 'NEM', icon: 'XEM', color: '#67B2E8' },
    { symbol: 'XHV', name: 'Haven Protocol', icon: 'XHV', color: '#1C1C1C' },
    { symbol: 'XPRT', name: 'Persistence', icon: 'XPRT', color: '#1C1C1C' },
    { symbol: 'XTZ', name: 'Tezos', icon: 'XTZ', color: '#2C7DF7' },
    { symbol: 'ZEN', name: 'Horizen', icon: 'ZEN', color: '#1C1C1C' },
    { symbol: '1INCH', name: '1inch', icon: '1INCH', color: '#1C1C1C' },
    { symbol: 'ALICE', name: 'MyNeighborAlice', icon: 'ALICE', color: '#1C1C1C' },
    { symbol: 'AMP', name: 'Amp', icon: 'AMP', color: '#1C1C1C' },
    { symbol: 'ANT', name: 'Aragon', icon: 'ANT', color: '#1C1C1C' },
    { symbol: 'ARPA', name: 'ARPA Chain', icon: 'ARPA', color: '#1C1C1C' },
    { symbol: 'AUDIO', name: 'Audius', icon: 'AUDIO', color: '#1C1C1C' },
    { symbol: 'BICO', name: 'Biconomy', icon: 'BICO', color: '#1C1C1C' },
    { symbol: 'BLZ', name: 'Bluzelle', icon: 'BLZ', color: '#1C1C1C' },
    { symbol: 'C98', name: 'Coin98', icon: 'C98', color: '#1C1C1C' },
    { symbol: 'CELR', name: 'Celer Network', icon: 'CELR', color: '#1C1C1C' },
    { symbol: 'CFX', name: 'Conflux', icon: 'CFX', color: '#1C1C1C' },
    { symbol: 'COCOS', name: 'Cocos-BCX', icon: 'COCOS', color: '#1C1C1C' },
    { symbol: 'COMBO', name: 'Combo', icon: 'COMBO', color: '#1C1C1C' },
    { symbol: 'CREAM', name: 'Cream', icon: 'CREAM', color: '#1C1C1C' },
    { symbol: 'CTK', name: 'CertiK', icon: 'CTK', color: '#1C1C1C' },
    { symbol: 'DIA', name: 'DIA', icon: 'DIA', color: '#1C1C1C' },
    { symbol: 'DOCK', name: 'Dock', icon: 'DOCK', color: '#1C1C1C' },
    { symbol: 'DUSK', name: 'Dusk Network', icon: 'DUSK', color: '#1C1C1C' },
    { symbol: 'ELF', name: 'aelf', icon: 'ELF', color: '#1C1C1C' },
    { symbol: 'ERN', name: 'Ethernity', icon: 'ERN', color: '#1C1C1C' },
    { symbol: 'FIS', name: 'StaFi', icon: 'FIS', color: '#1C1C1C' },
    { symbol: 'FORTH', name: 'Ampleforth', icon: 'FORTH', color: '#1C1C1C' },
    { symbol: 'FRONT', name: 'Frontier', icon: 'FRONT', color: '#1C1C1C' },
    { symbol: 'FTT', name: 'FTX Token', icon: 'FTT', color: '#1C1C1C' },
    { symbol: 'GALA', name: 'Gala', icon: 'GALA', color: '#1C1C1C' },
    { symbol: 'GHST', name: 'Aavegotchi', icon: 'GHST', color: '#1C1C1C' },
    { symbol: 'GLM', name: 'Golem', icon: 'GLM', color: '#1C1C1C' },
    { symbol: 'GRS', name: 'Groestlcoin', icon: 'GRS', color: '#1C1C1C' },
    { symbol: 'GTC', name: 'Gitcoin', icon: 'GTC', color: '#1C1C1C' },
    { symbol: 'HARD', name: 'Kava Lend', icon: 'HARD', color: '#1C1C1C' },
    { symbol: 'HBAR', name: 'Hedera', icon: 'HBAR', color: '#1C1C1C' },
    { symbol: 'HIVE', name: 'Hive', icon: 'HIVE', color: '#1C1C1C' },
    { symbol: 'HNT', name: 'Helium', icon: 'HNT', color: '#474DFF' },
    { symbol: 'ICP', name: 'Internet Computer', icon: 'ICP', color: '#1C1C1C' },
    { symbol: 'ICX', name: 'ICON', icon: 'ICX', color: '#1C1C1C' },
    { symbol: 'IDEX', name: 'IDEX', icon: 'IDEX', color: '#1C1C1C' },
    { symbol: 'ILV', name: 'Illuvium', icon: 'ILV', color: '#1C1C1C' },
    { symbol: 'INJ', name: 'Injective', icon: 'INJ', color: '#1C1C1C' },
    { symbol: 'IOST', name: 'IOST', icon: 'IOST', color: '#1C1C1C' },
    { symbol: 'IOTX', name: 'IoTeX', icon: 'IOTX', color: '#1C1C1C' },
    { symbol: 'JASMY', name: 'Jasmy', icon: 'JASMY', color: '#1C1C1C' },
    { symbol: 'KAVA', name: 'Kava', icon: 'KAVA', color: '#1C1C1C' },
    { symbol: 'KLAY', name: 'Klaytn', icon: 'KLAY', color: '#1C1C1C' },
    { symbol: 'KSM', name: 'Kusama', icon: 'KSM', color: '#1C1C1C' },
    { symbol: 'LINA', name: 'Linear', icon: 'LINA', color: '#1C1C1C' },
    { symbol: 'LIT', name: 'Litentry', icon: 'LIT', color: '#1C1C1C' },
    { symbol: 'LPT', name: 'Livepeer', icon: 'LPT', color: '#1C1C1C' },
    { symbol: 'LRC', name: 'Loopring', icon: 'LRC', color: '#1C1C1C' },
    { symbol: 'MANA', name: 'Decentraland', icon: 'MANA', color: '#1C1C1C' },
    { symbol: 'MASK', name: 'Mask Network', icon: 'MASK', color: '#1C1C1C' },
    { symbol: 'MATIC', name: 'Polygon', icon: 'MATIC', color: '#1C1C1C' },
    { symbol: 'MDT', name: 'Measurable Data', icon: 'MDT', color: '#1C1C1C' },
    { symbol: 'MINA', name: 'Mina', icon: 'MINA', color: '#1C1C1C' },
    { symbol: 'MIR', name: 'Mirror Protocol', icon: 'MIR', color: '#1C1C1C' },
    { symbol: 'MKR', name: 'Maker', icon: 'MKR', color: '#1C1C1C' },
    { symbol: 'MLN', name: 'Enzyme', icon: 'MLN', color: '#1C1C1C' },
    { symbol: 'NANO', name: 'Nano', icon: 'NANO', color: '#1C1C1C' },
    { symbol: 'NEAR', name: 'Near', icon: 'NEAR', color: '#1C1C1C' },
    { symbol: 'NKN', name: 'NKN', icon: 'NKN', color: '#1C1C1C' },
    { symbol: 'NMR', name: 'Numeraire', icon: 'NMR', color: '#1C1C1C' },
    { symbol: 'OCEAN', name: 'Ocean Protocol', icon: 'OCEAN', color: '#1C1C1C' },
    { symbol: 'OGN', name: 'Origin Protocol', icon: 'OGN', color: '#1C1C1C' },
    { symbol: 'OMG', name: 'OMG Network', icon: 'OMG', color: '#1C1C1C' },
    { symbol: 'ONE', name: 'Harmony', icon: 'ONE', color: '#1C1C1C' },
    { symbol: 'ONG', name: 'Ontology Gas', icon: 'ONG', color: '#1C1C1C' },
    { symbol: 'ONT', name: 'Ontology', icon: 'ONT', color: '#1C1C1C' },
    { symbol: 'ORBS', name: 'Orbs', icon: 'ORBS', color: '#1C1C1C' },
    { symbol: 'OXT', name: 'Orchid', icon: 'OXT', color: '#1C1C1C' },
    { symbol: 'PERP', name: 'Perpetual', icon: 'PERP', color: '#1C1C1C' },
    { symbol: 'PHA', name: 'Phala', icon: 'PHA', color: '#1C1C1C' },
    { symbol: 'POLS', name: 'Polkastarter', icon: 'POLS', color: '#1C1C1C' },
    { symbol: 'POWR', name: 'Powerledger', icon: 'POWR', color: '#1C1C1C' },
    { symbol: 'PUNDIX', name: 'Pundi X', icon: 'PUNDIX', color: '#1C1C1C' },
    { symbol: 'QKC', name: 'QuarkChain', icon: 'QKC', color: '#1C1C1C' },
    { symbol: 'QLC', name: 'QLC Chain', icon: 'QLC', color: '#1C1C1C' },
    { symbol: 'QNT', name: 'Quant', icon: 'QNT', color: '#1C1C1C' },
    { symbol: 'QTUM', name: 'Qtum', icon: 'QTUM', color: '#1C1C1C' },
    { symbol: 'RARI', name: 'Rarible', icon: 'RARI', color: '#1C1C1C' },
    { symbol: 'REN', name: 'Ren', icon: 'REN', color: '#1C1C1C' },
    { symbol: 'REP', name: 'Augur', icon: 'REP', color: '#1C1C1C' },
    { symbol: 'REQ', name: 'Request', icon: 'REQ', color: '#1C1C1C' },
    { symbol: 'RLC', name: 'iExec', icon: 'RLC', color: '#1C1C1C' },
    { symbol: 'ROSE', name: 'Oasis', icon: 'ROSE', color: '#1C1C1C' },
    { symbol: 'RSR', name: 'Reserve Rights', icon: 'RSR', color: '#1C1C1C' },
    { symbol: 'SAND', name: 'The Sandbox', icon: 'SAND', color: '#1C1C1C' },
    { symbol: 'SC', name: 'Siacoin', icon: 'SC', color: '#1C1C1C' },
    { symbol: 'SCRT', name: 'Secret', icon: 'SCRT', color: '#1C1C1C' },
    { symbol: 'SKL', name: 'SKALE', icon: 'SKL', color: '#1C1C1C' },
    { symbol: 'SNX', name: 'Synthetix', icon: 'SNX', color: '#1C1C1C' },
    { symbol: 'SOL', name: 'Solana', icon: 'SOL', color: '#1C1C1C' },
    { symbol: 'SRM', name: 'Serum', icon: 'SRM', color: '#1C1C1C' },
    { symbol: 'STMX', name: 'StormX', icon: 'STMX', color: '#1C1C1C' },
    { symbol: 'STORJ', name: 'Storj', icon: 'STORJ', color: '#1C1C1C' },
    { symbol: 'STPT', name: 'Standard', icon: 'STPT', color: '#1C1C1C' },
    { symbol: 'STRAX', name: 'Stratis', icon: 'STRAX', color: '#1C1C1C' },
    { symbol: 'STX', name: 'Stacks', icon: 'STX', color: '#1C1C1C' },
    { symbol: 'SUN', name: 'Sun', icon: 'SUN', color: '#1C1C1C' },
    { symbol: 'SUSHI', name: 'SushiSwap', icon: 'SUSHI', color: '#1C1C1C' },
    { symbol: 'SWRV', name: 'Swerve', icon: 'SWRV', color: '#1C1C1C' },
    { symbol: 'SXP', name: 'Swipe', icon: 'SXP', color: '#1C1C1C' },
    { symbol: 'TFUEL', name: 'Theta Fuel', icon: 'TFUEL', color: '#1C1C1C' },
    { symbol: 'THETA', name: 'Theta', icon: 'THETA', color: '#1C1C1C' },
    { symbol: 'TOMO', name: 'TomoChain', icon: 'TOMO', color: '#1C1C1C' },
    { symbol: 'TRB', name: 'Tellor', icon: 'TRB', color: '#1C1C1C' },
    { symbol: 'TRIBE', name: 'Tribe', icon: 'TRIBE', color: '#1C1C1C' },
    { symbol: 'TRU', name: 'TrueFi', icon: 'TRU', color: '#1C1C1C' },
    { symbol: 'TRX', name: 'TRON', icon: 'TRX', color: '#1C1C1C' },
    { symbol: 'TVK', name: 'Terra Virtua', icon: 'TVK', color: '#1C1C1C' },
    { symbol: 'TWT', name: 'Trust Wallet', icon: 'TWT', color: '#1C1C1C' },
    { symbol: 'UMA', name: 'UMA', icon: 'UMA', color: '#1C1C1C' },
    { symbol: 'UNFI', name: 'Unifi', icon: 'UNFI', color: '#1C1C1C' },
    { symbol: 'UNI', name: 'Uniswap', icon: 'UNI', color: '#1C1C1C' },
    { symbol: 'UTK', name: 'Utrust', icon: 'UTK', color: '#1C1C1C' },
    { symbol: 'VET', name: 'VeChain', icon: 'VET', color: '#1C1C1C' },
    { symbol: 'VITE', name: 'Vite', icon: 'VITE', color: '#1C1C1C' },
    { symbol: 'VTHO', name: 'VeThor', icon: 'VTHO', color: '#1C1C1C' },
    { symbol: 'WAN', name: 'Wanchain', icon: 'WAN', color: '#1C1C1C' },
    { symbol: 'WAVES', name: 'Waves', icon: 'WAVES', color: '#1C1C1C' },
    { symbol: 'WAXP', name: 'WAX', icon: 'WAXP', color: '#F89022' },
    { symbol: 'WIN', name: 'WINk', icon: 'WIN', color: '#1C1C1C' },
    { symbol: 'WNXM', name: 'Wrapped NXM', icon: 'WNXM', color: '#1C1C1C' },
    { symbol: 'WOO', name: 'WOO Network', icon: 'WOO', color: '#1C1C1C' },
    { symbol: 'XEM', name: 'NEM', icon: 'XEM', color: '#1C1C1C' },
    { symbol: 'XLM', name: 'Stellar', icon: 'XLM', color: '#1C1C1C' },
    { symbol: 'XMR', name: 'Monero', icon: 'XMR', color: '#1C1C1C' },
    { symbol: 'XRP', name: 'XRP', icon: 'XRP', color: '#1C1C1C' },
    { symbol: 'XTZ', name: 'Tezos', icon: 'XTZ', color: '#1C1C1C' },
    { symbol: 'XVG', name: 'Verge', icon: 'XVG', color: '#1C1C1C' },
    { symbol: 'XVS', name: 'Venus', icon: 'XVS', color: '#1C1C1C' },
    { symbol: 'YFI', name: 'Yearn Finance', icon: 'YFI', color: '#1C1C1C' },
    { symbol: 'YFII', name: 'DFI.Money', icon: 'YFII', color: '#1C1C1C' },
    { symbol: 'ZEC', name: 'Zcash', icon: 'ZEC', color: '#1C1C1C' },
    { symbol: 'ZEN', name: 'Horizen', icon: 'ZEN', color: '#1C1C1C' },
    { symbol: 'ZIL', name: 'Zilliqa', icon: 'ZIL', color: '#1C1C1C' },
    { symbol: 'ZRX', name: '0x', icon: 'ZRX', color: '#1C1C1C' }
];

class SuperAI {
    constructor() {
        this.indicators = {};
        this.patterns = { bullish: [], bearish: [], neutral: [] };
        this.accuracy = 99.7;
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;

        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateMACD(prices) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);

        if (ema12.length === 0 || ema26.length === 0) {
            return { macd: 0, signal: 0, histogram: 0 };
        }

        const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
        const signalLine = this.calculateEMA([macdLine], 9)[0] || 0;
        const histogram = macdLine - signalLine;

        return { macd: macdLine, signal: signalLine, histogram };
    }

    calculateEMA(prices, period) {
        if (prices.length < period) return [];

        const k = 2 / (period + 1);
        const ema = [prices[0]];

        for (let i = 1; i < prices.length; i++) {
            ema.push(prices[i] * k + ema[i - 1] * (1 - k));
        }

        return ema;
    }

    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        if (prices.length < period) {
            return { upper: prices[prices.length-1], middle: prices[prices.length-1], lower: prices[prices.length-1] };
        }

        const recent = prices.slice(-period);
        const mean = recent.reduce((a, b) => a + b, 0) / period;
        const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const std = Math.sqrt(variance);

        return {
            upper: mean + (stdDev * std),
            middle: mean,
            lower: mean - (stdDev * std)
        };
    }

    calculateATR(candles, period = 14) {
        if (candles.length < period + 1) return 0;

        const tr = [];
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i-1].close;

            const tr1 = high - low;
            const tr2 = Math.abs(high - prevClose);
            const tr3 = Math.abs(low - prevClose);

            tr.push(Math.max(tr1, tr2, tr3));
        }

        const atr = tr.slice(-period).reduce((a, b) => a + b, 0) / period;
        return atr;
    }

    calculateFibonacci(high, low, current) {
        const diff = high - low;
        const levels = {
            '0.236': high - diff * 0.236,
            '0.382': high - diff * 0.382,
            '0.5': high - diff * 0.5,
            '0.618': high - diff * 0.618,
            '0.786': high - diff * 0.786
        };

        let signal = 'neutral';
        if (current <= levels['0.382']) signal = 'buy';
        else if (current >= levels['0.618']) signal = 'sell';

        return { levels, signal };
    }

    calculateStochRSI(prices, period = 14) {
        const rsi = this.calculateRSI(prices, period);
        const rsiValues = [rsi];

        for (let i = 1; i < 14; i++) {
            rsiValues.push(this.calculateRSI(prices.slice(0, -i), period));
        }

        const minRsi = Math.min(...rsiValues);
        const maxRsi = Math.max(...rsiValues);
        const stochRsi = maxRsi === minRsi ? 50 : ((rsi - minRsi) / (maxRsi - minRsi)) * 100;

        return stochRsi;
    }

    calculateOBV(candles) {
        let obv = 0;
        for (let i = 1; i < candles.length; i++) {
            if (candles[i].close > candles[i-1].close) {
                obv += candles[i].volume;
            } else if (candles[i].close < candles[i-1].close) {
                obv -= candles[i].volume;
            }
        }
        return obv;
    }

    calculateIchimoku(candles) {
        const high9 = Math.max(...candles.slice(-9).map(c => c.high));
        const low9 = Math.min(...candles.slice(-9).map(c => c.low));
        const tenkanSen = (high9 + low9) / 2;

        const high26 = Math.max(...candles.slice(-26).map(c => c.high));
        const low26 = Math.min(...candles.slice(-26).map(c => c.low));
        const kijunSen = (high26 + low26) / 2;

        const senkouSpanA = (tenkanSen + kijunSen) / 2;

        const high52 = Math.max(...candles.slice(-52).map(c => c.high));
        const low52 = Math.min(...candles.slice(-52).map(c => c.low));
        const senkouSpanB = (high52 + low52) / 2;

        const currentPrice = candles[candles.length - 1].close;

        let signal = 'neutral';
        if (currentPrice > senkouSpanA && currentPrice > senkouSpanB && tenkanSen > kijunSen) {
            signal = 'buy';
        } else if (currentPrice < senkouSpanA && currentPrice < senkouSpanB && tenkanSen < kijunSen) {
            signal = 'sell';
        }

        return {
            tenkanSen,
            kijunSen,
            senkouSpanA,
            senkouSpanB,
            signal
        };
    }

    detectPatterns(candles) {
        const patterns = { bullish: [], bearish: [], neutral: [] };

        if (candles.length < 5) return patterns;

        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        const prev2 = candles[candles.length - 3];

        const bodySize = Math.abs(last.close - last.open);
        const totalRange = last.high - last.low;
        const upperWick = last.high - Math.max(last.open, last.close);
        const lowerWick = Math.min(last.open, last.close) - last.low;
        const isBullish = last.close > last.open;
        const isBearish = last.close < last.open;

        if (totalRange === 0) return patterns;

        if (bodySize < totalRange * 0.1) {
            if (upperWick > bodySize * 2 && lowerWick > bodySize * 2) {
                patterns.neutral.push('Long-Legged Doji');
            } else if (upperWick < bodySize && lowerWick > bodySize * 2) {
                patterns.bullish.push('Dragonfly Doji');
            } else if (upperWick > bodySize * 2 && lowerWick < bodySize) {
                patterns.bearish.push('Gravestone Doji');
            } else {
                patterns.neutral.push('Doji');
            }
        }

        if (lowerWick > bodySize * 2 && upperWick < bodySize && isBullish) {
            patterns.bullish.push('Hammer');
        }

        if (lowerWick > bodySize * 2 && upperWick < bodySize && isBearish) {
            patterns.bearish.push('Hanging Man');
        }

        if (upperWick > bodySize * 2 && lowerWick < bodySize && isBearish) {
            patterns.bearish.push('Shooting Star');
        }

        if (upperWick > bodySize * 2 && lowerWick < bodySize && isBullish) {
            patterns.bullish.push('Inverted Hammer');
        }

        if (prev) {
            const prevIsBearish = prev.close < prev.open;
            const prevIsBullish = prev.close > prev.open;

            if (prevIsBearish && isBullish && last.close > prev.open && last.open < prev.close) {
                patterns.bullish.push('Bullish Engulfing');
            }

            if (prevIsBullish && isBearish && last.close < prev.open && last.open > prev.close) {
                patterns.bearish.push('Bearish Engulfing');
            }
        }

        if (prev2 && prev && last) {
            const c1Bearish = prev2.close < prev2.open;
            const c1Bullish = prev2.close > prev2.open;

            if (c1Bearish && Math.abs(prev.close - prev.open) < Math.abs(prev2.close - prev2.open) * 0.3 && 
                last.close > last.open && last.close > prev2.open) {
                patterns.bullish.push('Morning Star');
            }

            if (c1Bullish && Math.abs(prev.close - prev.open) < Math.abs(prev2.close - prev2.open) * 0.3 && 
                last.close < last.open && last.close < prev2.open) {
                patterns.bearish.push('Evening Star');
            }

            if (prev2.close > prev2.open && prev.close > prev.open && last.close > last.open &&
                prev.close > prev2.close && last.close > prev.close) {
                patterns.bullish.push('Three White Soldiers');
            }

            if (prev2.close < prev2.open && prev.close < prev.open && last.close < last.open &&
                prev.close < prev2.close && last.close < prev.close) {
                patterns.bearish.push('Three Black Crows');
            }
        }

        return patterns;
    }

    generateAISignal(candles) {
        if (!candles || candles.length < 20) {
            return {
                type: 'neutral',
                confidence: 50,
                buyScore: 0,
                sellScore: 0,
                signals: [],
                patterns: { bullish: [], bearish: [], neutral: [] },
                indicators: this.indicators
            };
        }

        const prices = candles.map(c => c.close);
        const currentPrice = prices[prices.length - 1];
        const high = Math.max(...candles.slice(-20).map(c => c.high));
        const low = Math.min(...candles.slice(-20).map(c => c.low));

        const rsi = this.calculateRSI(prices);
        const macd = this.calculateMACD(prices);
        const bb = this.calculateBollingerBands(prices);
        const atr = this.calculateATR(candles);
        const fib = this.calculateFibonacci(high, low, currentPrice);
        const stochRsi = this.calculateStochRSI(prices);
        const obv = this.calculateOBV(candles);
        const ichimoku = this.calculateIchimoku(candles);
        const patterns = this.detectPatterns(candles);

        this.indicators = { rsi, macd, bb, atr, fib, stochRsi, obv, ichimoku, currentPrice, high, low };
        this.patterns = patterns;

        let buyScore = 0, sellScore = 0;
        const signals = [];

        if (rsi < 30) { buyScore += 15; signals.push({ type: 'buy', indicator: 'RSI', strength: 15, message: 'RSI Oversold' }); }
        else if (rsi > 70) { sellScore += 15; signals.push({ type: 'sell', indicator: 'RSI', strength: 15, message: 'RSI Overbought' }); }
        else if (rsi > 55) { buyScore += 7; signals.push({ type: 'buy', indicator: 'RSI', strength: 7, message: 'RSI Bullish' }); }
        else if (rsi < 45) { sellScore += 7; signals.push({ type: 'sell', indicator: 'RSI', strength: 7, message: 'RSI Bearish' }); }

        if (macd.histogram > 0) {
            if (macd.histogram > macd.signal) { buyScore += 15; signals.push({ type: 'buy', indicator: 'MACD', strength: 15, message: 'MACD Bullish Cross' }); }
            else { buyScore += 8; signals.push({ type: 'buy', indicator: 'MACD', strength: 8, message: 'MACD Bullish' }); }
        } else {
            if (Math.abs(macd.histogram) > Math.abs(macd.signal)) { sellScore += 15; signals.push({ type: 'sell', indicator: 'MACD', strength: 15, message: 'MACD Bearish Cross' }); }
            else { sellScore += 8; signals.push({ type: 'sell', indicator: 'MACD', strength: 8, message: 'MACD Bearish' }); }
        }

        if (currentPrice <= bb.lower) { buyScore += 10; signals.push({ type: 'buy', indicator: 'Bollinger', strength: 10, message: 'Price at Lower Band' }); }
        else if (currentPrice >= bb.upper) { sellScore += 10; signals.push({ type: 'sell', indicator: 'Bollinger', strength: 10, message: 'Price at Upper Band' }); }

        if (fib.signal === 'buy') { buyScore += 10; signals.push({ type: 'buy', indicator: 'Fibonacci', strength: 10, message: 'Fibonacci Support' }); }
        else if (fib.signal === 'sell') { sellScore += 10; signals.push({ type: 'sell', indicator: 'Fibonacci', strength: 10, message: 'Fibonacci Resistance' }); }

        if (stochRsi < 20) { buyScore += 10; signals.push({ type: 'buy', indicator: 'StochRSI', strength: 10, message: 'StochRSI Oversold' }); }
        else if (stochRsi > 80) { sellScore += 10; signals.push({ type: 'sell', indicator: 'StochRSI', strength: 10, message: 'StochRSI Overbought' }); }
        else if (stochRsi > 60) { buyScore += 5; signals.push({ type: 'buy', indicator: 'StochRSI', strength: 5, message: 'StochRSI Bullish' }); }
        else if (stochRsi < 40) { sellScore += 5; signals.push({ type: 'sell', indicator: 'StochRSI', strength: 5, message: 'StochRSI Bearish' }); }

        if (obv > 0) { buyScore += 5; signals.push({ type: 'buy', indicator: 'OBV', strength: 5, message: 'OBV Rising' }); }
        else { sellScore += 5; signals.push({ type: 'sell', indicator: 'OBV', strength: 5, message: 'OBV Falling' }); }

        if (ichimoku.signal === 'buy') { buyScore += 10; signals.push({ type: 'buy', indicator: 'Ichimoku', strength: 10, message: 'Ichimoku Bullish' }); }
        else if (ichimoku.signal === 'sell') { sellScore += 10; signals.push({ type: 'sell', indicator: 'Ichimoku', strength: 10, message: 'Ichimoku Bearish' }); }

        const bullishCount = patterns.bullish.length;
        const bearishCount = patterns.bearish.length;

        if (bullishCount > 0) {
            const patternStrength = Math.min(bullishCount * 5, 20);
            buyScore += patternStrength;
            signals.push({ type: 'buy', indicator: 'Patterns', strength: patternStrength, message: `${bullishCount} Bullish Patterns` });
        }

        if (bearishCount > 0) {
            const patternStrength = Math.min(bearishCount * 5, 20);
            sellScore += patternStrength;
            signals.push({ type: 'sell', indicator: 'Patterns', strength: patternStrength, message: `${bearishCount} Bearish Patterns` });
        }

        const totalScore = buyScore + sellScore;
        let finalType = 'neutral';
        let confidence = 50;

        if (buyScore > sellScore) {
            finalType = 'buy';
            confidence = Math.min(99.7, 50 + ((buyScore - sellScore) / (totalScore || 1)) * 50);
        } else if (sellScore > buyScore) {
            finalType = 'sell';
            confidence = Math.min(99.7, 50 + ((sellScore - buyScore) / (totalScore || 1)) * 50);
        }

        return {
            type: finalType,
            confidence: Math.min(confidence, 99.7),
            buyScore,
            sellScore,
            signals: signals.slice(0, 8),
            patterns,
            indicators: this.indicators
        };
    }

    calculateTPLevels(price, type) {
        const tpLevels = [];
        const multipliers = [1.005, 1.01, 1.015, 1.02];
        const slMultiplier = type === 'buy' ? 0.995 : 1.005;

        for (let i = 0; i < 4; i++) {
            if (type === 'buy') {
                tpLevels.push(price * multipliers[i]);
            } else {
                tpLevels.push(price * (2 - multipliers[i]));
            }
        }

        const stopLoss = type === 'buy' ? price * slMultiplier : price * slMultiplier;

        return { tpLevels, stopLoss };
    }
}

const superAI = new SuperAI();
let chart = null;
let candleSeries = null;
let currentData = [];
let currentPrice = 66793.00;
let currentLeverage = 5;
let currentSymbol = 'BTCUSDT';
let currentCoin = topCoins[0];

function loadCoins() {
    const coinList = document.getElementById('coinList');
    coinList.innerHTML = '';

    topCoins.forEach(coin => {
        const coinDiv = document.createElement('div');
        coinDiv.className = `coin-item ${coin.symbol === currentCoin.symbol ? 'active' : ''}`;
        coinDiv.onclick = () => selectCoin(coin);
        coinDiv.innerHTML = `
            <div class="coin-icon" style="background: ${coin.color || '#3B82F6'}">${coin.icon}</div>
            <div class="coin-info">
                <div class="coin-symbol">${coin.symbol}</div>
                <div class="coin-name">${coin.name}</div>
            </div>
        `;
        coinList.appendChild(coinDiv);
    });

    document.getElementById('coinCount').textContent = topCoins.length + '+ Coins Loaded';
    updateSelectedCoin(currentCoin);
}

function toggleCoinDropdown() {
    document.getElementById('coinDropdown').classList.toggle('show');
}

function selectCoin(coin) {
    currentCoin = coin;
    currentSymbol = coin.symbol + 'USDT';
    document.getElementById('currentCoin').textContent = coin.symbol + '/USDT';

    updateSelectedCoin(coin);

    document.querySelectorAll('.coin-item').forEach(item => {
        item.classList.remove('active');
        if (item.querySelector('.coin-symbol').textContent === coin.symbol) {
            item.classList.add('active');
        }
    });

    document.getElementById('coinDropdown').classList.remove('show');
    fetchData();
    showNotification(`Switched to ${coin.symbol}/USDT`, 'success');
}

function updateSelectedCoin(coin) {
    document.getElementById('selectedCoinIcon').style.background = coin.color || '#3B82F6';
    document.getElementById('selectedCoinIcon').textContent = coin.icon;
    document.getElementById('selectedCoinSymbol').textContent = coin.symbol;
    document.getElementById('selectedCoinName').textContent = coin.name;
}

function filterCoins() {
    const search = document.getElementById('coinSearch').value.toUpperCase();
    const coins = document.querySelectorAll('.coin-item');
    let visibleCount = 0;

    coins.forEach(coin => {
        const symbol = coin.querySelector('.coin-symbol').textContent;
        const name = coin.querySelector('.coin-name').textContent.toUpperCase();

        if (symbol.includes(search) || name.includes(search)) {
            coin.style.display = 'flex';
            visibleCount++;
        } else {
            coin.style.display = 'none';
        }
    });

    document.getElementById('coinCount').textContent = visibleCount + ' Coins Found';
}

document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('coinDropdown');
    const selector = document.querySelector('.selected-coin');

    if (!selector.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

function updateGuideValues(signal) {
    document.getElementById('guideAiSignal').textContent = signal.type.toUpperCase();
    document.getElementById('guideAiSignal').style.color = signal.type === 'buy' ? '#22C55E' : signal.type === 'sell' ? '#EF4444' : '#F59E0B';

    document.getElementById('guideConfidence').textContent = signal.confidence.toFixed(1) + '%';

    const patterns = `${signal.patterns.bullish.length}B/${signal.patterns.bearish.length}S`;
    document.getElementById('guidePatterns').textContent = patterns;

    document.getElementById('guideMacd').textContent = signal.indicators.macd ? signal.indicators.macd.histogram.toFixed(2) : '0';
    document.getElementById('guideRsi').textContent = signal.indicators.rsi ? signal.indicators.rsi.toFixed(2) : '50';

    const volumeInB = (signal.indicators.obv / 1e9).toFixed(2);
    document.getElementById('guideVolume').textContent = volumeInB + 'B';

    document.getElementById('guideSupport').textContent = signal.indicators.low ? '$' + signal.indicators.low.toFixed(2) : '$66,763';
    document.getElementById('guideResistance').textContent = signal.indicators.high ? '$' + signal.indicators.high.toFixed(2) : '$67,180';
    document.getElementById('guideAtr').textContent = signal.indicators.atr ? signal.indicators.atr.toFixed(2) : '198.07';

    updateRecommendationBox(
        signal.indicators.currentPrice, 
        signal.indicators.low || 66763.82, 
        signal.indicators.high || 67179.98
    );
}

function initChart() {
    const container = document.getElementById('tradingview_chart');

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            backgroundColor: '#03050A',
            textColor: '#E5E7EB',
        },
        grid: {
            vertLines: { color: '#1A1F33' },
            horzLines: { color: '#1A1F33' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: '#2A3045',
            textColor: '#94A3B8',
        },
        timeScale: {
            borderColor: '#2A3045',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    candleSeries = chart.addCandlestickSeries({
        upColor: '#22C55E',
        downColor: '#EF4444',
        borderDownColor: '#EF4444',
        borderUpColor: '#22C55E',
        wickDownColor: '#EF4444',
        wickUpColor: '#22C55E',
    });

    window.addEventListener('resize', () => {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });

    fetchData();
    setInterval(fetchData, 5000);
}

async function fetchData() {
    try {
        const activeBtn = document.querySelector('.timeframe-btn.active');
        const interval = activeBtn ? activeBtn.dataset.timeframe : '5';

        const binanceInterval = {
            '1': '1m', '5': '5m', '15': '15m',
            '60': '1h', '240': '4h', '1D': '1d'
        }[interval];

        const response = await axios.get(`https://api.binance.com/api/v3/klines`, {
            params: { symbol: currentSymbol, interval: binanceInterval, limit: 200 }
        });

        if (response.data) {
            currentData = response.data.map(k => ({
                time: Math.floor(k[0] / 1000),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));

            updateChart();
            runAIAnalysis();
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error fetching data for ' + currentSymbol, 'error');
    }
}

function updateChart() {
    if (!candleSeries) return;

    const candleData = currentData.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close
    }));

    candleSeries.setData(candleData);
    currentPrice = currentData[currentData.length - 1].close;
}

function runAIAnalysis() {
    const signal = superAI.generateAISignal(currentData);

    checkConfidenceAlert(signal.confidence);

    updateTicker(currentPrice, signal);
    updateAnalytics(signal);
    updateSignals(signal);
    updateGuideValues(signal);
    loadUserTradingData();

    document.getElementById('lastUpdate').textContent = DateTime.now().toFormat('HH:mm:ss');
}

function updateTicker(price, signal) {
    const change = currentData.length > 0 ? ((price - currentData[0]?.close) / currentData[0]?.close * 100) || 0 : 0;
    const high24h = currentData.length > 0 ? Math.max(...currentData.slice(-96).map(d => d.high)) : price;
    const low24h = currentData.length > 0 ? Math.min(...currentData.slice(-96).map(d => d.low)) : price;
    const volume24h = currentData.length > 0 ? currentData.slice(-24).reduce((s,d) => s + d.volume, 0) * price / 1e9 : 0;

    document.getElementById('primeTicker').innerHTML = `
        <div class="ticker-card">
            <div class="ticker-label">${currentSymbol.replace('USDT', '')}/USDT</div>
            <div class="ticker-value">$${price.toFixed(2)}</div>
            <div class="${change >= 0 ? 'positive' : 'negative'}">${change > 0 ? '+' : ''}${change.toFixed(2)}%</div>
        </div>
        <div class="ticker-card">
            <div class="ticker-label">24H HIGH</div>
            <div class="ticker-value">$${high24h.toFixed(2)}</div>
            <div class="prime-indicator">Resistance</div>
        </div>
        <div class="ticker-card">
            <div class="ticker-label">24H LOW</div>
            <div class="ticker-value">$${low24h.toFixed(2)}</div>
            <div class="prime-indicator">Support</div>
        </div>
        <div class="ticker-card">
            <div class="ticker-label">VOLUME</div>
            <div class="ticker-value">$${volume24h.toFixed(2)}B</div>
            <div class="prime-indicator">24h</div>
        </div>
        <div class="ticker-card">
            <div class="ticker-label">AI SIGNAL</div>
            <div class="ticker-value" style="color:${signal.type === 'buy' ? '#22C55E' : signal.type === 'sell' ? '#EF4444' : '#F59E0B'}">${signal.type.toUpperCase()}</div>
            <div class="prime-indicator">${signal.confidence.toFixed(1)}% Acc</div>
        </div>
        <div class="ticker-card">
            <div class="ticker-label">PATTERNS</div>
            <div class="ticker-value">${signal.patterns.bullish.length}B/${signal.patterns.bearish.length}S</div>
            <div class="prime-indicator">Active</div>
        </div>
        <div class="ticker-card">
            <div class="ticker-label">RSI</div>
            <div class="ticker-value">${signal.indicators.rsi ? signal.indicators.rsi.toFixed(2) : '50'}</div>
            <div class="prime-indicator">${signal.indicators.rsi > 70 ? 'Overbought' : signal.indicators.rsi < 30 ? 'Oversold' : 'Neutral'}</div>
        </div>
        <div class="ticker-card">
            <div class="ticker-label">ATR</div>
            <div class="ticker-value">$${signal.indicators.atr ? signal.indicators.atr.toFixed(2) : '0'}</div>
            <div class="prime-indicator">Volatility</div>
        </div>
    `;

    document.getElementById('aiSignal').textContent = signal.type.toUpperCase();
    document.getElementById('aiSignal').style.color = signal.type === 'buy' ? '#22C55E' : signal.type === 'sell' ? '#EF4444' : '#F59E0B';
    document.getElementById('aiConfidence').textContent = signal.confidence.toFixed(1) + '%';
    document.getElementById('aiPatterns').textContent = signal.patterns.bullish.length + signal.patterns.bearish.length;

    document.getElementById('rsiPill').textContent = `RSI: ${signal.indicators.rsi > 70 ? 'Overbought' : signal.indicators.rsi < 30 ? 'Oversold' : 'Neutral'}`;
    document.getElementById('rsiPill').className = `pill ${signal.indicators.rsi > 70 ? 'sell' : signal.indicators.rsi < 30 ? 'buy' : 'neutral'}`;

    document.getElementById('macdPill').textContent = `MACD: ${signal.indicators.macd && signal.indicators.macd.histogram > 0 ? 'Buy' : 'Sell'}`;
    document.getElementById('macdPill').className = `pill ${signal.indicators.macd && signal.indicators.macd.histogram > 0 ? 'buy' : 'sell'}`;

    document.getElementById('patternPill').textContent = `Patterns: ${signal.patterns.bullish.length}B/${signal.patterns.bearish.length}S`;

    document.getElementById('supportLevel').textContent = signal.indicators.low ? '$' + signal.indicators.low.toFixed(2) : '$66,763';
    document.getElementById('resistanceLevel').textContent = signal.indicators.high ? '$' + signal.indicators.high.toFixed(2) : '$67,180';
    document.getElementById('currentPriceLarge').textContent = '$' + price.toFixed(2);

    document.getElementById('aiTrend').innerHTML = signal.type === 'buy' ? 
        '<span style="color:#22C55E">BULLISH 📈</span>' : 
        signal.type === 'sell' ? '<span style="color:#EF4444">BEARISH 📉</span>' : 
        '<span style="color:#F59E0B">NEUTRAL ↔️</span>';

    document.getElementById('fibLevels').textContent = '0.382/0.618';
    document.getElementById('ichimoku').innerHTML = signal.indicators.ichimoku && signal.indicators.ichimoku.signal === 'buy' ? 
        '<span style="color:#22C55E">Bullish</span>' : 
        signal.indicators.ichimoku && signal.indicators.ichimoku.signal === 'sell' ? '<span style="color:#EF4444">Bearish</span>' : 
        '<span style="color:#F59E0B">Neutral</span>';
}

function updateAnalytics(signal) {
    const buyPressure = signal.type === 'buy' ? 65 + signal.confidence/10 : 35;
    const sellPressure = 100 - buyPressure;

    document.getElementById('buyPressure').textContent = buyPressure.toFixed(1) + '%';
    document.getElementById('sellPressure').textContent = sellPressure.toFixed(1) + '%';
    document.getElementById('buyPressureBar').style.width = buyPressure + '%';
    document.getElementById('sellPressureBar').style.width = sellPressure + '%';

    document.getElementById('rsiValue').textContent = signal.indicators.rsi ? signal.indicators.rsi.toFixed(2) : '50';
    document.getElementById('macdValue').textContent = signal.indicators.macd ? signal.indicators.macd.histogram.toFixed(2) : '0';

    const volumeInB = (signal.indicators.obv / 1e9).toFixed(2);
    document.getElementById('volumeValue').textContent = volumeInB + 'B';

    document.getElementById('atrValue').textContent = signal.indicators.atr ? signal.indicators.atr.toFixed(2) : '0';
    document.getElementById('obvValue').textContent = signal.indicators.obv ? (signal.indicators.obv / 1e6).toFixed(2) + 'M' : '0M';
    document.getElementById('stochRsiValue').textContent = signal.indicators.stochRsi ? signal.indicators.stochRsi.toFixed(1) : '50';

    document.getElementById('bullishCount').textContent = signal.patterns.bullish.length;
    document.getElementById('bearishCount').textContent = signal.patterns.bearish.length;

    const analyticsSignal = document.getElementById('analyticsSignal');
    if (signal.type === 'buy') {
        analyticsSignal.textContent = 'STRONG BUY';
        analyticsSignal.className = 'signal-badge buy';
    } else if (signal.type === 'sell') {
        analyticsSignal.textContent = 'STRONG SELL';
        analyticsSignal.className = 'signal-badge sell';
    } else {
        analyticsSignal.textContent = 'NEUTRAL';
        analyticsSignal.className = 'signal-badge neutral';
    }
}

function updateSignals(signal) {
    const signalsList = document.getElementById('signalList');
    signalsList.innerHTML = '';

    if (signal.signals.length === 0) {
        signalsList.innerHTML = '<div style="text-align:center; color:#94A3B8; padding:20px;">No active signals</div>';
        document.getElementById('signalCount').textContent = '0';
        return;
    }

    signal.signals.forEach(s => {
        const { tpLevels, stopLoss } = superAI.calculateTPLevels(currentPrice, s.type);

        signalsList.innerHTML += `
            <div class="signal-item">
                <div class="signal-icon ${s.type}">${s.type === 'buy' ? '🟢' : '🔴'}</div>
                <div class="signal-content">
                    <div class="signal-title ${s.type}">${s.message}</div>
                    <div class="signal-desc">
                        <span class="signal-indicator">${s.indicator}</span>
                        <span class="signal-strength">• Strength ${s.strength}</span>
                        <span class="entry-price ${s.type === 'sell' ? 'sell' : ''}">• Entry: $${currentPrice.toFixed(2)}</span>
                    </div>
                    <div class="tp-container">
                        <div class="tp-item"><span class="tp-label">TP1:</span><span class="tp-value ${s.type === 'sell' ? 'sell' : ''}">$${tpLevels[0].toFixed(2)}</span></div>
                        <div class="tp-item"><span class="tp-label">TP2:</span><span class="tp-value ${s.type === 'sell' ? 'sell' : ''}">$${tpLevels[1].toFixed(2)}</span></div>
                        <div class="tp-item"><span class="tp-label">TP3:</span><span class="tp-value ${s.type === 'sell' ? 'sell' : ''}">$${tpLevels[2].toFixed(2)}</span></div>
                        <div class="tp-item"><span class="tp-label">TP4:</span><span class="tp-value ${s.type === 'sell' ? 'sell' : ''}">$${tpLevels[3].toFixed(2)}</span></div>
                    </div>
                    <div class="sl-container">
                        <span class="sl-label">🛑 Stop Loss:</span>
                        <span class="sl-value">$${stopLoss.toFixed(2)}</span>
                    </div>
                    <div class="signal-time">${DateTime.now().toFormat('HH:mm:ss')}</div>
                </div>
            </div>
        `;
    });

    document.getElementById('signalCount').textContent = signal.signals.length;
}

function setLeverage(value) {
    currentLeverage = value;
    document.getElementById('leverageValue').textContent = value + 'X';

    document.querySelectorAll('.margin-level').forEach(el => {
        el.classList.remove('active');
        if (el.textContent === value + 'X') {
            el.classList.add('active');
        }
    });

    updateMarginInfo();
}

function updateMarginInfo() {
    const amount = parseFloat(document.getElementById('tradeAmount').value) || 100;
    const positionSize = amount * currentLeverage;

    document.getElementById('positionSize').textContent = '$' + positionSize.toFixed(2);
    document.getElementById('marginRequired').textContent = '$' + amount.toFixed(2);
}

function executeTrade(type) {
    if (!currentUser || !usersData[currentUser]) {
        showNotification('Please login first!', 'error');
        return;
    }

    const amount = parseFloat(document.getElementById('tradeAmount').value) || 100;
    const userData = usersData[currentUser].tradingData;

    if (amount > userData.balance) {
        showNotification('Insufficient balance!', 'error');
        return;
    }

    const position = {
        id: Date.now(),
        symbol: currentSymbol,
        type: type,
        amount: amount,
        leverage: currentLeverage,
        positionSize: amount * currentLeverage,
        entryPrice: currentPrice,
        timestamp: DateTime.now().toFormat('HH:mm:ss')
    };

    userData.positions.push(position);
    userData.balance -= amount;

    saveUserTradingData();
    loadUserTradingData();

    showNotification(`${type.toUpperCase()} Entry: $${amount} @ $${currentPrice.toFixed(2)}`, 'success');
}

function closePosition(id) {
    if (!currentUser || !usersData[currentUser]) return;

    const userData = usersData[currentUser].tradingData;
    const position = userData.positions.find(p => p.id === id);

    if (!position) return;

    const priceDiff = position.type === 'buy' 
        ? (currentPrice - position.entryPrice)
        : (position.entryPrice - currentPrice);

    const pnl = (priceDiff / position.entryPrice) * position.positionSize;

    userData.balance += position.amount + pnl;
    userData.totalTrades++;
    if (pnl > 0) userData.winTrades++;
    userData.totalProfit += pnl;

    userData.positions = userData.positions.filter(p => p.id !== id);

    saveUserTradingData();
    loadUserTradingData();

    showNotification(`Closed: $${pnl.toFixed(2)} P&L`, pnl >= 0 ? 'success' : 'error');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function toggleMenu() {
    document.getElementById('navMenu').classList.toggle('mobile-active');
}

document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        fetchData();
    });
});

document.getElementById('leverageSlider').addEventListener('input', function(e) {
    setLeverage(parseInt(e.target.value));
});

document.getElementById('tradeAmount').addEventListener('input', updateMarginInfo);

window.onload = function() {
    if (Object.keys(usersData).length === 0) {
        const today = DateTime.now().toISODate();
        const exp30 = DateTime.now().plus({ days: 30 }).toISODate();

        usersData['438213'] = {
            expiry: exp30,
            createdAt: today,
            days: 30,
            tradingData: { balance: 10000, totalTrades: 0, winTrades: 0, totalProfit: 0, positions: [] }
        };

        usersData['253346'] = {
            expiry: exp30,
            createdAt: today,
            days: 30,
            tradingData: { balance: 10000, totalTrades: 0, winTrades: 0, totalProfit: 0, positions: [] }
        };

        localStorage.setItem('usersData', JSON.stringify(usersData));
    }

    if (!checkAdminAccess() && !checkUserSession()) {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('mainWebsite').style.display = 'none';
    }

    loadCoins();
    initChart();
    updateMarginInfo();
    document.getElementById('alertToggle').classList.add('active');
};
