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

// --- ГЛАВНЫЙ СПАСАТЕЛЬ ОТ ВЫЛЕТОВ ---
// Этот блок ловит ВСЕ ошибки (включая скины), но не дает боту упасть
process.on('uncaughtException', (err) => {
    // Игнорируем ошибки парсинга пакетов и буферов (это и есть скины)
    if (err.message.includes('buffer') || err.message.includes('packet') || err.message.includes('JSON') || err.message.includes('RangeError')) {
        // console.log('>>> [FIX] Сработала защита от вылета (кривой пакет)');
        return; 
    }
    // Если ошибка серьезная - покажем её
    console.error('>>> [ERROR]', err);
});

function createBot() {
    console.log(`>>> [EXTRA] Подключение к ${CONFIG.host}...`);

    const bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username,
        version: CONFIG.version,
        auth: CONFIG.auth,
        hideErrors: false // Видим ошибки, но uncaughtException не даст им убить бота
    });

    // Загружаем плагин физики
    bot.loadPlugin(pathfinder);

    let startPos = null;
    let isReady = false;
    let loginDone = false;
    let nearbyPlayers = {};

    bot.on('login', () => {
        console.log(">>> [NET] Вход в сеть выполнен. Жду спавна...");
    });

    bot.on('kicked', (reason) => {
        console.log("!!! БОТ КИКНУТ !!! Причина:", reason);
    });

    // 1. АВТО-ВВОД ПАРОЛЯ ПРИ ПОЯВЛЕНИИ СООБЩЕНИЯ
    bot.on('message', async (jsonMsg) => {
        const msg = jsonMsg.toString();
        if (!msg.trim()) return;

        if (!loginDone && (msg.toLowerCase().includes("/login") || msg.toLowerCase().includes("войдите"))) {
            console.log(">>> [AUTH] Сервер просит пароль. Ввожу...");
            bot.chat('/l qwerty123');
        }
    });

    // 2. ЛОГИКА ПОСЛЕ ВХОДА (SPAWN)
    bot.once('spawn', async () => {
        console.log(">>> [EXTRA] Бот заспавнился!");

        await sleep(2000);
        if (!loginDone) {
             bot.chat('/l qwerty123');
             console.log(">>> [1/3] Пароль отправлен (страховка)");
        }

        await sleep(3000);
        console.log(">>> [2/3] Переход на S7...");
        bot.chat('/s7');

        await sleep(5000); // Ждем прогрузки нового сервера
        
        console.log(">>> [3/3] Варп и клан...");
        bot.chat('/warp ch');
        await sleep(1500);
        bot.chat('/c join ChertHouse');

        await sleep(2000);
        
        // Попытка получить позицию
        if (bot.entity && bot.entity.position) {
            startPos = bot.entity.position.clone();
            isReady = true;
            loginDone = true;
            console.log(`>>> [ГЛОБАЛ] УСПЕХ! Точка: ${startPos}`);
            startLoops();
        } else {
            console.log(">>> [WARN] Позиция не найдена, но запускаю циклы...");
            isReady = true;
            startLoops();
        }
    });

    function startLoops() {
        console.log(">>> [SYSTEM] Циклы активны.");

        // А. Контроль позиции
        setInterval(() => {
            if (!isReady || !startPos || !bot.entity) return;
            try {
                if (bot.entity.position.distanceTo(startPos) > 2.0) {
                    bot.chat('/warp ch');
                }
            } catch (e) {}
        }, 1000);

        // Б. Реклама ГЛОБАЛ
        setInterval(() => {
            if (!isReady) return;
            const msg = AD_TEXT[Math.floor(Math.random() * AD_TEXT.length)];
            console.log(">>> [ГЛОБАЛ] Реклама отправлена.");
            bot.chat(msg);
        }, 120 * 1000);

        // В. Реклама КЛАН
        setInterval(() => {
            if (!isReady) return;
            const msg = AD_CLAN[Math.floor(Math.random() * AD_CLAN.length)];
            console.log(">>> [КЛАН] Реклама отправлена.");
            bot.chat(`/cc ${msg}`);
        }, 190 * 1000);

        // Г. ИНВАЙТ ИГРОКОВ
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
                            console.log(`>>> [ЛОКАЛ] Инвайт: ${name} (${dist.toFixed(1)}м)`);
                            bot.chat(`/clan invite ${name}`);
                            nearbyPlayers[name] = now;
                        }
                    }
                }
            }
            
            // Очистка памяти
            for (const name in nearbyPlayers) {
                if (!activeNow.has(name) && (now - nearbyPlayers[name] > 10)) {
                    delete nearbyPlayers[name];
                }
            }
        }, 500);
    }

    bot.on('error', (err) => console.log(`!!! Ошибка Mineflayer: ${err.message}`));
    bot.on('end', (reason) => {
        console.log(`>>> Дисконект (${reason}). Рестарт 5 сек...`);
        setTimeout(createBot, 5000);
    });

    // Анти-АФК
    setInterval(() => {
        if(bot.entity) {
            bot.look(bot.entity.yaw + (Math.random() - 0.5), bot.entity.pitch, true);
        }
    }, 30000);
}

createBot();
