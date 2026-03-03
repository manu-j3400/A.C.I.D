import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export function initPostHog() {
    if (!POSTHOG_KEY) {
        console.warn('[PostHog] No API key found — analytics disabled. Set VITE_POSTHOG_KEY in .env.local');
        return;
    }

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,       // auto-tracks clicks, form submissions, etc.
        session_recording: {
            maskAllInputs: false, // set to true if you want to mask sensitive fields
        },
    });
}

export { posthog };
