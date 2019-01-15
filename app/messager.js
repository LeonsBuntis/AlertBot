class messager {

    constructor(logger, bot) {
        this._bot = bot;
        this._logger = logger;
    }

    handleError(err) {
        if (!err)
            return;

        this._logger.error(`sendMessage error -> ${err}`);
        if (!!err.response && !!err.response.content)
            err.response.content.forEach(e => this._logger.error(`error content -> ${e}`));
    }

    handleCallback(err, resp) {
        this._logger.info(`sendMessage response -> ${resp}`);
        this.handleError(err);
    }

    send(channel, message) {
        this._bot.sendMessage({
            to: channel,
            message: message
        }, (err, resp) => this.handleCallback(err, resp));
    }
}

module.exports = messager;