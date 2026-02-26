const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const ALLOWED_GROUPS = [
    '120363404482024925@g.us',
    '120363406442350203@g.us'
];

const CONFIG = {
    prefix: '!',
    autoDeleteSeconds: 30,
    silentCommands: ['calc', 'notatka'],
    welcomeMessage: `🎉 *Witaj w grupie!* 🎉\n\n📋 *ZASADY:*\n• Bądź miły dla innych\n• Nie spamuj\n• Używaj komend z prefiksem !`
};

const polls = new Map();
const userStats = new Map();
const userNames = new Map();

// auth state
const { state, saveState } = useSingleFileAuthState('./auth_info.json');

const client = makeWASocket({
    auth: state,
    printQRInTerminal: true
});

// zapis auth przy zmianach
client.ev.on('creds.update', saveState);

// helper do sprawdzania dozwolonych grup
function isAllowedGroup(jid) {
    if (ALLOWED_GROUPS.length === 0) return true;
    return ALLOWED_GROUPS.includes(jid);
}

// wysyłanie i auto-usuwanie
async function sendAndDelete(jid, text, options = {}) {
    const { deleteAfter = CONFIG.autoDeleteSeconds } = options;
    const sentMsg = await client.sendMessage(jid, { text });
    if (deleteAfter > 0) {
        setTimeout(async () => {
            try { await client.sendMessage(jid, { delete: { id: sentMsg.key.id, remoteJid: jid } }); } catch(e) {}
        }, deleteAfter * 1000);
    }
    return sentMsg;
}

// obsługa wiadomości
client.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || !msg.key.remoteJid) return;

    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;

    // tylko prefix
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!body || !body.startsWith(CONFIG.prefix)) return;

    const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const text = args.join(' ');

    // ciche komendy
    const isSilent = CONFIG.silentCommands.includes(command);

    // ignoruj nie dozwolone grupy
    if (!isSilent && jid.endsWith('@g.us') && !isAllowedGroup(jid)) return;

    // log
    console.log(`📩 ${sender} -> ${command} (${text})`);

    try {
        switch(command) {
            case 'id':
                await sendAndDelete(jid, `🆔 ID czatu: \`${jid}\``);
                break;
            case 'pomoc':
            case 'help':
                await sendAndDelete(jid, CONFIG.welcomeMessage);
                break;
            case 'ankieta':
                await handlePoll(jid, text);
                break;
            case 'losuj':
                await handleRandom(jid, text);
                break;
            case 'cześć':
            case 'hej':
                await sendAndDelete(jid, `👋 Cześć!`);
                break;
        }
    } catch (e) {
        console.error('Błąd w komendzie:', e);
    }
});

// ============================================
// FUNKCJE KOMEND
// ============================================

async function handlePoll(jid, text) {
    if (!text.includes('|')) return sendAndDelete(jid, '❌ Format: !ankieta pytanie | opcja1 | opcja2');

    const parts = text.split('|').map(p => p.trim());
    const question = parts[0];
    const options = parts.slice(1).filter(o => o);
    if (options.length < 2) return sendAndDelete(jid, '❌ Min. 2 opcje!');

    const pollId = Date.now();
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];

    let pollText = `📊 *ANKIETA:* ${question}\n\n`;
    options.forEach((opt, idx) => {
        pollText += `${emojis[idx] || '•'} ${opt} - 0 głosów\n`;
    });
    pollText += `\n📝 Głosuj: !głosuj ${pollId} [numer]`;

    await sendAndDelete(jid, pollText);

    polls.set(pollId, {
        question,
        options: options.map((opt, idx) => ({ text: opt, votes: 0, emoji: emojis[idx] || '•', voters: [] })),
        createdAt: Date.now()
    });

    // ankieta wygasa po 24h
    setTimeout(() => polls.delete(pollId), 24*60*60*1000);
}

async function handleRandom(jid, text) {
    if (!text) return sendAndDelete(jid, '🎲 Użyj: !losuj opcja1 opcja2 lub !losuj 1-100');

    if (text.includes('-')) {
        const [min,max] = text.split('-').map(Number);
        if (!isNaN(min) && !isNaN(max) && min<max) {
            const result = Math.floor(Math.random()*(max-min+1))+min;
            return sendAndDelete(jid, `🎯 Losuję ${min}-${max} → *${result}*`);
        }
    }

    const options = text.split(/[ ,|]+/).filter(o => o);
    if (options.length<2) return sendAndDelete(jid, '❌ Min. 2 opcje!');
    const winner = options[Math.floor(Math.random()*options.length)];
    await sendAndDelete(jid, `🎲 Losowanie: ${options.join(' vs ')} → 🏆 *${winner}*`);
}

// ============================================
// POWITANIA (dla grup)
client.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
        const jid = update.id;
        if (!isAllowedGroup(jid)) continue;

        if (update.announce) {
            await sendAndDelete(jid, CONFIG.welcomeMessage);
        }
    }
});