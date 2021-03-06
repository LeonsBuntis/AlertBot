const Discord = require('discord.io');
const moment = require('moment-timezone');
const winston = require('winston');
const { format } = winston;
const { combine, timestamp, prettyPrint } = format;
require('winston-daily-rotate-file');

const auth = require('./auth.json');

const messageHanlderService = require('./app/messageHandlerService.js');
const alertService = require('./app/alertService.js');
const messager = require('./app/messager.js');

var transport = new (winston.transports.DailyRotateFile)({
    filename: 'application-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
  });

const logger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        prettyPrint()
      ),
    defaultMeta: { service: 'user-service' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: `combined.log` }),
        transport
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
const _messageHandlerService = new messageHanlderService(logger, _messager, _alertService);

bot.on('ready', function (evt) {
    handleReady(evt);
});

bot.on('message', function (user, userID, channelID, message, evt) {
    _messageHandlerService.handleMessage(user, userID, channelID, message, evt);
});

bot.on('disconnect', function (msg, code) {
    logger.info("Bot disconnected");
    if (code === 0)
        return logger.error(msg);
    bot.connect();
});

const handleReady = function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');

    _alertService.setupAlerts();
};
