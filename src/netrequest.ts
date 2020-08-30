/* eslint-disable max-len */
import {Emitter, EventEmitter, ListenerHandler, ListenerOptions, ListenerId} from '../lib/custom-emitter/src/emitter';
import {Log} from '../lib/custom-log/index';

export interface NetRequestSpec {
  ready: Promise<Response>
  result: Response | unknown
  state: NetRequestState
  setOptions<K extends keyof NetRequestInit>(name: K, value: NetRequestInit[K]): void
  getOptions<K extends keyof NetRequestInit>(name: K): NetRequestInit[K]
  update(init: NetRequestInit): void
  try(retryTime: Second): void
  send(): void
  abort(): void
  after(callback: AfterCallback): void
  before(callback: BeforeCallback): void
}

export interface NetRequestInit {
  cacheable?: boolean
  timeOut?: Second
  method: Method
  mode: Mode
  url: string
  headers: HeadersInit
  body: BodyInit
}

export type AfterCallback = (response: Response) => unknown;
export type BeforeCallback = (request: Request) => Request;
export type Second = number;
export type NetRequestEvent = 'success' | 'failed';
export type NetRequestState = 'pending' | 'fullfilled' | 'rejected' | 'init'
export type Mode = 'cors' | 'same-origin' | 'navigate' | 'no-cors';
export type Method = 'GET' | 'POST';

export class NetRequestFailedEvent extends EventEmitter {
  error: any
  request: Request;
  constructor(error: any, request: Request, instance: NetRequest) {
    super('failed');

    this.error = error;
    this.request = request;
    this.sender = instance;
  }
}

export class NetRequestSuccessEvent extends EventEmitter {
  result: Response | unknown
  constructor(result: Response | unknown, instance: NetRequest) {
    super('success');

    this.result = result;
    this.sender = instance;
  }
}

export class NetRequest extends Emitter implements NetRequestSpec {
  public ready: Promise<Response> = Promise.resolve(new Response());
  public result: unknown;
  public state: NetRequestState = 'init';

  private abortController: AbortController = new AbortController();
  private request: Request = new Request('');
  private response: Response = new Response();
  private init!: NetRequestInit;
  private callbackAfter: Array<AfterCallback> = [];
  private callbackBefore: Array<BeforeCallback> = [];
  private retTryTimer: Second = 0;
  private timeOut: Second = 0;
  private log = new Log('Network Request Internal');
  private readyTrigger: any = undefined;

  constructor(init: NetRequestInit) {
    super();

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
  try(retryTime?: Second): void {
    this.log.start('try');

    if (this.state !== 'rejected') {
      this.log.error(
          'try',
          `the Request has ${this.state}, so can\'t try Request`,
      );
      this.log.finish('try');
      return undefined;
    }

    if (retryTime) {
      this.retTryTimer = window.setInterval(this.send.bind(this), retryTime);
    } else {
      this.send();
    }

    this.log.finish('try');
  }
  setOptions<K extends keyof NetRequestInit>(name: K, value: NetRequestInit[K]): void {
    this.init[name] = value;
    this.update(this.init);
  }
  getOptions<K extends keyof NetRequestInit>(name: K): NetRequestInit[K] {
    return this.init[name];
  }
  update(init: NetRequestInit): void {
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
  send(): void {
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
  abort(): void {
    this.log.start('abort');

    if (this.state !== 'pending') {
      this.log.error(
          'abort',
          `the Request has ${this.state}, so can\'t abort request`,
      );
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
  after(callback: AfterCallback): void {
    this.callbackAfter.push(callback);
  }
  before(callback: BeforeCallback): void {
    this.callbackBefore.push(callback);
  }
  // eslint-disable-next-line max-len
  on(type: NetRequestEvent, handler: ListenerHandler, options: ListenerOptions): ListenerId {
    return super.on(type, handler, options);
  }
}
