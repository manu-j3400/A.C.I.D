// Type declarations for JSX components to suppress errors
declare module './document.jsx' {
  import React from 'react';
  const Document: React.FC<any>;
  export default Document;
  export const Html: React.FC<any>;
  export const Head: React.FC<any>;
  export const Main: React.FC<any>;
  export const NextScript: React.FC<any>;
}

declare module './dynamic.jsx' {
  const dynamic: (importFunc: any, options?: any) => React.ComponentType<any>;
  export default dynamic;
}

declare module './font.jsx' {
  export const Roboto: (options?: any) => any;
}

declare module './head.jsx' {
  import React from 'react';
  const Head: React.FC<any>;
  export default Head;
}

declare module './image.jsx' {
  import React from 'react';
  const Image: React.FC<any>;
  export default Image;
}

declare module './link.jsx' {
  import React from 'react';
  const Link: React.FC<any>;
  export default Link;
}

declare module './navigation.jsx' {
  export function useSearchParams(): any;
  export function useParams(): any;
}

declare module './router.jsx' {
  import React from 'react';
  export function useRouter(): any;
  export function usePathname(): any;
  export const RouterProvider: React.FC<any>;
}

declare module './script.jsx' {
  import React from 'react';
  const Script: React.FC<any>;
  export default Script;
} 