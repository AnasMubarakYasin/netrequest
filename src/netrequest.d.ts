import { Emitter, EventEmitter, ListenerHandler, ListenerOptions, ListenerId } from '../lib/custom-emitter/src/emitter';
export interface NetRequestSpec {
    ready: Promise<Response>;
    result: Response | unknown;
    state: NetRequestState;
    setOptions<K extends keyof NetRequestInit>(name: K, value: NetRequestInit[K]): void;
    getOptions<K extends keyof NetRequestInit>(name: K): NetRequestInit[K];
    update(init: NetRequestInit): void;
    try(retryTime: Second): void;
    send(): void;
    abort(): void;
    after(callback: AfterCallback): void;
    before(callback: BeforeCallback): void;
}
export interface NetRequestInit {
    cacheable?: boolean;
    timeOut?: Second;
    method: Method;
    mode: Mode;
    url: string;
    headers: HeadersInit;
    body: BodyInit;
}
export declare type AfterCallback = (response: Response) => unknown;
export declare type BeforeCallback = (request: Request) => Request;
export declare type Second = number;
export declare type NetRequestEvent = 'success' | 'failed';
export declare type NetRequestState = 'pending' | 'fullfilled' | 'rejected' | 'init';
export declare type Mode = 'cors' | 'same-origin' | 'navigate' | 'no-cors';
export declare type Method = 'GET' | 'POST';
export declare class NetRequestFailedEvent extends EventEmitter {
    error: any;
    request: Request;
    constructor(error: any, request: Request, instance: NetRequest);
}
export declare class NetRequestSuccessEvent extends EventEmitter {
    result: Response | unknown;
    constructor(result: Response | unknown, instance: NetRequest);
}
export declare class NetRequest extends Emitter implements NetRequestSpec {
    ready: Promise<Response>;
    result: unknown;
    state: NetRequestState;
    private abortController;
    private request;
    private response;
    private init;
    private callbackAfter;
    private callbackBefore;
    private retTryTimer;
    private timeOut;
    private log;
    private readyTrigger;
    constructor(init: NetRequestInit);
    try(retryTime?: Second): void;
    setOptions<K extends keyof NetRequestInit>(name: K, value: NetRequestInit[K]): void;
    getOptions<K extends keyof NetRequestInit>(name: K): NetRequestInit[K];
    update(init: NetRequestInit): void;
    send(): void;
    abort(): void;
    after(callback: AfterCallback): void;
    before(callback: BeforeCallback): void;
    on(type: NetRequestEvent, handler: ListenerHandler, options: ListenerOptions): ListenerId;
}
