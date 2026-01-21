const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');

const CONFIG = {
    host: 'ru.masedworld.net',
    port: 25565,
    username: 'Ezzka2134q111e',
    version: '1.16.5',
    auth: 'offline'
};

// ... (массивы AD_TEXT и AD_CLAN, функция sleep остаются без изменений)

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
