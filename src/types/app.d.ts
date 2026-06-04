import 'iron-session';

declare module 'iron-session' {
  interface IronSessionData {
    user?: any;
    regPending?: any;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    __rtNotify?: any;
    notify?: any;
    uiConfirm?: any;
  }
}

export {};

declare global {
  interface Object {
    [key: string]: any;
  }
  interface EventTarget {
    style?: any;
    src?: any;
    closest?: any;
    value?: any;
    checked?: any;
    files?: any;
  }
  interface Element {
    style?: any;
  }
}

declare global {
  interface Window {
    showMsg?: any;
    dispatchNotify?: any;
    __rtNotifyReady?: any;
    __rtOriginalAlert?: any;
  }
}
