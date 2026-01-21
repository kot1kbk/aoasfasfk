const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');

const CONFIG = {
    host: 'ru.masedworld.net',
    port: 25565,
    username: 'Ezzka2134q111e',
    version: '1.16.5',
    auth: 'offline'
};

const AD_TEXT = [
    "!&4&lChert&0&lHouse&f. Место &l&cсильнейших&f. Здесь формируются &eальянсы&f, строятся &aимперии &fи пишется история сервера. Ты - &nследующий&f. &l&e/c join ChertHouse. /warp ch.",
"!&4&lChert&0&lHouse &f- не просто клан, а &n&cимперия&f. Идеальный &aпорядок&f, &eсильное сообщество &fи лучший персонал. Это уровень, к которому &eстремятся&f. Присоединяйтесь к сильным: &l&e/c join ChertHouse",
"!&4&lChert&0&lHouse &f- для тех, кто выбирает &eрезультат&f. &cСильная команда&f, &aчеткая организация&f, &nлучшие условия для игры&f. Здесь строят проекты. Здесь добиваются целей. &e&l/c join ChertHouse",
"!&fПривет! Хочешь себе &6донат&f, но нет возможности &aкупить &fего? У нас в клане проводится частые &c&lРОЗЫГРЫШИ&f! Успей попытать &aудачу&f и вступай к нам в &eклан&f! &e&l/c join ChertHouse",
"!&fПриветик! Хочешь с &dкайфом &fпровести время, но не знаешь как? Тогда тебе подойдёт &cклан &4&lChert&0&lHouse &f! У нас ты найдёшь &eхороший кх&f, &bтоповый кит &fи &nдрузей&f. Чтоб вступить в клан пиши &c/warp CH",
"!&fХочешь в &dкрутой клан &fс многими &eплюшками? Тогда тебе нужен клан &4&lChert&0&lHouse&f ! У нас ты не только найдёшь &bтоповый кит для пвп&f и&e хороший кх&f, но и тг группу. А так же у нас открыт набор на модераторов! &c/warp CH",
"!&fИщешь &aотличный клан &fс &eкрутыми возможностями&f? Тогда тебе подходит клан &4&lChert&0&lHouse &f! &bТоповый кит&f, &6бот&f, всё это ты найдёшь на &c/warp ch&f . Ждём именно тебя!",
"!&eТоповый кх&f, &bахеренный кит&f, всё это есть в клане &4&lChetrt&0&lHouse&f! Ощути весь кайф в &cнашем клане&f, побывай в нашей &aтг группе &fи не только! Просто напиши &e/c join ChertHouse &f!",
]

const AD_CLAN = [
    "&fПривет, путник! Хочешь найти друга? Или просто пообщаться с соклановцами? У нас для этого есть тг-чат! &a&l@cherthouse_clan",
"&fХочешь себе донат? Розыгрыш уже идет в нашем телеграм-чате. Успей -> &a&l@cherthouse_clan",
"Начинается розыгрыш! Разыгрываем донат-кейсы среди участников нашего телеграм-чата. Стань своим - переходи и участвуй. -> &a&l@cherthouse_clan",
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createBot() {
    console.log(`>>> [NET] Подключение к ${CONFIG.host}...`);

    const bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username,
        version: CONFIG.version,
        auth: CONFIG.auth,
        hideErrors: false,
        checkTimeoutInterval: 60000, // Увеличиваем таймаут для плохого соединения
        viewDistance: 'tiny'
    });

    bot.loadPlugin(pathfinder);

    let startPos = null;
    let isReady = false;
    let loginDone = false;
    let nearbyPlayers = {};
    let spawnTimeout = null;
    let worldReceived = false; // Ключевой флаг: мир получен

    const setSpawnTimeout = () => {
        if (spawnTimeout) clearTimeout(spawnTimeout);
        spawnTimeout = setTimeout(() => {
            if (!isReady) {
                console.log(">>> [TIMEOUT] Бот завис. Перезапуск...");
                bot.quit();
            }
        }, 25000); // 25 секунд на всё
    };

    setSpawnTimeout();

    // 1. Событие "login" - соединение установлено
    bot.on('login', () => {
        console.log(">>> [NET] Соединение установлено.");
        worldReceived = false; // Сброс флага
    });

    // 2. Ключевое событие: пакеты мира получены
    bot.on('world', () => {
        console.log(">>> [WORLD] Данные мира получены. Можно действовать.");
        worldReceived = true;
        startLogicSequence(bot); // Запускаем основную логику
    });

    // 3. Обработка сообщений от сервера (для авторизации)
    bot.on('message', async (jsonMsg) => {
        const msg = jsonMsg.toString();
        console.log(`>>> [MSG] ${msg}`); // Логируем ВСЕ сообщения для отладки

        if (!loginDone && (msg.toLowerCase().includes('войти') || msg.toLowerCase().includes('/login') || msg.toLowerCase().includes('login'))) {
            console.log(">>> [AUTH] Требуется авторизация. Отправляю /l qwerty123");
            bot.chat('/l qwerty123');
            loginDone = true;
        }
    });

    // 4. spawn - резервный вариант, если сработает
    bot.on('spawn', async () => {
        console.log(">>> [SPAWN] Событие spawn получено.");
        if (spawnTimeout) clearTimeout(spawnTimeout);
        // Если последовательность логики ещё не запускалась, запускаем её
        if (!isReady) {
            startLogicSequence(bot);
        }
    });

    // 5. Обработка ошибок и дисконнекта
    bot.on('error', (err) => console.log(`>>> [ERR] ${err.message}`));
    bot.on('end', (reason) => {
        if (spawnTimeout) clearTimeout(spawnTimeout);
        console.log(`>>> [DISCONNECT] Причина: ${reason}. Рестарт через 5с...`);
        setTimeout(createBot, 5000);
    });

    // ОСНОВНАЯ ФУНКЦИЯ ЛОГИКИ ВХОДА
    async function startLogicSequence(botInstance) {
        if (isReady) return; // Уже запущено
        console.log(">>> [LOGIC] Начинаю последовательность входа...");

        // Шаг 1: Авторизация (если ещё не сделана)
        if (!loginDone) {
            console.log(">>> [1/3] Отправляю пароль...");
            botInstance.chat('/l qwerty123');
            loginDone = true;
            await sleep(3000); // Пауза после пароля
        }

        // Шаг 2: Переход на нужный сервер (s7)
        console.log(">>> [2/3] Переход на S7...");
        botInstance.chat('/s7');
        await sleep(5000); // Пауза для телепортации

        // Шаг 3: Варп и вступление в клан
        console.log(">>> [3/3] Варп и вступление в клан...");
        botInstance.chat('/warp ch');
        await sleep(2000);
        botInstance.chat('/c join ChertHouse');
        await sleep(3000);

        // Фиксация позиции и запуск циклов
        if (botInstance.entity && botInstance.entity.position) {
            startPos = botInstance.entity.position.clone();
            isReady = true;
            console.log(`>>> [SUCCESS] Бот готов! Точка: ${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}`);
            if (spawnTimeout) clearTimeout(spawnTimeout);
            startLoops(botInstance, startPos, nearbyPlayers);
        } else {
            // Если позиции нет, всё равно запускаем циклы
            isReady = true;
            console.log(">>> [SUCCESS] Бот готов (позиция не зафиксирована).");
            if (spawnTimeout) clearTimeout(spawnTimeout);
            startLoops(botInstance, null, nearbyPlayers);
        }
    }
}

// ФУНКЦИЯ ЗАПУСКА ЦИКЛОВ (АДАПТИРОВАННАЯ)
function startLoops(bot, startPos, nearbyPlayers) {
    console.log(">>> [SYSTEM] Основные циклы запущены.");

    // 1. Контроль позиции (только если есть startPos)
    if (startPos) {
        setInterval(() => {
            if (!bot.entity || !bot.entity.position) return;
            if (bot.entity.position.distanceTo(startPos) > 2.5) {
                console.log(">>> [POS] Смещение! Возврат на варп...");
                bot.chat('/warp ch');
            }
        }, 2000);
    }

    // 2. Глобальная реклама (120с)
    setInterval(() => {
        const msg = AD_TEXT[Math.floor(Math.random() * AD_TEXT.length)];
        bot.chat(msg);
        console.log(">>> [SEND] Глобал реклама");
    }, 120000);

    // 3. Клан реклама (190с)
    setInterval(() => {
        const msg = AD_CLAN[Math.floor(Math.random() * AD_CLAN.length)];
        bot.chat(`/cc ${msg}`);
        console.log(">>> [SEND] Клан реклама");
    }, 190000);

    // 4. Сканер игроков (инвайты)
    setInterval(() => {
        if (!bot.entity) return;
        const now = Date.now() / 1000;
        const activeNow = new Set();

        for (const id in bot.entities) {
            const entity = bot.entities[id];
            if (entity && entity.type === 'player' && entity.username !== bot.username) {
                const dist = bot.entity.position.distanceTo(entity.position);
                if (dist < 15) {
                    const name = entity.username;
                    activeNow.add(name);
                    const lastSeen = nearbyPlayers[name] || 0;
                    if (now - lastSeen > 20) {
                        console.log(`>>> [INVITE] ${name} (${dist.toFixed(1)}m)`);
                        bot.chat(`/clan invite ${name}`);
                        nearbyPlayers[name] = now;
                    }
                }
            }
        }
        // Очистка старых записей
        for (const name in nearbyPlayers) {
            if (!activeNow.has(name) && now - nearbyPlayers[name] > 15) {
                delete nearbyPlayers[name];
            }
        }
    }, 1000);

    // 5. Анти-АФК
    setInterval(() => {
        if (bot.entity) {
            bot.look(bot.entity.yaw + (Math.random() - 0.5), bot.entity.pitch, true);
        }
    }, 30000);
}

createBot();
