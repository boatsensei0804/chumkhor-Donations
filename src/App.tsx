import React, { useState, useEffect } from 'react';
import { DisplayScreen } from './components/DisplayScreen';
import { AdminScreen } from './components/AdminScreen';
import { AdminLoginScreen } from './components/AdminLoginScreen';

export const App: React.FC = () => {
  // Read screen mode from URL query or default to 'display'
  const getInitialScreen = (): 'display' | 'admin' => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const screenParam = params.get('screen');
      if (screenParam === 'admin') return 'admin';
      if (screenParam === 'display') return 'display';
    }
    return 'display';
  };

  const [currentScreen, setCurrentScreen] = useState<'display' | 'admin'>(getInitialScreen);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('ckp_admin_auth') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentScreen(getInitialScreen());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const switchScreen = (screen: 'display' | 'admin') => {
    setCurrentScreen(screen);
    const url = new URL(window.location.href);
    url.searchParams.set('screen', screen);
    window.history.pushState({}, '', url.toString());
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('ckp_admin_auth', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('ckp_admin_auth');
  };

  return (
    <div className="w-full min-h-screen">
      {currentScreen === 'display' ? (
        <DisplayScreen onOpenAdmin={() => switchScreen('admin')} />
      ) : isAuthenticated ? (
        <AdminScreen
          onOpenDisplay={() => switchScreen('display')}
          onLogout={handleLogout}
        />
      ) : (
        <AdminLoginScreen
          onSuccess={handleLoginSuccess}
          onBackToDisplay={() => switchScreen('display')}
        />
      )}
    </div>
  );
};

export default App;
