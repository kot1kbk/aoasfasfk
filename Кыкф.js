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

const KICK_THRESHOLD = 5;
const DATA_FILE = 'clan_data.json';
const FLY_COOLDOWN = 300; // 5 минут в секундах

// Список админов (только они могут использовать команды)
const ADMINS = ['KoTiK_B_KeDaH_', 'marinettko', 'tcftft', CONFIG.username]; // Добавил самого бота для удобства

// Загрузка данных
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('>>> [DATA] Ошибка загрузки:', err);
    }
    return {
        deaths: {},
        blacklist: [],
        flyCooldowns: {}
    };
}

// Сохранение данных
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('>>> [DATA] Данные сохранены');
    } catch (err) {
        console.error('>>> [DATA] Ошибка сохранения:', err);
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
            console.log(`>>> [ANTI-KDR] Игрок ${playerName} превысил лимит (${deaths}). Кикаю...`);
            
            if (!clanData.blacklist.includes(playerName)) {
                clanData.blacklist.push(playerName);
                saveData(clanData);
            }
            
            bot.chat(`/c kick ${playerName} Автоматический кик: превышен лимит смертей (${deaths}) ${deathReason}`);
            delete clanData.deaths[playerName];
            saveData(clanData);
            
            return true;
        }
        return false;
    }

    // Функция проверки кулдауна на флай
    function canUseFly(adminName) {
        const now = Math.floor(Date.now() / 1000);
        const lastUsed = clanData.flyCooldowns[adminName] || 0;
        
        if (now - lastUsed < FLY_COOLDOWN) {
            const remaining = FLY_COOLDOWN - (now - lastUsed);
            return {
                canUse: false,
                remaining: remaining
            };
        }
        
        clanData.flyCooldowns[adminName] = now;
        saveData(clanData);
        return { canUse: true, remaining: 0 };
    }

    // Обработка всех сообщений
    bot.on('message', async (jsonMsg) => {
        const msg = jsonMsg.toString();
        console.log(`>>> [MSG] ${msg}`);
        
        // 1. Авторизация
        if (!loginDone && (msg.toLowerCase().includes('войти') || msg.toLowerCase().includes('/login') || msg.toLowerCase().includes('login'))) {
            console.log(">>> [AUTH] Требуется авторизация. Отправляю /l qwerty123");
            bot.chat('/l qwerty123');
            loginDone = true;
        }
        
        // 2. Анализ смертей для анти-KDR
        const deathMatch = msg.match(/\(([^)]+)\) убил игрока \(([^)]+)\)/);
        if (deathMatch) {
            const [, killer, victim] = deathMatch;
            console.log(`>>> [KDR] Обнаружена смерть: ${killer} -> ${victim}`);
            
            clanData.deaths[victim] = (clanData.deaths[victim] || 0) + 1;
            saveData(clanData);
            
            console.log(`>>> [KDR] ${victim} умер(ла) ${clanData.deaths[victim]} раз`);
            await checkAndKickPlayer(victim, `(убит ${killer})`);
        }
        
        // 3. Вступление в клан (проверка черного списка)
        const joinMatch = msg.match(/Игрок ([^ ]+) вступил в клан/);
        if (joinMatch) {
            const playerName = joinMatch[1];
            
            if (clanData.blacklist.includes(playerName)) {
                console.log(`>>> [ANTI-KDR] Игрок ${playerName} из ЧС вступил в клан. Кикаю...`);
                bot.chat(`/c kick ${playerName} Автоматический кик: вы в черном списке за частые смерти`);
                await sleep(2000);
            }
        }
        
        // 4. Обработка команд из клан-чата
        // Формат: КЛАН: KoTiK_B_KeDaH_: !статистика
        const clanChatMatch = msg.match(/КЛАН: ([^:]+): (.+)/);
        if (clanChatMatch) {
            const [, sender, message] = clanChatMatch;
            
            // Команда !статистика (доступна всем)
            if (message.trim() === '!статистика') {
                const players = Object.keys(clanData.deaths);
                if (players.length > 0) {
                    let response = 'Статистика смертей:';
                    players.forEach(player => {
                        response += `\n${player}: ${clanData.deaths[player]} смертей`;
                    });
                    bot.chat(`/cc ${response}`);
                } else {
                    bot.chat('/cc Статистика смертей пуста.');
                }
            }
            
            // Команды только для админов
            if (ADMINS.includes(sender)) {
                // Команда !чс [игрок] - добавить в черный список
                const blacklistMatch = message.match(/!чс ([^ ]+)/);
                if (blacklistMatch) {
                    const target = blacklistMatch[1];
                    if (!clanData.blacklist.includes(target)) {
                        clanData.blacklist.push(target);
                        saveData(clanData);
                        bot.chat(`/cc Игрок ${target} добавлен в черный список.`);
                        console.log(`>>> [ADMIN] ${sender} добавил ${target} в ЧС`);
                    } else {
                        bot.chat(`/cc Игрок ${target} уже в черном списке.`);
                    }
                }
                
                // Команда !анчс [игрок] - убрать из черного списка
                const unblacklistMatch = message.match(/!анчс ([^ ]+)/);
                if (unblacklistMatch) {
                    const target = unblacklistMatch[1];
                    const index = clanData.blacklist.indexOf(target);
                    if (index > -1) {
                        clanData.blacklist.splice(index, 1);
                        saveData(clanData);
                        bot.chat(`/cc Игрок ${target} удален из черного списка.`);
                        console.log(`>>> [ADMIN] ${sender} удалил ${target} из ЧС`);
                    } else {
                        bot.chat(`/cc Игрок ${target} не найден в черном списке.`);
                    }
                }
                
                // Команда !флай [игрок] - выдать флай (с кулдауном)
                const flyMatch = message.match(/!флай(?: ([^ ]+))?/);
                if (flyMatch) {
                    const target = flyMatch[1] || sender; // Если не указан игрок - выдать себе
                    const cooldownCheck = canUseFly(sender);
                    
                    if (!cooldownCheck.canUse) {
                        const minutes = Math.floor(cooldownCheck.remaining / 60);
                        const seconds = cooldownCheck.remaining % 60;
                        bot.chat(`/cc Кулдаун! Следующая выдача флая через ${minutes}:${seconds.toString().padStart(2, '0')}`);
                        return;
                    }
                    
                    console.log(`>>> [FLY] ${sender} выдал флай игроку ${target}`);
                    bot.chat(`/fly ${target}`);
                    bot.chat(`/cc Флай выдан игроку ${target}. Следующая выдача через 5 минут.`);
                }
            } else {
                // Если не админ пытается использовать админские команды
                if (message.match(/!(чс|анчс|флай)/)) {
                    bot.chat(`/cc ${sender}, у вас нет прав для использования этой команды.`);
                }
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

    // Модифицированная функция сканирования игроков
    function startLoops(bot, startPos, nearbyPlayers) {
        console.log(">>> [SYSTEM] Основные циклы запущены.");

        // Контроль позиции
        if (startPos) {
            setInterval(() => {
                if (!bot.entity || !bot.entity.position) return;
                if (bot.entity.position.distanceTo(startPos) > 2.5) {
                    console.log(">>> [POS] Смещение! Возврат на варп...");
                    bot.chat('/warp ch');
                }
            }, 2000);
        }

        // Глобальная реклама (120с)
        setInterval(() => {
            const msg = AD_TEXT[Math.floor(Math.random() * AD_TEXT.length)];
            bot.chat(msg);
            console.log(">>> [SEND] Глобал реклама");
        }, 120000);

        // Клан реклама (180с = 3 минуты)
        setInterval(() => {
            const msg = AD_CLAN[Math.floor(Math.random() * AD_CLAN.length)];
            bot.chat(`/cc ${msg}`);
            console.log(">>> [SEND] Клан реклама");
        }, 180000);

        // Сканер игроков с проверкой черного списка
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
                        
                        // Пропускаем игроков из черного списка
                        if (clanData.blacklist.includes(name)) {
                            console.log(`>>> [ANTI-KDR] Игрок ${name} в ЧС. Пропускаю инвайт.`);
                            continue;
                        }
                        
                        // Проверяем статистику смертей
                        if (clanData.deaths[name] >= KICK_THRESHOLD) {
                            console.log(`>>> [ANTI-KDR] ${name} имеет ${clanData.deaths[name]} смертей. Добавляю в ЧС.`);
                            if (!clanData.blacklist.includes(name)) {
                                clanData.blacklist.push(name);
                                saveData(clanData);
                            }
                            continue;
                        }
                        
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

        // Анти-АФК
        setInterval(() => {
            if (bot.entity) {
                bot.look(bot.entity.yaw + (Math.random() - 0.5), bot.entity.pitch, true);
            }
        }, 30000);
        
        // Периодическое сохранение данных (каждые 5 минут)
        setInterval(() => {
            saveData(clanData);
        }, 300000);
    }

    // Остальные функции
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
