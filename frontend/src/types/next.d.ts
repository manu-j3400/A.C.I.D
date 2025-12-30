import React from 'react';

// Make all Next.js types accept any props
export type NextRouter = Record<string, any>;

export type NextImageProps = React.ImgHTMLAttributes<HTMLImageElement> & Record<string, any>;

export type StaticImageData = Record<string, any>;

export type ImageLoaderProps = Record<string, any>;

export type NextLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & Record<string, any>;

export type NextHeadProps = Record<string, any>;

export type NextScriptProps = React.ScriptHTMLAttributes<HTMLScriptElement> & Record<string, any>;

export interface DynamicOptions<P = any> {
  [key: string]: any;
}

export type DynamicOptionsLoadingProps = Record<string, any>;

export type NextFontDescriptor = Record<string, any>;

export type GoogleFontOptions = Record<string, any>;

export type FontFunction = (options?: any) => any;

export type DocumentProps = Record<string, any>;

export type DocumentContext = Record<string, any>;

export type DocumentInitialProps = Record<string, any>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [key: string]: any;
    }
  }
} 