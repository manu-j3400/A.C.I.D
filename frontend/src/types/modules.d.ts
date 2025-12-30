// Module declarations for JSX and JS files - permissive types

declare module '@/components/next' {
  const value: any;
  export = value;
  export default value;
}

declare module '@/components/next/*' {
  const Component: React.ComponentType<any>;
  export default Component;
  export = Component;
}

declare module 'next/document' {
  const value: any;
  export = value;
  export default value;
}

declare module 'next/dynamic' {
  const value: any;
  export = value;
  export default value;
}

declare module 'next/font/google' {
  const value: any;
  export = value;
  export default value;
}

declare module 'next/head' {
  const value: any;
  export = value;
  export default value;
}

declare module 'next/image' {
  const value: any;
  export = value;
  export default value;
}

declare module 'next/link' {
  const value: any;
  export = value;
  export default value;
}

declare module 'next/navigation' {
  const value: any;
  export = value;
  export default value;
}

declare module 'next/router' {
  const value: any;
  export = value;
  export default value;
}

declare module 'next/script' {
  const value: any;
  export = value;
  export default value;
}

// Generic JSX file handling
declare module '*.jsx' {
  const value: any;
  export = value;
  export default value;
}

// Generic JS file handling
declare module '*.js' {
  const value: any;
  export = value;
  export default value;
}

// Specific component files - all permissive
declare module '@/components/next/*.jsx' {
  const value: any;
  export = value;
  export default value;
}

declare module '@/components/next/*.js' {
  const value: any;
  export = value;
  export default value;
} 