// Global type declarations for the project - permissive types

/// <reference types="react" />
/// <reference types="react-dom" />

// Import all module declarations
import './modules';
import './next';
import './styled-jsx';

// Global augmentation for better TypeScript support
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [key: string]: any;
    }
  }

  // Extend Window interface if needed
  interface Window {
    [key: string]: any;
  }
}

// Ambient module declarations for better IDE support
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    [key: string]: any;
  }
}

// Utility types for the project - more permissive
export type PropsWithClassName<P = any> = P & {
  className?: string;
  [key: string]: any;
};

export type PropsWithChildren<P = any> = P & {
  children?: React.ReactNode;
  [key: string]: any;
};

export type ComponentWithProps<P = any> = React.ComponentType<P & Record<string, any>>;

// Export everything to make it available globally
export {}; 