export interface AccessibilityConfig {
  enableKeyboardNavigation: boolean;
  enableScreenReaderSupport: boolean;
  enableHighContrast: boolean;
  enableFocusIndicators: boolean;
  enableReducedMotion: boolean;
}
export const defaultAccessibilityConfig: AccessibilityConfig = {
  enableKeyboardNavigation: true,
  enableScreenReaderSupport: true,
  enableHighContrast: false,
  enableFocusIndicators: true,
  enableReducedMotion: false,
};
export class KeyboardNavigationManager {
  private focusableElements: HTMLElement[] = [];
  private currentFocusIndex = -1;
  constructor() {
    this.setupKeyboardListeners();
  }
  private setupKeyboardListeners() {
    document.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'Tab':
          this.handleTabNavigation(event);
          break;
        case 'Escape':
          this.handleEscapeKey(event);
          break;
        case 'Enter':
        case ' ':
          this.handleActivation(event);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          this.handleArrowNavigation(event);
          break;
      }
    });
  }
  private handleTabNavigation(event: KeyboardEvent) {
    this.updateFocusableElements();
    if (this.focusableElements.length === 0) return;
    if (event.shiftKey) {
      this.currentFocusIndex = this.currentFocusIndex <= 0 
        ? this.focusableElements.length - 1 
        : this.currentFocusIndex - 1;
    } else {
      this.currentFocusIndex = this.currentFocusIndex >= this.focusableElements.length - 1 
        ? 0 
        : this.currentFocusIndex + 1;
    }
    event.preventDefault();
    this.focusableElements[this.currentFocusIndex]?.focus();
  }
  private handleEscapeKey(event: KeyboardEvent) {
    const activeModal = document.querySelector('[role="dialog"]:not([hidden])');
    if (activeModal) {
      const closeButton = activeModal.querySelector('[aria-label="Close"], [data-close]');
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
      }
    }
  }
  private handleActivation(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.getAttribute('role') === 'button' || target.tagName === 'BUTTON') {
      target.click();
      event.preventDefault();
    }
  }
  private handleArrowNavigation(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const parent = target.closest('[role="menu"], [role="listbox"], [role="tablist"]');
    if (parent) {
      const items = Array.from(parent.querySelectorAll('[role="menuitem"], [role="option"], [role="tab"]'));
      const currentIndex = items.indexOf(target);
      if (currentIndex !== -1) {
        let nextIndex = currentIndex;
        switch (event.key) {
          case 'ArrowUp':
          case 'ArrowLeft':
            nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
            break;
          case 'ArrowDown':
          case 'ArrowRight':
            nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
            break;
        }
        (items[nextIndex] as HTMLElement)?.focus();
        event.preventDefault();
      }
    }
  }
  private updateFocusableElements() {
    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="menuitem"]:not([disabled])',
      '[role="tab"]:not([disabled])'
    ].join(', ');
    this.focusableElements = Array.from(document.querySelectorAll(selector))
      .filter(el => this.isVisible(el as HTMLElement)) as HTMLElement[];
  }
  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           element.offsetParent !== null;
  }
}
export class ScreenReaderManager {
  private announcer: HTMLElement;
  constructor() {
    this.announcer = this.createAnnouncer();
  }
  private createAnnouncer(): HTMLElement {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.position = 'absolute';
    announcer.style.left = '-10000px';
    announcer.style.width = '1px';
    announcer.style.height = '1px';
    announcer.style.overflow = 'hidden';
    document.body.appendChild(announcer);
    return announcer;
  }
  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    this.announcer.setAttribute('aria-live', priority);
    this.announcer.textContent = message;
    setTimeout(() => {
      this.announcer.textContent = '';
    }, 1000);
  }
  announcePageChange(pageName: string) {
    this.announce(`Navigated to ${pageName}`, 'assertive');
  }
  announceError(error: string) {
    this.announce(`Error: ${error}`, 'assertive');
  }
  announceSuccess(message: string) {
    this.announce(`Success: ${message}`, 'polite');
  }
}
export class FocusManager {
  private focusStack: HTMLElement[] = [];
  pushFocus(element: HTMLElement) {
    const currentFocus = document.activeElement as HTMLElement;
    if (currentFocus) {
      this.focusStack.push(currentFocus);
    }
    element.focus();
  }
  popFocus() {
    const previousFocus = this.focusStack.pop();
    if (previousFocus) {
      previousFocus.focus();
    }
  }
  trapFocus(container: HTMLElement) {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          event.preventDefault();
        }
      }
    };
    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }
}
export class ContrastManager {
  applyHighContrast() {
    document.documentElement.classList.add('high-contrast');
  }
  removeHighContrast() {
    document.documentElement.classList.remove('high-contrast');
  }
  toggleHighContrast() {
    document.documentElement.classList.toggle('high-contrast');
  }
}
export class MotionManager {
  constructor() {
    this.detectMotionPreference();
  }
  private detectMotionPreference() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) {
      this.enableReducedMotion();
    }
    prefersReducedMotion.addEventListener('change', (e) => {
      if (e.matches) {
        this.enableReducedMotion();
      } else {
        this.disableReducedMotion();
      }
    });
  }
  enableReducedMotion() {
    document.documentElement.classList.add('reduce-motion');
  }
  disableReducedMotion() {
    document.documentElement.classList.remove('reduce-motion');
  }
}
export class AccessibilityManager {
  private keyboardManager: KeyboardNavigationManager;
  private screenReaderManager: ScreenReaderManager;
  private focusManager: FocusManager;
  private contrastManager: ContrastManager;
  private motionManager: MotionManager;
  private config: AccessibilityConfig;
  constructor(config: AccessibilityConfig = defaultAccessibilityConfig) {
    this.config = config;
    this.keyboardManager = new KeyboardNavigationManager();
    this.screenReaderManager = new ScreenReaderManager();
    this.focusManager = new FocusManager();
    this.contrastManager = new ContrastManager();
    this.motionManager = new MotionManager();
    this.applyConfig();
  }
  private applyConfig() {
    if (this.config.enableHighContrast) {
      this.contrastManager.applyHighContrast();
    }
    if (this.config.enableReducedMotion) {
      this.motionManager.enableReducedMotion();
    }
  }
  updateConfig(newConfig: Partial<AccessibilityConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.applyConfig();
  }
  get keyboard() { return this.keyboardManager; }
  get screenReader() { return this.screenReaderManager; }
  get focus() { return this.focusManager; }
  get contrast() { return this.contrastManager; }
  get motion() { return this.motionManager; }
}
export const accessibilityManager = new AccessibilityManager();
