const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ============================================
// KONFIGURACJA
// ============================================
const ALLOWED_GROUPS = [
    '120363404482024925@g.us',    // Wpisz ID swoich grup
    '120363406442350203@g.us'     // Druga grupa
];

const CONFIG = {
    prefix: '!',
    adminNumber: '48693205391@c.us',
    autoDeleteSeconds: 30,
    silentCommands: ['calc', 'notatka'],
    welcomeMessage: `🎉 *Witaj w grupie!* 🎉

Cześć! Jesteś nowy/nowa? Oto zasady:

📋 *ZASADY:*
• Bądź miły dla innych
• Nie spamuj
• Używaj komend z prefiksem !

💡 *KOMENDY:*
• !pomoc - wszystkie komendy
• !id - pokaż ID czatu
• !ankieta [pytanie] | [opcja1] | [opcja2]
• !losuj [opcja1] [opcja2] ...
• !kto - losowa osoba z grupy
• !meme - losowy mem
• !herbata - kto robi herbatę?
• !rzut - rzut monetą
• !pogoda [miasto]
• !ranking - statystyki
• !wyzwanie - losowe wyzwanie
• !8ball [pytanie]
• !zart - losowy żart
• !fakt - ciekawy fakt
• !czas - która godzina
• !liczba [min]-[max] - losowa liczba
• !wybierz [opcje] - wybór z listy
• !druzyna - losuj drużyny
• !kostka - rzut kostką (1-6)
• !kostka-rpg - rzut kostką RPG (1-20)
• !odwroc [tekst] - tekst wspak
• !duplikuj [tekst] - podwójny tekst
• !spoiluj [tekst] - spoiler
• !tlumacz [tekst] - "tłumaczenie"
• !skrot [tekst] - skrót do pierwszych liter
• !haslo - wygeneruj hasło
• !rps [kamien/papier/nozyce] - papier kamień nożyce
• !flip - rzut monetą
• !dobranoc - życzenia na noc
• !calc [działanie] - kalkulator (cicho)
• !notatka [tekst] - zapisz notatkę (cicho)

*Ciche komendy odpowiadają na DM*
Miłej zabawy! 🚀`
};

const polls = new Map();
const userStats = new Map();
const userNames = new Map();

const client = new Client({
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
    console.log('📱 Zeskanuj QR kod:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot gotowy!');
    console.log('⏱️ Auto-usuwanie:', CONFIG.autoDeleteSeconds > 0 ? `${CONFIG.autoDeleteSeconds}s` : 'WYŁĄCZONE');
    console.log('📋 Dozwolone grupy:', ALLOWED_GROUPS.length);
});

// ============================================
// FUNKCJA WYSYŁANIA Z AUTO-USUWANIEM
// ============================================
async function sendAndDelete(msg, text, options = {}) {
    const { deleteAfter = CONFIG.autoDeleteSeconds, silent = false, dm = false } = options;
    
    let sentMsg;
    
    // Jeśli cicha komenda - wyślij na DM
    if (dm || silent) {
        const sender = msg.author || msg.from;
        try {
            sentMsg = await client.sendMessage(sender, text);
            console.log(`📩 Wysłano DM do ${sender}`);
            
            if (deleteAfter > 0) {
                setTimeout(async () => {
                    try {
                        await sentMsg.delete(true);
                        console.log('🗑️ Usunięto DM');
                    } catch (e) {}
                }, deleteAfter * 1000);
            }
            return sentMsg;
        } catch (e) {
            console.error('Błąd wysyłania DM:', e);
        }
    }
    
    // Normalna odpowiedź w czacie
    try {
        sentMsg = await msg.reply(text);
        
        if (deleteAfter > 0) {
            setTimeout(async () => {
                try {
                    await sentMsg.delete(true);
                    console.log(`🗑️ Usunięto odpowiedź po ${deleteAfter}s`);
                } catch (error) {
                    console.log('Nie można usunąć:', error.message);
                }
            }, deleteAfter * 1000);
        }
        
        return sentMsg;
    } catch (e) {
        console.error('Błąd wysyłania:', e);
        return null;
    }
}

// ============================================
// POBIERANIE NAZWY UŻYTKOWNIKA - POPRAWIONE
// ============================================
async function getUserName(msg) {
    const sender = msg.author || msg.from;
    
    // Sprawdź czy mamy zapisaną nazwę
    if (userNames.has(sender)) {
        return userNames.get(sender);
    }
    
    // Użyj pushname z wiadomości (najszybsze)
    if (msg.pushname && msg.pushname !== 'Unknown' && msg.pushname !== undefined) {
        userNames.set(sender, msg.pushname);
        return msg.pushname;
    }
    
    // Spróbuj pobrać z kontaktu (zabezpieczone)
    try {
        const contact = await msg.getContact();
        if (contact && contact.name) {
            userNames.set(sender, contact.name);
            return contact.name;
        }
        if (contact && contact.pushname) {
            userNames.set(sender, contact.pushname);
            return contact.pushname;
        }
    } catch (e) {
        // Ignoruj błąd - użyj fallbacku
    }
    
    // Fallback na numer telefonu
    const number = sender.replace('@c.us', '').replace('@g.us', '');
    userNames.set(sender, number);
    return number;
}

function isAllowedGroup(chatId) {
    if (ALLOWED_GROUPS.length === 0 || ALLOWED_GROUPS[0] === '120363404482024925@g.us') {
        return true;
    }
    return ALLOWED_GROUPS.includes(chatId);
}

// ============================================
// GŁÓWNY HANDLER
// ============================================
client.on('message_create', async (msg) => {
    if (msg.fromMe && !msg.body.startsWith(CONFIG.prefix)) return;
    
    let chat;
    try {
        chat = await msg.getChat();
    } catch (e) {
        console.error('Błąd pobierania chatu:', e);
        return;
    }
    
    const sender = msg.author || msg.from;
    let userName;
    
    try {
        userName = await getUserName(msg);
    } catch (e) {
        console.error('Błąd pobierania nazwy:', e);
        userName = sender.replace('@c.us', '').replace('@g.us', '');
    }
    
    userNames.set(sender, userName);
    
    if (!msg.body.startsWith(CONFIG.prefix)) return;
    
    const args = msg.body.slice(CONFIG.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const text = args.join(' ');
    
    // 🆔 ID - działa wszędzie
    if (command === 'id') {
        const chatType = chat.isGroup ? 'GRUPA' : 'PRYWATNY';
        console.log(`📋 ID ${chatType}: ${chat.id?._serialized || 'unknown'} | ${userName}`);
        await msg.reply(`🆔 *ID czatu:* \`${chat.id?._serialized || 'unknown'}\`\nTyp: ${chatType}\n\nDodaj do ALLOWED_GROUPS!`);
        return;
    }
    
    // 📩 POMOC - działa wszędzie
    if (command === 'pomoc' || command === 'help') {
        await msg.reply(CONFIG.welcomeMessage);
        return;
    }
    
    // Sprawdź czy to cicha komenda
    const isSilent = CONFIG.silentCommands.includes(command);
    
    // 🚫 POZOSTAŁE - tylko w dozwolonych grupach (jeśli nie ciche)
    if (!isSilent && chat.isGroup && !isAllowedGroup(chat.id._serialized)) {
        console.log(`🚫 IGNORUJĘ: ${chat.name || 'unknown'} (${chat.id?._serialized || 'unknown'})`);
        return;
    }
    
    if (chat.isGroup) {
        console.log(`✅ OBSŁUGUJĘ: ${chat.name || 'unknown'} | ${userName} | ${command}`);
        updateStats(sender, userName);
    }
    
    try {
        switch(command) {
            case 'ankieta':
            case 'poll':
                await handlePoll(msg, text, chat);
                break;
                
            case 'losuj':
            case 'random':
                await handleRandom(msg, text);
                break;
                
            case 'kto':
            case 'who':
                await handleWho(msg, chat);
                break;
                
            case 'meme':
                await handleMeme(msg);
                break;
                
            case 'herbata':
            case 'tea':
                await handleTea(msg, chat);
                break;
                
            case 'rzut':
            case 'coin':
            case 'flip':
                await handleCoin(msg);
                break;
                
            case 'pogoda':
            case 'weather':
                await handleWeather(msg, text);
                break;
                
            case 'ranking':
            case 'stats':
                await handleStats(msg);
                break;
                
            case 'wyzwanie':
            case 'challenge':
                await handleChallenge(msg);
                break;
                
            case '8ball':
                await handle8Ball(msg, text);
                break;
                
            case 'cześć':
            case 'czesc':
            case 'hej':
                await sendAndDelete(msg, `👋 Cześć ${userName}!`);
                break;
                
            case 'dobranoc':
                await sendAndDelete(msg, `🌙 *Dobranoc ${userName}!*\nNiech Ci się przyśnią fajne rzeczy! 😴✨`);
                break;
                
            case 'zart':
            case 'żart':
                await handleJoke(msg);
                break;
                
            case 'fakt':
                await handleFact(msg);
                break;
                
            case 'czas':
            case 'time':
                await handleTime(msg);
                break;
                
            case 'liczba':
            case 'number':
                await handleNumber(msg, text);
                break;
                
            case 'wybierz':
            case 'pick':
                await handlePick(msg, text);
                break;
                
            case 'druzyna':
            case 'team':
                await handleTeams(msg, chat);
                break;
                
            case 'kostka':
                await handleDice(msg);
                break;
                
            case 'kostka-rpg':
            case 'rpg':
                await handleRPGDice(msg);
                break;
                
            case 'odwroc':
            case 'reverse':
                await handleReverse(msg, text);
                break;
                
            case 'duplikuj':
            case 'dup':
                await handleDuplicate(msg, text);
                break;
                
            case 'spoiluj':
            case 'spoiler':
                await handleSpoiler(msg, text);
                break;
                
            case 'tlumacz':
            case 'translate':
                await handleTranslate(msg, text);
                break;
                
            case 'skrot':
            case 'acronym':
                await handleAcronym(msg, text);
                break;
                
            case 'haslo':
            case 'password':
                await handlePassword(msg);
                break;
                
            case 'rps':
            case 'pkn':
                await handleRPS(msg, text);
                break;
                
            case 'calc':
            case 'kalkulator':
                await handleCalc(msg, text, true);
                break;
                
            case 'notatka':
            case 'note':
                await handleNote(msg, text, true);
                break;
                
            case 'admin':
                if (sender === CONFIG.adminNumber) {
                    await sendAndDelete(msg, `🔧 *Panel Admina*\n\nUżytkownik: ${userName}\nDozwolone grupy: ${ALLOWED_GROUPS.length}\nAuto-usuwanie: ${CONFIG.autoDeleteSeconds}s\n• !resetstats - reset statystyk\n• !toggledelete - włącz/wyłącz auto-usuwanie`, { deleteAfter: 0 });
                } else {
                    await sendAndDelete(msg, '⛔ Brak uprawnień!');
                }
                break;
                
            case 'toggledelete':
                if (sender === CONFIG.adminNumber) {
                    CONFIG.autoDeleteSeconds = CONFIG.autoDeleteSeconds > 0 ? 0 : 30;
                    await sendAndDelete(msg, `⏱️ Auto-usuwanie: ${CONFIG.autoDeleteSeconds > 0 ? 'WŁĄCZONE (' + CONFIG.autoDeleteSeconds + 's)' : 'WYŁĄCZONE'}`, { deleteAfter: 0 });
                }
                break;
                
            case 'resetstats':
                if (sender === CONFIG.adminNumber) {
                    userStats.clear();
                    userNames.clear();
                    await sendAndDelete(msg, '✅ Wyczyszczone!', { deleteAfter: 0 });
                }
                break;
        }
    } catch (error) {
        console.error('❌ Błąd w komendzie:', error);
    }
});

// ============================================
// POWITANIA - Z ZABEZPIECZENIEM
// ============================================
client.on('group_join', async (notification) => {
    if (!isAllowedGroup(notification.chatId)) {
        console.log(`🚫 Ignoruję dołączenie do: ${notification.chatId}`);
        return;
    }
    
    try {
        const chat = await client.getChatById(notification.chatId);
        setTimeout(async () => {
            try {
                const welcomeMsg = await chat.sendMessage(CONFIG.welcomeMessage);
                console.log(`👋 Powitałem w: ${chat.name || 'unknown'}`);
                
                setTimeout(async () => {
                    try {
                        await welcomeMsg.delete(true);
                    } catch (e) {}
                }, 5 * 60 * 1000);
            } catch (e) {
                console.error('Błąd wysyłania powitania:', e);
            }
        }, 2000);
    } catch (e) {
        console.error('Błąd pobierania grupy:', e);
    }
});

client.on('group_leave', async (notification) => {
    if (!isAllowedGroup(notification.chatId)) return;
    
    try {
        const chat = await client.getChatById(notification.chatId);
        const byeMsg = await chat.sendMessage('👋 Żegnaj! Mamy nadzieję, że wrócisz! 😢');
        
        setTimeout(async () => {
            try {
                await byeMsg.delete(true);
            } catch (e) {}
        }, 60000);
    } catch (e) {
        console.error('Błąd wysyłania pożegnania:', e);
    }
});

// ============================================
// FUNKCJE KOMEND
// ============================================

async function handlePoll(msg, text, chat) {
    if (!text.includes('|')) {
        await sendAndDelete(msg, `❌ *Zły format!*\n\nUżyj: !ankieta Pytanie | Opcja1 | Opcja2`);
        return;
    }
    
    const parts = text.split('|').map(p => p.trim());
    const question = parts[0];
    const options = parts.slice(1).filter(o => o);
    
    if (options.length < 2) {
        await sendAndDelete(msg, '❌ Podaj min. 2 opcje!');
        return;
    }
    
    const pollId = Date.now();
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    
    let pollText = `📊 *ANKIETA:* ${question}\n\n`;
    options.forEach((opt, idx) => {
        if (idx < emojis.length) {
            pollText += `${emojis[idx]} ${opt} - 0 głosów\n`;
        }
    });
    pollText += `\n📝 Głosuj: !głosuj ${pollId} [numer]`;
    
    try {
        const pollMsg = await msg.reply(pollText);
        
        polls.set(pollId, {
            question,
            options: options.map((opt, idx) => ({ 
                text: opt, 
                votes: 0, 
                emoji: emojis[idx] || '•',
                voters: []
            })),
            chatId: chat.id?._serialized,
            createdAt: Date.now()
        });
        
        setTimeout(() => polls.delete(pollId), 24 * 60 * 60 * 1000);
    } catch (e) {
        console.error('Błąd tworzenia ankiety:', e);
    }
}

// Głosowanie
client.on('message_create', async (msg) => {
    if (!msg.body.startsWith(`${CONFIG.prefix}głosuj`)) return;
    
    let chat;
    try {
        chat = await msg.getChat();
    } catch (e) {
        return;
    }
    
    if (chat.isGroup && !isAllowedGroup(chat.id?._serialized)) return;
    
    const args = msg.body.split(/\s+/);
    if (args.length < 3) {
        await sendAndDelete(msg, 'Użyj: !głosuj [id] [numer]');
        return;
    }
    
    const pollId = parseInt(args[1]);
    const optionIdx = parseInt(args[2]) - 1;
    const voter = msg.author || msg.from;
    
    const poll = polls.get(pollId);
    if (!poll) {
        await sendAndDelete(msg, '❌ Ankieta wygasła!');
        return;
    }
    
    if (optionIdx < 0 || optionIdx >= poll.options.length) {
        await sendAndDelete(msg, `❌ Wybierz 1-${poll.options.length}`);
        return;
    }
    
    for (let opt of poll.options) {
        if (opt.voters.includes(voter)) {
            await sendAndDelete(msg, '❌ Już głosowałeś!');
            return;
        }
    }
    
    poll.options[optionIdx].votes++;
    poll.options[optionIdx].voters.push(voter);
    
    const total = poll.options.reduce((a, b) => a + b.votes, 0);
    let resultText = `📊 *ANKIETA:* ${poll.question}\n\n`;
    
    poll.options.forEach(opt => {
        const percent = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
        resultText += `${opt.emoji} ${opt.text}\n   ${opt.votes} głosów (${percent}%) ${bar}\n\n`;
    });
    
    await sendAndDelete(msg, resultText + `✅ Głos zapisany! (${total})`);
});

async function handleRandom(msg, text) {
    if (!text) {
        await sendAndDelete(msg, `🎲 *Losowanie*\n\nUżyj:\n• !losuj opcja1 opcja2\n• !losuj 1-100`);
        return;
    }
    
    if (text.includes('-')) {
        const [min, max] = text.split('-').map(Number);
        if (!isNaN(min) && !isNaN(max) && min < max) {
            const result = Math.floor(Math.random() * (max - min + 1)) + min;
            await sendAndDelete(msg, `🎲 Losuję ${min}-${max}...\n\n🎯 *${result}*`);
            return;
        }
    }
    
    const options = text.split(/[ ,|]+/).filter(o => o);
    if (options.length < 2) {
        await sendAndDelete(msg, '❌ Podaj min. 2 opcje!');
        return;
    }
    
    const winner = options[Math.floor(Math.random() * options.length)];
    await sendAndDelete(msg, `🎲 *Losowanie:*\n${options.join(' vs ')}\n\n🏆 *${winner}*`);
}

async function handleWho(msg, chat) {
    if (!chat.isGroup || !chat.participants) {
        await sendAndDelete(msg, '❌ Tylko w grupach!');
        return;
    }
    
    const participants = chat.participants.map(p => p.id?._serialized).filter(Boolean);
    if (participants.length === 0) {
        await sendAndDelete(msg, '❌ Nie mogę pobrać listy!');
        return;
    }
    
    const random = participants[Math.floor(Math.random() * participants.length)];
    const number = random.replace('@c.us', '');
    
    await sendAndDelete(msg, `🎯 *Wylosowano:* @${number}\n\n🎉 Szczęściarz!`);
}

async function handleMeme(msg) {
    const memes = [
        "Kiedy mówisz 'zaraz wracam' i wracasz po 5h... 😅",
        "Ja: *kładę się o 22*\nJa o 3am: *rozważam sens życia* 🤔",
        "Mój portfel: Nie możemy iść na miasto\nJa: Dlaczego?\nPortfel: Tak 😢",
        "Plan: Wyjść z domu\nReality: Leżeć 48h w piżamie 🛋️",
        "Ja przed egzaminem: Jestem gotowy!\nEgzamin: *inne pytania*\nJa: 🙃",
        "Moja motywacja: 📈📉📉📉📉📉"
    ];
    
    await sendAndDelete(msg, `😂 *MEM:*\n\n${memes[Math.floor(Math.random() * memes.length)]}`);
}

async function handleTea(msg, chat) {
    if (!chat.isGroup || !chat.participants) {
        await sendAndDelete(msg, '❌ Tylko w grupach!');
        return;
    }
    
    const participants = chat.participants.map(p => p.id?._serialized).filter(Boolean);
    if (participants.length === 0) {
        await sendAndDelete(msg, '❌ Brak uczestników!');
        return;
    }
    
    const unlucky = participants[Math.floor(Math.random() * participants.length)];
    const number = unlucky.replace('@c.us', '');
    
    const teas = ['czarną 🍋', 'zieloną 🍵', 'z miodem 🍯', 'earl grey ☕', 'zimną 🧊', 'rumiankową 🌼'];
    const tea = teas[Math.floor(Math.random() * teas.length)];
    
    await sendAndDelete(msg, `☕ @${number} robi ${tea}!\n\n⏰ 5 minut! 😄`);
}

async function handleCoin(msg) {
    const result = Math.random() < 0.5 ? 'ORZEŁ 🦅' : 'RESZKA 🪙';
    await sendAndDelete(msg, `🪙 *Rzut...*\n\n✨ *${result}*`);
}

async function handleWeather(msg, city) {
    if (!city) {
        await sendAndDelete(msg, '🌤️ Użyj: !pogoda [miasto]');
        return;
    }
    
    const weathers = ['☀️ Słonecznie', '⛅ Pochmurno', '🌧️ Deszcz', '⛈️ Burza', '❄️ Śnieg'];
    const temps = [12, 15, 18, 20, 22, 25, 28];
    
    const w = weathers[Math.floor(Math.random() * weathers.length)];
    const t = temps[Math.floor(Math.random() * temps.length)];
    
    await sendAndDelete(msg, `🌤️ *${city}:*\n${w}\n🌡️ ${t}°C\n💨 ${Math.floor(Math.random() * 30)} km/h`);
}

async function handleStats(msg) {
    if (userStats.size === 0) {
        await sendAndDelete(msg, '📊 Brak statystyk!');
        return;
    }
    
    const sorted = Array.from(userStats.entries())
        .sort((a, b) => b[1].messages - a[1].messages)
        .slice(0, 5);
    
    let text = '🏆 *TOP 5:*\n\n';
    sorted.forEach(([id, stats], idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
        text += `${medal} ${stats.name}: ${stats.messages} msg\n`;
    });
    
    await sendAndDelete(msg, text);
}

async function handleChallenge(msg) {
    const challenges = [
        "Napisz coś miłego do osoby powyżej! 💝",
        "Pokaż ostatnie zdjęcie w galerii! 📸",
        "Opowiedz żart! 😄",
        "Zarekomenduj film! 🎬",
        "Nie używaj emotek 10 min! 😈",
        "Opisz dzień jednym słowem! 📅",
        "Zaspiewaj coś (głosówka)! 🎵",
        "Wymień 3 rzeczy, za które jesteś wdzięczny! 🙏"
    ];
    
    await sendAndDelete(msg, `🎯 *WYZWANIE:*\n\n${challenges[Math.floor(Math.random() * challenges.length)]}\n\n⏰ 5 minut!`);
}

async function handle8Ball(msg, question) {
    if (!question) {
        await sendAndDelete(msg, '🔮 Użyj: !8ball [pytanie]');
        return;
    }
    
    const answers = [
        "✅ Tak!", "❌ Nie.", "🤔 Może...", "⭐ Zdecydowanie tak!",
        "😬 Lepiej nie pytaj...", "🌟 Wszystko na TAK!", "⛔ Niemożliwe.",
        "💭 Zapytaj ponownie.", "🎲 50/50.", "🚀 Tak, ale wymaga wysiłku!"
    ];
    
    await sendAndDelete(msg, `🔮 *${question}*\n\n${answers[Math.floor(Math.random() * answers.length)]}`);
}

async function handleJoke(msg) {
    const jokes = [
        "Dlaczego programista nie może zostać ogrodnikiem?\nBo mówi, że 'to nie bug, to feature'! 🌱",
        "Co mówi informatyk do drugiego?\n'Widzimy się w domu' - 'A ja w Windowsie'! 💻",
        "Dlaczego komputer poszedł do lekarza?\nBo miał wirusa! 🦠",
        "Jak informatyk robi herbatę?\nInstaluje Java! ☕",
        "Dlaczego programista nie rozumie żartów?\nBo nie ma komentarzy! 📖"
    ];
    
    await sendAndDelete(msg, `😂 *ŻART:*\n\n${jokes[Math.floor(Math.random() * jokes.length)]}`);
}

async function handleFact(msg) {
    const facts = [
        "🐙 Ośmiornice mają trzy serca i niebieską krew!",
        "🍌 Banany są technicznie jagodami!",
        "🦒 Żyrafy mają tylko 7 kręgów szyjnych - tyle co człowiek!",
        "🐝 Pszczoły rozpoznają twarze ludzi!",
        "🦘 Kangury nie potrafią chodzić do tyłu!",
        "🍯 Miód nigdy się nie psuje!"
    ];
    
    await sendAndDelete(msg, `📚 *FAKT:*\n\n${facts[Math.floor(Math.random() * facts.length)]}`);
}

async function handleTime(msg) {
    const now = new Date();
    const time = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('pl-PL');
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    
    await sendAndDelete(msg, `🕐 *Czas:*\n\n${time}\n${date}\n${days[now.getDay()]}`);
}

async function handleNumber(msg, text) {
    if (!text || !text.includes('-')) {
        await sendAndDelete(msg, '🎲 Użyj: !liczba 1-100');
        return;
    }
    
    const [min, max] = text.split('-').map(Number);
    if (isNaN(min) || isNaN(max)) {
        await sendAndDelete(msg, '❌ Podaj poprawne liczby!');
        return;
    }
    
    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    await sendAndDelete(msg, `🎲 ${min}-${max} → *${result}*`);
}

async function handlePick(msg, text) {
    if (!text) {
        await sendAndDelete(msg, '🎯 Użyj: !wybierz opcja1 opcja2 ...');
        return;
    }
    
    const options = text.split(/[ ,|]+/).filter(o => o);
    if (options.length < 2) {
        await sendAndDelete(msg, '❌ Podaj min. 2 opcje!');
        return;
    }
    
    const pick = options[Math.floor(Math.random() * options.length)];
    await sendAndDelete(msg, `🎯 Wybieram z: ${options.join(', ')}\n\n🏆 *${pick}*`);
}

async function handleTeams(msg, chat) {
    if (!chat.isGroup || !chat.participants) {
        await sendAndDelete(msg, '❌ Tylko w grupach!');
        return;
    }
    
    const participants = chat.participants.map(p => p.id?._serialized).filter(Boolean);
    if (participants.length < 2) {
        await sendAndDelete(msg, '❌ Za mało osób!');
        return;
    }
    
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    const team1 = shuffled.slice(0, mid);
    const team2 = shuffled.slice(mid);
    
    let text = '⚔️ *DRUŻYNY:*\n\n';
    text += `🔴 *Drużyna 1:*\n${team1.map(id => '@' + id.replace('@c.us', '')).join('\n')}\n\n`;
    text += `🔵 *Drużyna 2:*\n${team2.map(id => '@' + id.replace('@c.us', '')).join('\n')}`;
    
    await sendAndDelete(msg, text);
}

async function handleDice(msg) {
    const result = Math.floor(Math.random() * 6) + 1;
    const dice = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    await sendAndDelete(msg, `🎲 *Kostka:*\n\n${dice[result - 1]} *${result}*`);
}

async function handleRPGDice(msg) {
    const result = Math.floor(Math.random() * 20) + 1;
    let comment = '';
    if (result === 20) comment = ' 🔥 KRYTYCZNE!';
    else if (result === 1) comment = ' 💀 Porażka...';
    
    await sendAndDelete(msg, `🎲 *D20:*\n\n🎯 *${result}*${comment}`);
}

async function handleReverse(msg, text) {
    if (!text) {
        await sendAndDelete(msg, '🔄 Użyj: !odwroc [tekst]');
        return;
    }
    
    const reversed = text.split('').reverse().join('');
    await sendAndDelete(msg, `🔄 *Odwrócony:*\n\n${reversed}`);
}

async function handleDuplicate(msg, text) {
    if (!text) {
        await sendAndDelete(msg, '📋 Użyj: !duplikuj [tekst]');
        return;
    }
    
    await sendAndDelete(msg, `📋 *Duplikat:*\n\n${text} ${text}`);
}

async function handleSpoiler(msg, text) {
    if (!text) {
        await sendAndDelete(msg, '⚠️ Użyj: !spoiluj [tekst]');
        return;
    }
    
    await sendAndDelete(msg, `⚠️ *SPOILER:*\n\n||${text}||`);
}

async function handleTranslate(msg, text) {
    if (!text) {
        await sendAndDelete(msg, '🌍 Użyj: !tlumacz [tekst]');
        return;
    }
    
    const fakeLangs = ['Klingoński', 'Elvish', 'Pig Latin', 'Yoda', 'Dothraki'];
    const lang = fakeLangs[Math.floor(Math.random() * fakeLangs.length)];
    
    const translated = text
        .split('')
        .map((c, i) => Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase())
        .join('');
    
    await sendAndDelete(msg, `🌍 *${lang}:*\n\n"${translated}"\n\n*Oryginał:* ${text}`);
}

async function handleAcronym(msg, text) {
    if (!text) {
        await sendAndDelete(msg, '🔤 Użyj: !skrot [tekst długi]');
        return;
    }
    
    const acronym = text
        .split(/\s+/)
        .map(word => word[0]?.toUpperCase() || '')
        .join('');
    
    await sendAndDelete(msg, `🔤 *Skrót:*\n\n${acronym}\n\n*Z:* ${text}`);
}

async function handlePassword(msg) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
        pass += chars[Math.floor(Math.random() * chars.length)];
    }
    
    await sendAndDelete(msg, `🔐 *Hasło:*\n\n\`${pass}\`\n\nZapisz w bezpiecznym miejscu!`);
}

async function handleRPS(msg, text) {
    if (!text || !['kamien', 'kamień', 'papier', 'nozyce', 'nożyce'].includes(text.toLowerCase())) {
        await sendAndDelete(msg, '✊ Użyj: !rps [kamien/papier/nozyce]');
        return;
    }
    
    const choices = ['kamień', 'papier', 'nożyce'];
    const userChoice = text.toLowerCase().replace('kamien', 'kamień').replace('nozyce', 'nożyce');
    const botChoice = choices[Math.floor(Math.random() * choices.length)];
    
    let result = '';
    if (userChoice === botChoice) {
        result = 'Remis! 🤝';
    } else if (
        (userChoice === 'kamień' && botChoice === 'nożyce') ||
        (userChoice === 'papier' && botChoice === 'kamień') ||
        (userChoice === 'nożyce' && botChoice === 'papier')
    ) {
        result = 'Wygrałeś! 🎉';
    } else {
        result = 'Przegrałeś! 😢';
    }
    
    const emojis = { 'kamień': '✊', 'papier': '✋', 'nożyce': '✌️' };
    
    await sendAndDelete(msg, `✊ *PKN:*\n\nTy: ${emojis[userChoice]} ${userChoice}\nBot: ${emojis[botChoice]} ${botChoice}\n\n${result}`);
}

async function handleCalc(msg, text, silent) {
    if (!text) {
        await sendAndDelete(msg, '🔢 Użyj: !calc [działanie]\n\nNp: !calc 2+2', { dm: silent });
        return;
    }
    
    try {
        const safeExpr = text.replace(/[^0-9+\-*/.() ]/g, '');
        if (safeExpr !== text.trim()) {
            await sendAndDelete(msg, '❌ Niedozwolone znaki! Użyj: 0-9 + - * / ( )', { dm: silent });
            return;
        }
        
        const result = Function('"use strict"; return (' + safeExpr + ')')();
        await sendAndDelete(msg, `🔢 *${safeExpr} = ${result}*`, { dm: silent });
    } catch (e) {
        await sendAndDelete(msg, '❌ Błąd w działaniu!', { dm: silent });
    }
}

async function handleNote(msg, text, silent) {
    if (!text) {
        await sendAndDelete(msg, '📝 Użyj: !notatka [treść]', { dm: silent });
        return;
    }
    
    const time = new Date().toLocaleString('pl-PL');
    await sendAndDelete(msg, `📝 *Notatka zapisana!*\n\n*Treść:* ${text}\n*Czas:* ${time}`, { dm: silent });
}

function updateStats(userId, name) {
    if (!userStats.has(userId)) {
        userStats.set(userId, { name, messages: 0 });
    }
    userStats.get(userId).messages++;
    userStats.get(userId).name = name;
}

process.on('unhandledRejection', (err) => {
    console.error('❌ Błąd:', err);
});

console.log('🚀 Uruchamianie NexusBot...');
console.log('⏱️ Auto-usuwanie:', CONFIG.autoDeleteSeconds, 'sekund');
console.log('🔇 Ciche komendy:', CONFIG.silentCommands.join(', '));
client.initialize();