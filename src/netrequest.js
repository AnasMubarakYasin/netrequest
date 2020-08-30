/* eslint-disable max-len */
import { Emitter, EventEmitter } from '../lib/custom-emitter/src/emitter';
import { Log } from '../lib/custom-log/index';
export class NetRequestFailedEvent extends EventEmitter {
    constructor(error, request, instance) {
        super('failed');
        this.error = error;
        this.request = request;
        this.sender = instance;
    }
}
export class NetRequestSuccessEvent extends EventEmitter {
    constructor(result, instance) {
        super('success');
        this.result = result;
        this.sender = instance;
    }
}
export class NetRequest extends Emitter {
    constructor(init) {
        super();
        this.ready = Promise.resolve(new Response());
        this.state = 'init';
        this.abortController = new AbortController();
        this.request = new Request('');
        this.response = new Response();
        this.callbackAfter = [];
        this.callbackBefore = [];
        this.retTryTimer = 0;
        this.timeOut = 0;
        this.log = new Log('Network Request Internal');
        this.readyTrigger = undefined;
        this.log.start('init');
        this.update(init);
        this.after((response) => {
            if (this.init.cacheable) {
                caches.open('Network Request Internal')
                    .then((cache) => {
                    cache.put(this.request, response.clone());
                });
            }
            return response;
        });
        this.log.finish('init');
    }
    try(retryTime) {
        this.log.start('try');
        if (this.state !== 'rejected') {
            this.log.error('try', `the Request has ${this.state}, so can\'t try Request`);
            this.log.finish('try');
            return undefined;
        }
        if (retryTime) {
            this.retTryTimer = window.setInterval(this.send.bind(this), retryTime);
        }
        else {
            this.send();
        }
        this.log.finish('try');
    }
    setOptions(name, value) {
        this.init[name] = value;
        this.update(this.init);
    }
    getOptions(name) {
        return this.init[name];
    }
    update(init) {
        this.log.start('update');
        init.cacheable = init?.cacheable || false;
        init.timeOut = init?.timeOut || 0;
        this.abortController = new AbortController();
        this.request = new Request(init.url, {
            method: init.method || 'GET',
            mode: init.mode || 'cors',
            headers: init.headers || undefined,
            body: init.body || undefined,
            signal: this.abortController.signal,
        });
        this.init = init;
        this.ready = new Promise((resolve, reject) => {
            this.readyTrigger = resolve;
        });
        this.log.finish('update');
    }
    send() {
        this.log.start('send');
        const timer = this.init.timeOut;
        this.callbackBefore.forEach((callback) => {
            this.request = callback(this.request) || this.request;
        });
        this.log.start('fetching');
        fetch(this.request)
            .then((response) => {
            this.response = response;
            return Promise.resolve(this.response);
        })
            .then((response) => {
            if (this.timeOut) {
                window.clearTimeout(this.timeOut);
            }
            if (this.retTryTimer) {
                window.clearInterval(this.retTryTimer);
            }
            this.callbackAfter.forEach((callback) => {
                this.result = callback(response.clone()) || response;
            });
            this.state = 'fullfilled';
            this.emit(new NetRequestSuccessEvent(this.result, this));
        })
            .catch((reason) => {
            this.state = 'rejected';
            this.emit(new NetRequestFailedEvent(reason, this.request, this));
        })
            .finally(() => {
            this.readyTrigger(this.result);
            this.log.finish('fetching');
        });
        this.state = 'pending';
        if (timer) {
            this.timeOut = window.setTimeout(() => {
                this.abort();
            }, timer);
        }
        this.log.finish('send');
    }
    abort() {
        this.log.start('abort');
        if (this.state !== 'pending') {
            this.log.error('abort', `the Request has ${this.state}, so can\'t abort request`);
            this.log.finish('abort');
            return undefined;
        }
        this.abortController.abort();
        if (this.retTryTimer) {
            window.clearInterval(this.retTryTimer);
        }
        this.update(this.init);
        this.log.finish('abort');
    }
    after(callback) {
        this.callbackAfter.push(callback);
    }
    before(callback) {
        this.callbackBefore.push(callback);
    }
    // eslint-disable-next-line max-len
    on(type, handler, options) {
        return super.on(type, handler, options);
    }
}
