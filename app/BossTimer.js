const moment = require('moment-timezone');

module.exports = class BossTimer {
    constructor(weekDay, time, bossName) {
        this.weekDay = weekDays.indexOf(weekDay);
        this.time = moment(time, 'HH:mm');
        this.bossName = bossName;
    }
}
