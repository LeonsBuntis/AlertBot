const EventEmitter = require('events');
const moment = require('moment-timezone');
const bossTimers = require('./bossTimers.js');

class alertService {

    constructor(logger, messager) {
        this._logger = logger;
        this._emitter = new EventEmitter();
        this._messager = messager;

        this._alertSubscribers = [
            // "533996920780357652",   // FAKEL
            "534287393272889346"    // TEST
        ];
        this._firstDelay = 20;
        this._secondDelay = 10;
        this._now = () => moment().utc();
    }

    addSubscriber(channelId) {
        this._alertSubscribers.push(channelId);
    }

    removeSubscriber(channelId) {
        this._alertSubscribers.splice(this._alertSubscribers.indexOf(channelId), 1);
    }

    getUpcomingBossAlerts() {
        var messages = [];
        bossTimers
            .filter(bt => bt.weekDay === this._now().day())
            .forEach(bossTimer => {
                let nowTime = bossTimer.time.utc();
                let firstTime = bossTimer.time.clone().subtract(this._firstDelay, 'minutes').utc();
                let secondTime = bossTimer.time.clone().subtract(this._secondDelay, 'minutes').utc();
                if (firstTime.hours() === this._now().hours() &&
                    firstTime.minutes() === this._now().minutes()) {
                    messages.push(`@here ${bossTimer.bossName} через ${this._firstDelay} минут!`);
                }
                if (secondTime.hours() === this._now().hours() &&
                    secondTime.minutes() === this._now().minutes()) {
                    messages.push(`@here ${bossTimer.bossName} через ${this._secondDelay} минут!`);
                }
                if (nowTime.hours() === this._now().hours() &&
                    nowTime.minutes() === this._now().minutes()) {
                    messages.push(`@here ${bossTimer.bossName} реснулся!`);
                }
            });
        return messages;
    }

    setupAlerts() {
        this._emitter.on('checkAlerts', () => {
            this._logger.debug(`${this._now().format()} checkAlerts!`);

            if (!this._alertSubscribers || this._alertSubscribers.length === 0) {
                this._logger.info(`No subscribers!`);
                return;
            }

            var alerts = this.getUpcomingBossAlerts();
            if (!alerts || alerts.length === 0) {
                this._logger.info(`No alerts!`);
                return;
            }

            this._alertSubscribers.forEach(subscriber =>
                alerts.forEach(alert => this._messager.send(subscriber, alert)));
        });

        let timeout = ((60 - moment().seconds() + 1) * 1000);
        this._logger.info(`Timeout: ${timeout}`);

        setTimeout(() => {
            this._logger.info(`start interval at ${moment().seconds()}`);
            setInterval(() => this._emitter.emit('checkAlerts'), 60000);
        }, timeout);
    }
}

module.exports = alertService;
