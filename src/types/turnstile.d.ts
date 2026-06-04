declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, any>) => any;
      reset: (widgetId?: any) => void;
      remove: (widgetId?: any) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export {};
