import React, { createContext, useContext, useState, useEffect } from 'react';

type Level = 'Novice' | 'Apprentice' | 'Practitioner' | 'Architect' | 'Grandmaster';

interface GameContextType {
    xp: number;
    level: Level;
    streak: number;
    addXp: (amount: number) => void;
    roastMode: boolean;
    toggleRoastMode: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
    const [xp, setXp] = useState(0);
    const [streak, setStreak] = useState(1);
    const [roastMode, setRoastMode] = useState(false);

    // Initialize from storage or default
    useEffect(() => {
        const savedXp = localStorage.getItem('soteria_xp');
        const savedStreak = localStorage.getItem('soteria_streak');
        const savedRoast = localStorage.getItem('soteria_roast');

        if (savedXp) setXp(parseInt(savedXp));
        if (savedStreak) setStreak(parseInt(savedStreak));
        if (savedRoast) setRoastMode(savedRoast === 'true');
    }, []);

    const level = (() => {
        if (xp < 100) return 'Novice';
        if (xp < 500) return 'Apprentice';
        if (xp < 2000) return 'Practitioner';
        if (xp < 5000) return 'Architect';
        return 'Grandmaster';
    })();

    const addXp = (amount: number) => {
        const newXp = xp + amount;
        setXp(newXp);
        localStorage.setItem('soteria_xp', newXp.toString());
    };

    const toggleRoastMode = () => {
        const newVal = !roastMode;
        setRoastMode(newVal);
        localStorage.setItem('soteria_roast', newVal.toString());
    };

    return (
        <GameContext.Provider value={{ xp, level, streak, addXp, roastMode, toggleRoastMode }}>
            {children}
        </GameContext.Provider>
    );
}

export function useGame() {
    const context = useContext(GameContext);
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
}
