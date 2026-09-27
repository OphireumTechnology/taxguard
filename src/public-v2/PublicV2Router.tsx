import React, { useState, useEffect } from 'react';
import { PublicV2Layout } from './components/PublicV2Layout';
import { PublicV2HomePage } from './pages/PublicV2HomePage';
import { PublicV2AboutPage } from './pages/PublicV2AboutPage';
import { PublicV2ServicesPage } from './pages/PublicV2ServicesPage';
import { PublicV2IndustriesPage } from './pages/PublicV2IndustriesPage';
import { PublicV2ResourcesPage } from './pages/PublicV2ResourcesPage';
import { PublicV2ContactPage } from './pages/PublicV2ContactPage';
import { PublicV2PortalsPage } from './pages/PublicV2PortalsPage';
import { PublicV2AssistantPage } from './assistant/PublicV2AssistantPage';

export function getPublicV2Path(): string {
  if (typeof window === 'undefined') return '/public-v2';

  // Check hash first (e.g. #/public-v2/accounting-assistant)
  const hash = window.location.hash || '';
  if (hash.startsWith('#/public-v2') || hash.startsWith('#public-v2')) {
    const cleanHash = hash.replace(/^#\/?/, '/');
    return cleanHash;
  }

  // Check pathname
  const path = window.location.pathname || '';
  if (path.startsWith('/public-v2')) {
    return path;
  }

  return '/public-v2';
}

export const PublicV2Router: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(getPublicV2Path);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(getPublicV2Path());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleNavigate = (targetPath: string) => {
    // If navigating back to primary site:
    if (targetPath === '/' || targetPath === '#/' || targetPath === 'home') {
      window.location.hash = '#/';
      window.location.pathname = '/';
      return;
    }

    // Standardize to hash or history:
    // If current URL uses hash, preserve hash routing
    if (window.location.hash.startsWith('#/public-v2') || window.location.hash.startsWith('#public-v2')) {
      window.location.hash = `#${targetPath}`;
    } else {
      try {
        window.history.pushState(null, '', targetPath);
      } catch {
        window.location.hash = `#${targetPath}`;
      }
    }
    setCurrentPath(targetPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Render appropriate page view
  const renderCurrentView = () => {
    const clean = currentPath.replace(/\/+$/, '');

    switch (clean) {
      case '/public-v2/about':
        return (
          <PublicV2AboutPage
            onNavigate={handleNavigate}
            onOpenConsultation={() => handleNavigate('/public-v2/contact')}
          />
        );

      case '/public-v2/services':
        return (
          <PublicV2ServicesPage
            onNavigate={handleNavigate}
            onOpenConsultation={() => handleNavigate('/public-v2/contact')}
          />
        );

      case '/public-v2/industries':
        return (
          <PublicV2IndustriesPage
            onNavigate={handleNavigate}
            onOpenConsultation={() => handleNavigate('/public-v2/contact')}
          />
        );

      case '/public-v2/resources':
        return (
          <PublicV2ResourcesPage
            onNavigate={handleNavigate}
            onOpenConsultation={() => handleNavigate('/public-v2/contact')}
          />
        );

      case '/public-v2/accounting-assistant':
      case '/public-v2/assistant':
        return (
          <PublicV2AssistantPage
            onNavigate={handleNavigate}
            onOpenConsultation={() => handleNavigate('/public-v2/contact')}
          />
        );

      case '/public-v2/contact':
        return (
          <PublicV2ContactPage
            onNavigate={handleNavigate}
            onOpenConsultation={() => {}}
          />
        );

      case '/public-v2/portals':
        return (
          <PublicV2PortalsPage
            onNavigate={handleNavigate}
            onOpenConsultation={() => handleNavigate('/public-v2/contact')}
          />
        );

      case '/public-v2':
      default:
        return (
          <PublicV2HomePage
            onNavigate={handleNavigate}
            onOpenConsultation={() => {
              const el = document.getElementById('consultation-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              } else {
                handleNavigate('/public-v2/contact');
              }
            }}
          />
        );
    }
  };

  return (
    <PublicV2Layout
      activePath={currentPath.replace(/\/+$/, '')}
      onNavigate={handleNavigate}
    >
      {renderCurrentView()}
    </PublicV2Layout>
  );
};
