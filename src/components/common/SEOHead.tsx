import React, { useEffect } from 'react';
import { useApp, PageRoute } from '../../context/AppContext';

interface PageMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: string;
}

const PAGE_METADATA_MAP: Partial<Record<PageRoute, PageMetadata>> = {
  home: {
    title: 'A/R Tax Services, LLC | Tax Preparation, Advisory & Wealth Planning',
    description: 'Professional tax preparation, business accounting, strategic tax advisory, and wealth coordination in Columbia, South Carolina.',
    canonicalPath: '/',
    ogType: 'website'
  },
  services: {
    title: 'Tax Preparation & Accounting Services | A/R Tax Services, LLC',
    description: 'Comprehensive tax preparation (1040, 1120S, 1065), year-round business bookkeeping, IRS notice resolution, and estate planning coordination.',
    canonicalPath: '/services',
    ogType: 'website'
  },
  tax_strategies: {
    title: 'Tax Reduction Strategies & Planning Catalog | A/R Tax Services, LLC',
    description: 'Explore 16 strategic tax reduction domains: Section 199A QBI, S-Corp optimization, cost segregation, real estate 1031s, and executive planning.',
    canonicalPath: '/tax-strategies',
    ogType: 'website'
  },
  industries: {
    title: 'Specialized Commercial Industry Practices | A/R Tax Services, LLC',
    description: 'Tailored tax and accounting frameworks for construction, real estate syndications, medical practices, legal professionals, and tech businesses.',
    canonicalPath: '/industries',
    ogType: 'website'
  },
  about: {
    title: 'About Our Firm & Practice Principles | A/R Tax Services, LLC',
    description: 'Learn about A/R Tax Services, LLC: our client-first heritage, practice values, strict confidentiality, and dedication to South Carolina taxpayers.',
    canonicalPath: '/about',
    ogType: 'website'
  },
  founder: {
    title: 'Desmond Hinds, Founder & CEO | A/R Tax Services, LLC',
    description: 'Executive biography and leadership philosophy of Desmond Hinds, Founder and Senior Managing Accountant of A/R Tax Services, LLC.',
    canonicalPath: '/founder',
    ogType: 'profile'
  },
  pricing: {
    title: 'Transparent Pricing & Engagement Plans | A/R Tax Services, LLC',
    description: 'Clear, upfront pricing for individual returns, small business packages, and ongoing advisory retainers. No surprise billing or hidden fees.',
    canonicalPath: '/pricing',
    ogType: 'website'
  },
  book_consultation: {
    title: 'Schedule a Consultation | A/R Tax Services, LLC',
    description: 'Book a strategy session with Founder Desmond Hinds or our senior tax advisory team. Virtual, phone, or in-office appointments available.',
    canonicalPath: '/book-consultation',
    ogType: 'website'
  },
  resources: {
    title: 'Tax Resources, Deadlines & FAQ | A/R Tax Services, LLC',
    description: 'Essential filing deadlines, downloadable document preparation checklists, tax bracket references, and answers to common taxpayer questions.',
    canonicalPath: '/resources',
    ogType: 'website'
  },
  careers: {
    title: 'Careers & Professional Opportunities | A/R Tax Services, LLC',
    description: 'Join our accounting and tax advisory team in Columbia, SC. Explore open positions for tax preparers, senior accountants, and client managers.',
    canonicalPath: '/careers',
    ogType: 'website'
  },
  job_detail: {
    title: 'Career Opportunity Details | A/R Tax Services, LLC',
    description: 'Review role responsibilities, qualifications, compensation structure, and application instructions for open positions at A/R Tax Services, LLC.',
    canonicalPath: '/careers/job',
    ogType: 'website'
  },
  contact: {
    title: 'Contact Our Columbia, SC Office | A/R Tax Services, LLC',
    description: 'Get in touch with A/R Tax Services, LLC. Call 678-205-9486, email info@artaxservices.com, or submit a message to our Columbia, SC team.',
    canonicalPath: '/contact',
    ogType: 'website'
  },
  privacy: {
    title: 'Privacy Policy & GLBA Notice | A/R Tax Services, LLC',
    description: 'Our commitment to protecting nonpublic personal financial information under the Gramm-Leach-Bliley Act and IRC Section 7216.',
    canonicalPath: '/privacy',
    ogType: 'website'
  },
  terms: {
    title: 'Terms of Service & Client Engagement | A/R Tax Services, LLC',
    description: 'Terms governing public website access, consultation scheduling, client portal usage, and professional engagement responsibilities.',
    canonicalPath: '/terms',
    ogType: 'website'
  },
  disclaimers: {
    title: 'Professional & Statutory Disclaimers | A/R Tax Services, LLC',
    description: 'Important legal and regulatory notices: IRS non-affiliation, outcome disclaimers, Circular 230 disclosure, and professional credentials.',
    canonicalPath: '/disclaimers',
    ogType: 'website'
  },
  security: {
    title: 'Security Architecture & Data Safeguards | A/R Tax Services, LLC',
    description: 'Administrative, technical, and operational safeguards designed to protect sensitive client documents and financial records.',
    canonicalPath: '/security',
    ogType: 'website'
  },
  accessibility: {
    title: 'Accessibility Statement (WCAG 2.1 AA) | A/R Tax Services, LLC',
    description: 'Our commitment to digital accessibility, keyboard operability, screen reader support, and WCAG 2.1 Level AA compliance.',
    canonicalPath: '/accessibility',
    ogType: 'website'
  },
  cookies: {
    title: 'Cookie Policy & Privacy Preferences | A/R Tax Services, LLC',
    description: 'Information about strictly necessary cookies, preferences, and privacy controls at A/R Tax Services, LLC.',
    canonicalPath: '/cookies',
    ogType: 'website'
  },
  portals: {
    title: 'Secure Client & Staff Portals | A/R Tax Services, LLC',
    description: 'Access encrypted portals for clients, accounting professionals, reviewers, and administrative leadership.',
    canonicalPath: '/portals',
    ogType: 'website'
  },
  public_v2: {
    title: 'A/R Tax Services, LLC | Corporate Advisory Experience',
    description: 'Dedicated financial advisory, tax optimization, and corporate accounting services for businesses and individuals.',
    canonicalPath: '/v2',
    ogType: 'website'
  },
  live_calendar: {
    title: 'Live Appointment Booking | A/R Tax Services, LLC',
    description: 'Direct interactive scheduling for consultation sessions with A/R Tax Services, LLC.',
    canonicalPath: '/calendar',
    ogType: 'website'
  },
  virtual_consultation_room: {
    title: 'Virtual Consultation Room | A/R Tax Services, LLC',
    description: 'Secure, encrypted virtual advisory room for client consultations.',
    canonicalPath: '/meeting',
    ogType: 'website'
  },
  client_portal: {
    title: 'Client Portal | A/R Tax Services, LLC',
    description: 'Encrypted client portal for tax document exchange, return reviews, e-signatures, and real-time filing status tracking.',
    canonicalPath: '/client/portal',
    ogType: 'website'
  },
  client_login: {
    title: 'Client Portal Sign In | A/R Tax Services, LLC',
    description: 'Secure client sign-in for tax organizers, documents, and status tracking.',
    canonicalPath: '/client/login',
    ogType: 'website'
  },
  client_register: {
    title: 'Client Account Registration | A/R Tax Services, LLC',
    description: 'Register for a new secure client account with A/R Tax Services, LLC.',
    canonicalPath: '/client/register',
    ogType: 'website'
  },
  staff_login: {
    title: 'Staff Portal Sign In | A/R Tax Services, LLC',
    description: 'Authorized sign-in for accountants, reviewers, and practice staff.',
    canonicalPath: '/staff/login',
    ogType: 'website'
  },
  admin_portal: {
    title: 'Practice Management Portal | A/R Tax Services, LLC',
    description: 'Authorized administrative and practice management portal for A/R Tax Services, LLC personnel.',
    canonicalPath: '/admin',
    ogType: 'website'
  },
  admin_dashboard: {
    title: 'Executive Admin Dashboard | A/R Tax Services, LLC',
    description: 'Firm operations, workflow queues, and practice analytics dashboard.',
    canonicalPath: '/admin/dashboard',
    ogType: 'website'
  },
  not_found: {
    title: 'Page Not Found | A/R Tax Services, LLC',
    description: 'The requested page could not be located. Explore our core tax preparation, accounting, and advisory services.',
    canonicalPath: '/404',
    ogType: 'website'
  }
};

export const SEOHead: React.FC = () => {
  const { currentPage } = useApp();

  useEffect(() => {
    const meta = PAGE_METADATA_MAP[currentPage] || PAGE_METADATA_MAP.home;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://artaxservices.com';
    const canonicalUrl = `${origin}${meta.canonicalPath}`;

    // 1. Update Document Title
    document.title = meta.title;

    // Helper to create or update meta tag
    const setMetaTag = (selector: string, attrName: string, attrValue: string, content: string) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // 2. Standard Meta Description
    setMetaTag('meta[name="description"]', 'name', 'description', meta.description);

    // 3. OpenGraph Tags
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', meta.title);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', meta.description);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', meta.ogType || 'website');
    setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'A/R Tax Services, LLC');

    // 4. Twitter Tags
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);

    // 5. Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

  }, [currentPage]);

  return null;
};
