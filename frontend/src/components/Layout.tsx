/**
 * Layout — wraps authenticated pages (Scanner, Batch, Engine, Graph, About)
 * with the AppSidebar and a content area.
 */
import React from 'react';
import AppSidebar from './AppSidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: '#000', fontFamily: "'JetBrains Mono', monospace" }}>
      <AppSidebar />
      <main className="flex-1 min-h-screen overflow-auto" style={{ marginLeft: '12rem' }}>
        {children}
      </main>
    </div>
  );
}
