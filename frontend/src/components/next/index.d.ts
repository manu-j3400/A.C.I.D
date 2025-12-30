// Next.js component type definitions - permissive types
import React from 'react';

// Document components - accept any props
export const Document: React.ComponentType<any>;
export const Html: React.ComponentType<any>;
export const Head: React.ComponentType<any>;
export const Main: React.ComponentType<any>;
export const NextScript: React.ComponentType<any>;

// Dynamic import - accept any props
export function dynamic<P = any>(
  dynamicOptions: any,
  options?: any
): React.ComponentType<P & Record<string, any>>;

// Font - accept any props
export const Roboto: (options?: any) => any;

// Image component - accept any props
export const Image: React.ComponentType<any>;

// Link component - accept any props
export const Link: React.ComponentType<any>;

// Navigation hooks - return any
export function useSearchParams(): any;
export function useParams(): any;

// Router hooks and provider - return/accept any
export function useRouter(): any;
export function usePathname(): any;
export const RouterProvider: React.ComponentType<any>;

// Script component - accept any props
export const Script: React.ComponentType<any>; 