const Discord = require('discord.io');
const winston = require('winston');
const moment = require('moment-timezone');

const auth = require('./auth.json');

const weekDays = require('./app/weekDays.js');
const BossTimer = require('./app/BossTimer.js');
const bossTimers = require('./app/bossTimers.js');
const messageHanlder = require('./app/messageHandler.js');
const alertService = require('./app/alertService.js');
const messager = require('./app/messager.js');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

logger.add(new winston.transports.Console({
    format: winston.format.simple()
}));

// Initialize Discord Bot
const bot = new Discord.Client({
    token: auth.token,
    autorun: true
});

const _messager = new messager(logger, bot);
const _alertService = new alertService(logger, _messager);

bot.on('ready', function (evt) {
    handleReady(evt);
});

bot.on('message', function (user, userID, channelID, message, evt) {
    handleMessage(user, userID, channelID, message, evt);
});

bot.on('disconnect', function (msg, code) {
    logger.info("Bot disconnected");
    if (code === 0)
        return logger.error(msg);
    bot.connect();
});

const now = () => moment().tz("Europe/Moscow");

const availableCommands = [
    { command: 'help', displayName: '!help', description: 'Available commands.' },
    { command: 'time', displayName: '!time', description: 'Current bot time.' },
    { command: 'setDefaultChannel', displayName: '!setDefaultChannel <channelId>', description: 'Set default channel Id where bot posts announcements.' },
    { command: 'weekDays', displayName: '!weekDays', description: 'Available week days.' },
    { command: 'today', displayName: '!b [today | td]', description: 'Displaying bosses for today commands.' },
    { command: 'tomorrow', displayName: '!b [tomorrow | tw]', description: 'Displaying bosses for tomorrow commands.' },
    { command: 'add', displayName: '!b add <weekDay> <time> <bossName>)', description: 'Appending new boss to boss\'.' },
];

const handleMessage = function (user, userID, channelID, message, evt) {
    // ignore self mesages
    if (userID === "397451898149535744")
        return;

    if (message.substring(0, 1) != '!')
        return;

    logger.info('Recieved message: ');
    logger.info(message);

    var args = message.substring(1).split(' ');
    var cmd = args[0];

    switch (cmd) {
        case 'help':
            handleHelpCommand(channelID);
            break;
        case 'time':
            handleTimeCommand(channelID);
            break;
        case 'mute':
            _alertService.removeSubscriber(channelID);
            _messager.send(channelID, `I ain't gonna spam here no more.`);
            break;
        case 'subscribe':
            _alertService.addSubscriber(channelID);
            _messager.send(channelID, `This is the channel where ama bout to spam!`);
            break;
        case 'weekDays':
            _messager.send(channelID, weekDays.join(', '));
            break;
        case 'b':
            switch (args[1]) {
                case 'today':
                case 'td':
                    handleTodayCommand(channelID);
                    break;
                case 'tomorrow':
                case 'tw':
                    handleTomorrowCommand(channelID);
                    break;
                case 'add':
                    addBoss(args[2], args[3], args[4]);
                    _messager.send(channelID, `Boss alert created for:\r\n${args[2]}, ${args[3]}, ${args[4]}`);
                    break;
                default:
                    _messager.send(channelID, 'Unrecognized command!');
                    break;
            }
            break;
    }

};

const handleHelpCommand = function (channelID) {
    let message = availableCommands
        .filter(c => c.displayName != null)
        .map(c => `${c.displayName} - ${c.description}`)
        .join('\r\n');

    _messager.send(channelID, message);
};

const handleTimeCommand = function (channelID) {
    _messager.send(channelID, now());
};

const handleTodayCommand = function (channelID) {
    let announcementMessage = bossTimers
        .filter(e => e.weekDay === now().weekday())
        .map(e => `${e.time.format('HH:mm')}, ${e.bossName}`)
        .join(',\r\n');

    _messager.send(channelID, `${weekDays[now().weekday()]}:\r\n${announcementMessage}`);
};

const handleTomorrowCommand = function (channelID) {
    let announcementMessage = bossTimers
        .filter(e => e.weekDay === now().clone().add(1, 'days').weekday())
        .map(e => `${e.time.format('HH:mm')}, ${e.bossName}`)
        .join(',\r\n');

    _messager.send(channelID, `${weekDays[now().clone().add(1, 'days').weekday()]}:\r\n${announcementMessage}`);
};

const handleReady = function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');

    _alertService.setupAlerts();
};

const addBoss = function (weekDay, time, bossName) {
    let bossTimer = new BossTimer(weekDay, time, bossName);
    bossTimers.push(bossTimer);
};
