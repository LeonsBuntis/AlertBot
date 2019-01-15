const moment = require('moment-timezone');
const weekDays = require('./weekDays.js');
const BossTimer = require('./BossTimer.js');
const bossTimers = require('./bossTimers.js');

class messageHandlerService {

    constructor(logger, messager, alertService) {
        this._alertService = alertService;
        this._messager = messager;
        this._logger = logger;
        this.availableCommands = [
            { command: 'help', displayName: '!help', description: 'Available commands.' },
            { command: 'time', displayName: '!time', description: 'Current bot time.' },
            { command: 'weekDays', displayName: '!weekDays', description: 'Available week days.' },
            { command: 'today', displayName: '!b [today | td]', description: 'Displaying bosses for today commands.' },
            { command: 'tomorrow', displayName: '!b [tomorrow | tw]', description: 'Displaying bosses for tomorrow commands.' },
            { command: 'add', displayName: '!b add <weekDay> <time> <bossName>)', description: 'Appending new boss to boss\'.' },
            { command: 'subscribe', displayName: '!subscribe', description: 'Subscribes to boss alerts in this channel.' },
            { command: 'mute', displayName: '!mute', description: 'Muting alert bot in this channel.' },
        ];

        this._now = () => moment().tz("Europe/Moscow");
    }

    handleHelpCommand(channelID) {
        let message = this.availableCommands
            .filter(c => c.displayName != null)
            .map(c => `${c.displayName} - ${c.description}`)
            .join('\r\n');

        this._messager.send(channelID, message);
    }

    handleTimeCommand(channelID) {
        this._messager.send(channelID, this._now());
    }

    handleTodayCommand(channelID) {
        let announcementMessage = bossTimers
            .filter(e => e.weekDay === this._now().weekday())
            .map(e => `${e.time.format('HH:mm')}, ${e.bossName}`)
            .join(',\r\n');

        this._messager.send(channelID, `${weekDays[this._now().weekday()]}:\r\n${announcementMessage}`);
    }

    handleTomorrowCommand(channelID) {
        let announcementMessage = bossTimers
            .filter(e => e.weekDay === this._now().clone().add(1, 'days').weekday())
            .map(e => `${e.time.format('HH:mm')}, ${e.bossName}`)
            .join(',\r\n');

        this._messager.send(channelID, `${weekDays[this._now().clone().add(1, 'days').weekday()]}:\r\n${announcementMessage}`);
    }

    handleSubscribe(channelID) {
        let result = this._alertService.addSubscriber(channelID);
        let message = result ? 'This is the channel where ama bout to spam!' : 'This channel is already subscribed to alerts!';
        this._messager.send(channelID, message);
    }

    handleMute(channelID) {
        let result = this._alertService.removeSubscriber(channelID);
        let message = result ? 'I ain\'t gonna spam here no more.' : 'This channel is not subscribed to alerts!';
        this._messager.send(channelID, message);
    }

    handleMessage(user, userID, channelID, message, evt) {
        // ignore self mesages
        if (userID === "397451898149535744")
            return;

        if (message.substring(0, 1) != '!')
            return;

        this._logger.info('Recieved message: ');
        this._logger.info(message);

        var args = message.substring(1).split(' ');
        var cmd = args[0];

        switch (cmd) {
            case 'help':
                this.handleHelpCommand(channelID);
                break;
            case 'time':
                this.handleTimeCommand(channelID);
                break;
            case 'mute':
                this.handleMute(channelID);
                break;
            case 'subscribe':
                this.handleSubscribe(channelID);
                break;
            case 'weekDays':
                this._messager.send(channelID, weekDays.join(', '));
                break;
            case 'b':
                switch (args[1]) {
                    case 'today':
                    case 'td':
                        this.handleTodayCommand(channelID);
                        break;
                    case 'tomorrow':
                    case 'tw':
                        this.handleTomorrowCommand(channelID);
                        break;
                    case 'add':
                        this.addBoss(args[2], args[3], args[4]);
                        this._messager.send(channelID, `Boss alert created for:\r\n${args[2]}, ${args[3]}, ${args[4]}`);
                        break;
                    default:
                        this._messager.send(channelID, 'Unrecognized command!');
                        break;
                }
                break;
        }

    }

    addBoss(weekDay, time, bossName) {
        let bossTimer = new BossTimer(weekDay, time, bossName);
        bossTimers.push(bossTimer);
    }
}

module.exports = messageHandlerService;