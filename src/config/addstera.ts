export const adsterraConfig = {
    popunder: `
<script src="https://pl29751138.effectivecpmnetwork.com/1e/49/c1/1e49c17ca958309ec011f24c528755f7.js"></script>
`,

    nativeBanner: `
<script async="async" data-cfasync="false" src="https://pl29751139.effectivecpmnetwork.com/889c24ddbabf6a0bef7977f62c8b54b4/invoke.js"></script>
<div id="container-889c24ddbabf6a0bef7977f62c8b54b4"></div>
`,

    socialBar: `
<script src="https://pl29751140.effectivecpmnetwork.com/0d/e2/bd/0de2bd7c5e002d37e7a7fff2e46a5805.js"></script>
`,

    banners: {
        banner468x60: `
<script>
atOptions = {
  key: '24d4256330ef4f603cbb3572c64ffa6a',
  format: 'iframe',
  height: 60,
  width: 468,
  params: {}
};
</script>
<script src="https://www.highperformanceformat.com/24d4256330ef4f603cbb3572c64ffa6a/invoke.js"></script>
`,

        banner300x250: `
<script>
atOptions = {
  key: '341d94d9b89f9b9f491727aca8a47ae6',
  format: 'iframe',
  height: 250,
  width: 300,
  params: {}
};
</script>
<script src="https://www.highperformanceformat.com/341d94d9b89f9b9f491727aca8a47ae6/invoke.js"></script>
`,

        banner160x300: `
<script>
atOptions = {
  key: '98c545409a8cb37c73d6a39b098e90fd',
  format: 'iframe',
  height: 300,
  width: 160,
  params: {}
};
</script>
<script src="https://www.highperformanceformat.com/98c545409a8cb37c73d6a39b098e90fd/invoke.js"></script>
`,

        banner160x600: `
<script>
atOptions = {
  key: '04679228bcba376d4600135e5b796c8b',
  format: 'iframe',
  height: 600,
  width: 160,
  params: {}
};
</script>
<script src="https://www.highperformanceformat.com/04679228bcba376d4600135e5b796c8b/invoke.js"></script>
`,

        banner320x50: `
<script>
atOptions = {
  key: '519b3788c97c70be810d0c95e54527fd',
  format: 'iframe',
  height: 50,
  width: 320,
  params: {}
};
</script>
<script src="https://www.highperformanceformat.com/519b3788c97c70be810d0c95e54527fd/invoke.js"></script>
`,

        banner728x90: `
<script>
atOptions = {
  key: '04e50b86336e1cbd7fd18562f36ee01c',
  format: 'iframe',
  height: 90,
  width: 728,
  params: {}
};
</script>
<script src="https://www.highperformanceformat.com/04e50b86336e1cbd7fd18562f36ee01c/invoke.js"></script>
`,
    },
} as const;

// --- Types ---

export type AdType = 'popunder' | 'nativeBanner' | 'socialBar' | keyof typeof adsterraConfig.banners;

export type AdPosition = 'top' | 'after_first_h2' | 'after_paragraph' | 'before_faq' | 'end';

export interface AdPlacement {
    type: AdType;
    position: AdPosition;
    paragraphIndex?: number;
}

export interface AdPackage {
    name: string;
    description: string;
    placements: AdPlacement[];
}

export interface AdDecision {
    packageName: string;
    customPlacements?: AdPlacement[];
    reason: string;
}

// --- Predefined Ad Packages ---

export const adPackages: AdPackage[] = [
    {
        name: 'light',
        description: 'Minimal ads: popunder + 1 native banner. Best for short articles or mobile-heavy audience.',
        placements: [
            { type: 'popunder', position: 'end' },
            { type: 'nativeBanner', position: 'after_first_h2' },
        ],
    },
    {
        name: 'standard',
        description: 'Balanced: social bar + banner 728x90 + native banner + popunder. Standard blog monetization.',
        placements: [
            { type: 'socialBar', position: 'top' },
            { type: 'banner728x90', position: 'after_first_h2' },
            { type: 'nativeBanner', position: 'before_faq' },
            { type: 'popunder', position: 'end' },
        ],
    },
    {
        name: 'heavy',
        description: 'Full ads with mid-article banner. Best for long articles (2000+ words) with many sections.',
        placements: [
            { type: 'socialBar', position: 'top' },
            { type: 'banner300x250', position: 'after_paragraph', paragraphIndex: 3 },
            { type: 'nativeBanner', position: 'before_faq' },
            { type: 'banner728x90', position: 'end' },
            { type: 'popunder', position: 'end' },
        ],
    },
    {
        name: 'mobile',
        description: 'Mobile-optimized: small banner 320x50 + native. Less intrusive for mobile visitors.',
        placements: [
            { type: 'banner320x50', position: 'top' },
            { type: 'nativeBanner', position: 'after_first_h2' },
            { type: 'popunder', position: 'end' },
        ],
    },
    {
        name: 'sidebar',
        description: 'Desktop-focused with sidebar banners. Best for long-form technical content.',
        placements: [
            { type: 'socialBar', position: 'top' },
            { type: 'banner160x600', position: 'after_first_h2' },
            { type: 'banner728x90', position: 'before_faq' },
            { type: 'popunder', position: 'end' },
        ],
    },
];

// --- Helper Functions ---

export function getAdScript(type: AdType): string {
    if (type === 'popunder') return adsterraConfig.popunder;
    if (type === 'nativeBanner') return adsterraConfig.nativeBanner;
    if (type === 'socialBar') return adsterraConfig.socialBar;
    return adsterraConfig.banners[type as keyof typeof adsterraConfig.banners] || '';
}

export function getAdPackage(name: string): AdPackage | undefined {
    return adPackages.find(p => p.name === name);
}

export function listAdTypes(): string[] {
    return [
        'popunder',
        'nativeBanner',
        'socialBar',
        ...Object.keys(adsterraConfig.banners),
    ];
}

export function listAdPackages(): string[] {
    return adPackages.map(p => `${p.name}: ${p.description}`);
}

export function resolvePlacements(decision: AdDecision): AdPlacement[] {
    if (decision.customPlacements && decision.customPlacements.length > 0) {
        return decision.customPlacements;
    }
    const pkg = getAdPackage(decision.packageName);
    return pkg ? [...pkg.placements] : [];
}


