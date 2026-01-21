const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const fs = require('fs');

const CONFIG = {
    host: 'ru.masedworld.net',
    port: 25565,
    username: 'Ezzka2134q111e',
    version: '1.16.5',
    auth: 'offline'
};

const AD_TEXT = [ /* Ваши сообщения без изменений */ ];
const AD_CLAN = [ /* Ваши сообщения без изменений */ ];

const KICK_THRESHOLD = 5; // После 5 смертей - кик
const DATA_FILE = 'clan_data.json'; // Файл для хранения данных

// Функция загрузки данных
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('>>> [DATA] Ошибка загрузки данных:', err);
    }
    return {
        deaths: {},
        blacklist: []
    };
}

// Функция сохранения данных
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('>>> [DATA] Ошибка сохранения данных:', err);
    }
}

let clanData = loadData();
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
        checkTimeoutInterval: 60000,
        viewDistance: 'tiny'
    });

    bot.loadPlugin(pathfinder);

    let startPos = null;
    let isReady = false;
    let loginDone = false;
    let nearbyPlayers = {};
    let spawnTimeout = null;
    let worldReceived = false;
    let isLogicSequenceRunning = false;

    const setSpawnTimeout = () => {
        if (spawnTimeout) clearTimeout(spawnTimeout);
        spawnTimeout = setTimeout(() => {
            if (!isReady) {
                console.log(">>> [TIMEOUT] Бот завис. Перезапуск...");
                bot.quit();
            }
        }, 25000);
    };

    setSpawnTimeout();

    // Функция проверки и кика игрока
    async function checkAndKickPlayer(playerName, deathReason = '') {
        const deaths = clanData.deaths[playerName] || 0;
        
        if (deaths >= KICK_THRESHOLD) {
            console.log(`>>> [ANTI-KDR] Игрок ${playerName} превысил лимит смертей (${deaths}). Кикаю...`);
            
            // Добавляем в черный список
            if (!clanData.blacklist.includes(playerName)) {
                clanData.blacklist.push(playerName);
                saveData(clanData);
            }
            
            // Пытаемся кикнуть из клана
            bot.chat(`/c kick ${playerName} Автоматический кик: превышен лимит смертей (${deaths}) ${deathReason}`);
            
            // Очищаем статистику после кика
            delete clanData.deaths[playerName];
            saveData(clanData);
            
            return true;
        }
        return false;
    }

    // Обработка системных сообщений о смертях
    bot.on('message', async (jsonMsg) => {
        const msg = jsonMsg.toString();
        console.log(`>>> [MSG] ${msg}`);
        
        // 1. Авторизация
        if (!loginDone && (msg.toLowerCase().includes('войти') || msg.toLowerCase().includes('/login') || msg.toLowerCase().includes('login'))) {
            console.log(">>> [AUTH] Требуется авторизация. Отправляю /l qwerty123");
            bot.chat('/l qwerty123');
            loginDone = true;
        }
        
        // 2. Анализ сообщений о смертях
        // Паттерн: "(игрок1) убил игрока (игрок2)"
        const deathMatch = msg.match(/\(([^)]+)\) убил игрока \(([^)]+)\)/);
        
        if (deathMatch) {
            const [, killer, victim] = deathMatch;
            console.log(`>>> [KDR] Обнаружена смерть: ${killer} -> ${victim}`);
            
            // Если жертва из нашего клана (или любая для отслеживания)
            // Можно добавить проверку: если жертва в нашем клане
            // Для простоты отслеживаем всех
            
            // Увеличиваем счетчик смертей для жертвы
            clanData.deaths[victim] = (clanData.deaths[victim] || 0) + 1;
            saveData(clanData);
            
            console.log(`>>> [KDR] ${victim} умер(ла) ${clanData.deaths[victim]} раз`);
            
            // Проверяем и кикаем если нужно
            await checkAndKickPlayer(victim, `(убит ${killer})`);
        }
        
        // 3. Обработка вступления в клан (если кто-то сам вступил)
        const joinMatch = msg.match(/Игрок ([^ ]+) вступил в клан/);
        if (joinMatch) {
            const playerName = joinMatch[1];
            
            // Если игрок в черном списке - сразу кикаем
            if (clanData.blacklist.includes(playerName)) {
                console.log(`>>> [ANTI-KDR] Игрок ${playerName} из черного списка вступил в клан. Кикаю...`);
                bot.chat(`/c kick ${playerName} Автоматический кик: вы в черном списке за частые смерти`);
                await sleep(2000);
            }
        }
    });

    // Остальные события (без изменений)
    bot.on('login', () => {
        console.log(">>> [NET] Соединение установлено.");
        worldReceived = false;
    });

    bot.on('world', () => {
        console.log(">>> [WORLD] Данные мира получены. Можно действовать.");
        worldReceived = true;
        startLogicSequence(bot);
    });

    bot.on('spawn', async () => {
        console.log(">>> [SPAWN] Событие spawn получено.");
        if (spawnTimeout) clearTimeout(spawnTimeout);
        if (!isReady) {
            startLogicSequence(bot);
        }
    });

    // Модифицированная функция сканирования игроков для проверки черного списка
    function startLoops(bot, startPos, nearbyPlayers) {
        console.log(">>> [SYSTEM] Основные циклы запущены.");

        // 1. Контроль позиции
        if (startPos) {
            setInterval(() => {
                if (!bot.entity || !bot.entity.position) return;
                if (bot.entity.position.distanceTo(startPos) > 2.5) {
                    console.log(">>> [POS] Смещение! Возврат на варп...");
                    bot.chat('/warp ch');
                }
            }, 2000);
        }

        // 2. Глобальная реклама (120с = 2 минуты)
        setInterval(() => {
            const msg = AD_TEXT[Math.floor(Math.random() * AD_TEXT.length)];
            bot.chat(msg);
            console.log(">>> [SEND] Глобал реклама");
        }, 120000);

        // 3. Клан реклама (180с = 3 минуты)
        setInterval(() => {
            const msg = AD_CLAN[Math.floor(Math.random() * AD_CLAN.length)];
            bot.chat(`/cc ${msg}`);
            console.log(">>> [SEND] Клан реклама");
        }, 180000);

        // 4. Сканер игроков (инвайты с проверкой черного списка)
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
                        
                        // ПРОВЕРКА ЧЕРНОГО СПИСКА
                        if (clanData.blacklist.includes(name)) {
                            console.log(`>>> [ANTI-KDR] Игрок ${name} в черном списке. Пропускаю инвайт.`);
                            continue;
                        }
                        
                        const lastSeen = nearbyPlayers[name] || 0;
                        if (now - lastSeen > 20) {
                            // Проверяем статистику смертей перед инвайтом
                            if (clanData.deaths[name] >= KICK_THRESHOLD) {
                                console.log(`>>> [ANTI-KDR] ${name} имеет ${clanData.deaths[name]} смертей. Добавляю в черный список.`);
                                if (!clanData.blacklist.includes(name)) {
                                    clanData.blacklist.push(name);
                                    saveData(clanData);
                                }
                                continue;
                            }
                            
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
        
        // 6. Команды управления для админов (опционально)
        bot.on('message', (jsonMsg) => {
            const msg = jsonMsg.toString();
            
            // Команда для проверки статистики
            if (msg.includes('!статистика') && msg.includes(bot.username)) {
                const players = Object.keys(clanData.deaths);
                if (players.length > 0) {
                    let response = 'Статистика смертей:';
                    players.forEach(player => {
                        response += `\n${player}: ${clanData.deaths[player]} смертей`;
                    });
                    bot.chat(response);
                } else {
                    bot.chat('Статистика смертей пуста.');
                }
            }
            
            // Команда для очистки статистики игрока
            const clearMatch = msg.match(/!очистить ([^ ]+)/);
            if (clearMatch && msg.includes(bot.username)) {
                const playerName = clearMatch[1];
                if (clanData.deaths[playerName]) {
                    delete clanData.deaths[playerName];
                    saveData(clanData);
                    bot.chat(`Статистика для ${playerName} очищена.`);
                }
            }
        });
    }

    // Остальные функции (без изменений)
    bot.on('error', (err) => console.log(`>>> [ERR] ${err.message}`));
    bot.on('end', (reason) => {
        if (spawnTimeout) clearTimeout(spawnTimeout);
        console.log(`>>> [DISCONNECT] Причина: ${reason}. Рестарт через 5с...`);
        setTimeout(createBot, 5000);
    });

    async function startLogicSequence(botInstance) {
        if (isReady || isLogicSequenceRunning) return;
        isLogicSequenceRunning = true;
        console.log(">>> [LOGIC] Начинаю последовательность входа...");

        if (!loginDone) {
            console.log(">>> [1/3] Отправляю пароль...");
            botInstance.chat('/l qwerty123');
            loginDone = true;
            await sleep(3000);
        }

        console.log(">>> [2/3] Переход на S7...");
        botInstance.chat('/s7');
        await sleep(5000);

        console.log(">>> [3/3] Варп и вступление в клан...");
        botInstance.chat('/warp ch');
        await sleep(2000);
        botInstance.chat('/c join ChertHouse');
        await sleep(3000);

        if (botInstance.entity && botInstance.entity.position) {
            startPos = botInstance.entity.position.clone();
            isReady = true;
            console.log(`>>> [SUCCESS] Бот готов! Точка: ${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}`);
            if (spawnTimeout) clearTimeout(spawnTimeout);
            startLoops(botInstance, startPos, nearbyPlayers);
        } else {
            isReady = true;
            console.log(">>> [SUCCESS] Бот готов (позиция не зафиксирована).");
            if (spawnTimeout) clearTimeout(spawnTimeout);
            startLoops(botInstance, null, nearbyPlayers);
        }
    }
}

createBot();
