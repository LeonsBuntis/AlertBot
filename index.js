const Discord = require('discord.io');
const winston = require('winston');
const moment = require('moment-timezone');
const EventEmitter = require('events');

const auth = require('./auth.json');

const weekDays = require('./app/weekDays.js');
const BossTimer = require('./app/BossTimer.js');
const bossTimers = require('./app/bossTimers.js');

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

var firstDelay = 20;
var secondDelay = 10;

var defaultChannelID = "534287393272889346";

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

const emitter = new EventEmitter();
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
    if (userID === "397451898149535744")
        return;

    if (message.substring(0, 1) == '!') {

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
            case 'setDefaultChannel':
                defaultChannelID = args[1];
                bot.sendMessage({
                    to: defaultChannelID,
                    message: `This is the channel where ama bout to spam!`
                }, (err, resp) => handleCallback(err, resp));
                break;
            case 'weekDays':
                bot.sendMessage({
                    to: channelID,
                    message: weekDays.join(', ')
                }, (err, resp) => handleCallback(err, resp));
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
                        bot.sendMessage({
                            to: channelID,
                            message: `Boss alert created for:\r\n${args[2]}, ${args[3]}, ${args[4]}`
                        }, (err, resp) => handleCallback(err, resp));
                        break;
                    default:
                        bot.sendMessage({
                            to: channelID,
                            message: 'Unrecognized command!'
                        }, (err, resp) => handleCallback(err, resp));
                        break;
                }
                break;
        }
    }
};

const handleHelpCommand = function (channelID) {
    let message = availableCommands
        .filter(c => c.displayName != null)
        .map(c => `${c.displayName} - ${c.description}`)
        .join('\r\n');

    bot.sendMessage({
        to: channelID,
        message: message
    }, (err, resp) => handleCallback(err, resp));
};

const handleTimeCommand = function (channelID) {
    bot.sendMessage({
        to: channelID,
        message: now()
    }, (err, resp) => handleCallback(err, resp));
};

const handleTodayCommand = function (channelID) {
    let announcementMessage = bossTimers
        .filter(e => e.weekDay === now().weekday())
        .map(e => `${e.time.format('HH:mm')}, ${e.bossName}`)
        .join(',\r\n');
    bot.sendMessage({
        to: channelID,
        message: `${weekDays[now().weekday()]}:\r\n${announcementMessage}`
    }, (err, resp) => handleCallback(err, resp));
};

const handleTomorrowCommand = function (channelID) {
    let announcementMessage = bossTimers
        .filter(e => e.weekDay === now().clone().add(1, 'days').weekday())
        .map(e => `${e.time.format('HH:mm')}, ${e.bossName}`)
        .join(',\r\n');
    bot.sendMessage({
        to: channelID,
        message: `${weekDays[now().clone().add(1, 'days').weekday()]}:\r\n${announcementMessage}`
    }, (err, resp) => handleCallback(err, resp));
};

const handleCallback = function (err, resp) {
    logger.info(`sendMessage response -> ${resp}`);
    handleError(err);
};

const handleError = function (err) {
    if (!err)
        return;

    logger.error(`sendMessage error -> ${err}`);
    if (!!err.response && !!err.response.content)
        err.response.content.forEach(e => logger.error(`error content -> ${e}`));
};

const handleReady = function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');

    bot.sendMessage({
        to: defaultChannelID,
        message: `Hi!\r\nType \'!help\' to see available commands.`
    }, (err, resp) => handleCallback(err, resp));

    launchAnnouncements();
};

const launchAnnouncements = function () {
    emitter.on('bossUp', () => {
        logger.info('bossUp');
        var alerts = getUpcomingBossAlerts();

        if (alerts && alerts.length > 0) {
            alerts.forEach(alert => bot.sendMessage({
                to: defaultChannelID,
                message: alert
            }, (err, resp) => handleCallback(err, resp)));
        }
    });

    let timeout = ((60 - moment().seconds() + 1) * 1000);
    logger.info(`Timeout: ${timeout}`);

    setTimeout(() => {
        logger.info(`start interval at ${moment().seconds()}`);
        setInterval(() => emitter.emit('bossUp'), 60000);
    }, timeout);
};

const getUpcomingBossAlerts = function () {
    var messages = [];
    bossTimers
        .filter(bt => bt.weekDay === now().day())
        .forEach(bossTimer => {
            let nowTime = bossTimer.time.tz("Europe/Moscow");
            let firstTime = bossTimer.time.tz("Europe/Moscow").clone().subtract(firstDelay, 'minutes');
            let secondTime = bossTimer.time.tz("Europe/Moscow").clone().subtract(secondDelay, 'minutes');
            if (firstTime.hours() === now().hours()
                && firstTime.minutes() === now().minutes()) {
                messages.push(`@here ${bossTimer.bossName} через ${firstDelay} минут!`);
            }
            if (secondTime.hours() === now().hours()
                && secondTime.minutes() === now().minutes()) {
                messages.push(`@here ${bossTimer.bossName} через ${secondDelay} минут!`);
            }
            if (nowTime.hours() === now().hours()
                && nowTime.minutes() === now().minutes()) {
                messages.push(`@here ${bossTimer.bossName} реснулся!`);
            } 
        });
    return messages;
};

const addBoss = function (weekDay, time, bossName) {
    let bossTimer = new BossTimer(weekDay, time, bossName);
    bossTimers.push(bossTimer);
};
