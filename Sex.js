const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');

// --- КОНФИГУРАЦИЯ ---
const CONFIG = {
    host: 'ru.masedworld.net',
    port: 25565,
    username: 'Ezzka2134q111e',
    version: '1.16.5',
    auth: 'offline'
};

// Тексты рекламы
const AD_TEXT = [
    "!&4&lChert&0&lHouse&f. Место &l&cсильнейших&f. Здесь формируются &eальянсы&f, строятся &aимперии &fи пишется история сервера. Ты - &nследующий&f. &l&e/c join ChertHouse. /warp ch.",
    "!&4&lChert&0&lHouse &f- не просто клан, а &n&cимперия&f. Идеальный &aпорядок&f, &eсильное сообщество &fи лучший персонал. Это уровень, к которому &eстремятся&f. Присоединяйтесь к сильным: &l&e/c join ChertHouse",
    "!&4&lChert&0&lHouse &f- для тех, кто выбирает &eрезультат&f. &cСильная команда&f, &aчеткая организация&f, &nлучшие условия для игры&f. Здесь строят проекты. Здесь добиваются целей. &e&l/c join ChertHouse",
    "!&fПривет! Хочешь себе &6донат&f, но нет возможности &aкупить &fего? У нас в клане проводится частые &c&lРОЗЫГРЫШИ&f! Успей попытать &aудачу&f и вступай к нам в &eклан&f! &e&l/c join ChertHouse",
    "!&fПриветик! Хочешь с &dкайфом &fпровести время, но не знаешь как? Тогда тебе подойдёт &cклан &4&lChert&0&lHouse &f! У нас ты найдёшь &eхороший кх&f, &bтоповый кит &fи &nдрузей&f. Чтоб вступить в клан пиши &c/warp CH",
    "!&fХочешь в &dкрутой клан &fс многими &eплюшками? Тогда тебе нужен клан &4&lChert&0&lHouse&f ! У нас ты не только найдёшь &bтоповый кит для пвп&f и&e хороший кх&f, но и тг группу. А так же у нас открыт набор на модераторов! &c/warp CH",
    "!&fИщешь &aотличный клан &fс &eкрутыми возможностями&f? Тогда тебе подходит клан &4&lChert&0&lHouse &f! &bТоповый кит&f, &6бот&f, всё это ты найдёшь на &c/warp ch&f . Ждём именно тебя!",
    "!&eТоповый кх&f, &bахеренный кит&f, всё это есть в клане &4&lChetrt&0&lHouse&f! Ощути весь кайф в &cнашем клане&f, побывай в нашей &aтг группе &fи не только! Просто напиши &e/c join ChertHouse &f!",
];

const AD_CLAN = [
    "&fПривет, путник! Хочешь найти друга? Или просто пообщаться с соклановцами? У нас для этого есть тг-чат! &a&l@cherthouse_clan",
    "&fХочешь себе донат? Розыгрыш уже идет в нашем телеграм-чате. Успей -> &a&l@cherthouse_clan",
    "Начинается розыгрыш! Разыгрываем донат-кейсы среди участников нашего телеграм-чата. Стань своим - переходи и участвуй. -> &a&l@cherthouse_clan",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createBot() {
    console.log(`>>> [EXTRA] Подключение к ${CONFIG.host} как ${CONFIG.username}...`);

    const bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username,
        version: CONFIG.version,
        auth: CONFIG.auth,
        hideErrors: false // ВКЛЮЧИЛ ОШИБКИ, ЧТОБЫ ВИДЕТЬ ПОЧЕМУ ВИСИТ
    });

    // --- ФИКС ОШИБКИ СКИНОВ (БЕЗОПАСНАЯ ВЕРСИЯ) ---
    // Оборачиваем в try-catch, чтобы код не падал, если registry еще не готов
    try {
        if (bot.registry && bot.registry.protocol && bot.registry.protocol.types && bot.registry.protocol.types['string']) {
            const oldDeserialize = bot.registry.protocol.types['string'][1];
            bot.registry.protocol.types['string'][1] = (buffer, offset) => {
                try {
                    return oldDeserialize(buffer, offset);
                } catch (e) {
                    return { value: "", size: 0 };
                }
            };
        }
    } catch (setupErr) {
        console.log(">>> [WARN] Не удалось применить фикс скинов сразу (не критично)");
    }

    bot._client.on('packet', (data, metadata) => {
        if (metadata.name === 'player_info') {
            try {
                if (data.data && data.data.properties) {
                    data.data.properties = data.data.properties.map(prop => {
                        try {
                            JSON.parse(prop.value);
                            return prop;
                        } catch (e) {
                            prop.value = "{}";
                            return prop;
                        }
                    });
                }
            } catch (err) {}
        }
    });

    // --- ОТЛАДКА: ПОЧЕМУ ОН МОЛЧИТ? ---
    bot.on('kicked', (reason) => {
        console.log("!!! БОТ КИКНУТ СЕРВЕРОМ !!!");
        console.log("Причина:", reason);
    });

    bot.on('login', () => {
        console.log(">>> [NET] Сетевой вход выполнен (Handshake пройден). Жду спавна...");
    });

    // --- ЛОГИКА ---
    process.on('uncaughtException', (err) => {
        if (err.message.includes('JSON') || err.message.includes('packet')) return;
        console.error("!!! КРИТИЧЕСКАЯ ОШИБКА СКРИПТА:", err);
    });

    bot.loadPlugin(pathfinder);

    let startPos = null;
    let isReady = false;
    let loginDone = false;
    let nearbyPlayers = {};

    // 1. ЛОГИКА АВТОРИЗАЦИИ (Через чат, если spawn завис)
    bot.on('message', async (jsonMsg) => {
        const msg = jsonMsg.toString();
        if (!msg.trim()) return;
        
        // Логируем чат, чтобы видеть, что пишет сервер
        // console.log(`[CHAT] ${msg}`); 

        if (!loginDone && (msg.includes("/login") || msg.includes("/reg") || msg.includes("войдите"))) {
            console.log(">>> [AUTH] Вижу запрос пароля в чате! Ввожу...");
            bot.chat('/l qwerty123');
        }
    });

    // 2. ЛОГИКА СПАВНА
    bot.once('spawn', async () => {
        console.log(">>> [EXTRA] Событие SPAWN сработало! Бот в мире.");

        await sleep(2000);
        if (!loginDone) {
             bot.chat('/l qwerty123');
             console.log(">>> [1/3] Пароль отправлен");
        }

        await sleep(3000);
        console.log(">>> [2/3] Пробую переход на S7...");
        bot.chat('/s7');

        await sleep(5000); 
        
        console.log(">>> [3/3] Варп и клан...");
        bot.chat('/warp ch');
        await sleep(1500);
        bot.chat('/c join ChertHouse');

        await sleep(2000);
        
        if (bot.entity && bot.entity.position) {
            startPos = bot.entity.position.clone();
            isReady = true;
            loginDone = true;
            console.log(`>>> [ГЛОБАЛ] ПОБЕДА! Координаты: ${startPos}`);
            startLoops();
        } else {
            console.log(">>> [WARN] Координаты не получены, но запускаю циклы...");
            isReady = true;
            startLoops();
        }
    });

    function startLoops() {
        console.log(">>> [SYSTEM] Все циклы запущены.");

        // А. Контроль позиции
        setInterval(() => {
            if (!isReady || !startPos || !bot.entity) return;
            try {
                if (bot.entity.position.distanceTo(startPos) > 2.0) {
                    // console.log(">>> [EXTRA] Возврат на точку...");
                    bot.chat('/warp ch');
                }
            } catch (e) {}
        }, 1000);

        // Б. Реклама ГЛОБАЛ
        setInterval(() => {
            if (!isReady) return;
            console.log(">>> [ГЛОБАЛ] Реклама отправлена.");
            const msg = AD_TEXT[Math.floor(Math.random() * AD_TEXT.length)];
            bot.chat(msg);
        }, 120 * 1000);

        // В. Реклама КЛАН
        setInterval(() => {
            if (!isReady) return;
            console.log(">>> [КЛАН] Реклама отправлена.");
            const msg = AD_CLAN[Math.floor(Math.random() * AD_CLAN.length)];
            bot.chat(`/cc ${msg}`);
        }, 190 * 1000);

        // Г. СКАНЕР ИГРОКОВ
        setInterval(() => {
            if (!bot.entity || !isReady) return;

            const now = Date.now() / 1000;
            const entities = bot.entities;
            const activeNow = new Set();

            for (const id in entities) {
                const entity = entities[id];
                if (entity.type === 'player' && entity.username !== bot.username) {
                    const p1 = bot.entity.position;
                    const p2 = entity.position;

                    if (!p1 || !p2) continue;

                    const dist = p1.distanceTo(p2);

                    if (dist < 15.0) {
                        const name = entity.username;
                        activeNow.add(name);

                        const lastSeen = nearbyPlayers[name] || 0;
                        if ((now - lastSeen) > 20) {
                            console.log(`>>> [ЛОКАЛ] Инвайт игроку: ${name} (${dist.toFixed(1)}м)`);
                            bot.chat(`/clan invite ${name}`);
                            nearbyPlayers[name] = now;
                        }
                    }
                }
            }
            
            // Чистка
            for (const name in nearbyPlayers) {
                if (!activeNow.has(name) && (now - nearbyPlayers[name] > 10)) {
                    delete nearbyPlayers[name];
                }
            }
        }, 500);
    }

    bot.on('error', (err) => console.log(`!!! ОШИБКА БОТА: ${err.message}`));
    bot.on('end', (reason) => {
        console.log(`>>> Бот отключился (Причина: ${reason}). Рестарт 5 сек...`);
        setTimeout(createBot, 5000);
    });

    // Анти-AFK
    setInterval(() => {
        if(bot.entity) {
            bot.look(bot.entity.yaw + (Math.random() - 0.5), bot.entity.pitch, true);
        }
    }, 30000);
}

createBot();
