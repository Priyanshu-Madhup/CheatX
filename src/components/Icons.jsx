const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const CameraIcon = () => (
  <svg {...base}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.1-1.7A1.5 1.5 0 0 1 10 4.6h4a1.5 1.5 0 0 1 1.2.7L16.3 7h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="12.8" r="3.3" />
  </svg>
);

export const UploadIcon = () => (
  <svg {...base}>
    <path d="M12 16V5" />
    <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
    <path d="M5 15v2.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);

export const TypeIcon = () => (
  <svg {...base}>
    <path d="M5 7V5.5h14V7" />
    <path d="M12 5.5V19" />
    <path d="M9.5 19h5" />
  </svg>
);

export const PlusIcon = () => (
  <svg {...base}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

export const ListIcon = () => (
  <svg {...base}>
    <path d="m4.5 7 1.5 1.5L8.5 5.5" />
    <path d="m4.5 16 1.5 1.5 2.5-3" />
    <path d="M12 7h7.5" />
    <path d="M12 16.5h7.5" />
  </svg>
);

export const CodeIcon = () => (
  <svg {...base}>
    <path d="m8.5 8-4 4 4 4" />
    <path d="m15.5 8 4 4-4 4" />
    <path d="m13.2 5.5-2.4 13" />
  </svg>
);

export const MicIcon = () => (
  <svg {...base}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v2.5" />
  </svg>
);
