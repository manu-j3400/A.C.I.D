// @ts-nocheck
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "light",
  setTheme: (theme: string) => {},
  resolvedTheme: "light",
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({
  children,
  defaultTheme = "light",
  enableSystem = false,
}) => {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const resolvedTheme = theme === "system" ? "light" : theme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
