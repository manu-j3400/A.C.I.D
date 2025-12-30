import React from "react";

/** @type {React.FC<any>} */
const Html = ({ children, ...props }) => <html {...props}>{children}</html>;
/** @type {React.FC<any>} */
const Head = ({ children = null }) => <head>{children}</head>;
/** @type {React.FC<any>} */
const Main = () => <div id="__next"></div>;
/** @type {React.FC<any>} */
const NextScript = () => <script />;

export default function Document() {
  return (
    <Html>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

export { Html, Head, Main, NextScript };
