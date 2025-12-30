import React, { createContext, useContext } from "react";

const RouterContext = createContext({
  pathname: "/",
  push: (url) => {},
  replace: (url) => {},
});

export const useRouter = () => useContext(RouterContext);

export const usePathname = () => {
  const router = useRouter();
  return router.pathname;
};

export const RouterProvider = ({ children }) => {
  const router = {
    pathname: "/",
    push: (url) => {
      console.log(`Navigating to ${url}`);
    },
    replace: (url) => {
      console.log(`Replacing with ${url}`);
    },
  };

  return (
    <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
  );
};
