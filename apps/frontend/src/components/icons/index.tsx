import React from "react";

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "width" | "height"> & {
  /** Rendered width and height. Defaults to 20. */
  size?: number | string;
  /** Accessible name. When set the icon is announced; otherwise it is decorative. */
  title?: string;
};

type IconOptions = {
  /** Fill shapes with currentColor instead of stroking them. */
  fill?: boolean;
};

const createIcon = (
  displayName: string,
  children: React.ReactNode,
  { fill = false }: IconOptions = {}
): React.FC<IconProps> => {
  const Icon: React.FC<IconProps> = ({ size = 20, title, ...rest }) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...(title ? { role: "img" } : { "aria-hidden": true, focusable: false })}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
};

const HEART_PATH =
  "M12 20.5c-.3 0-.6-.1-.8-.3L4.6 13.9A4.9 4.9 0 0 1 3 10.3C3 7.6 5.1 5.5 7.7 5.5c1.7 0 3.2.9 4.3 2.3 1.1-1.4 2.6-2.3 4.3-2.3 2.6 0 4.7 2.1 4.7 4.8 0 1.4-.6 2.6-1.6 3.6l-6.6 6.3c-.2.2-.5.3-.8.3z";

const HeartBase = createIcon("HeartIcon", <path d={HEART_PATH} />);

export const HeartIcon: React.FC<IconProps & { filled?: boolean }> = ({ filled = false, ...rest }) => (
  <HeartBase fill={filled ? "currentColor" : "none"} {...rest} />
);
HeartIcon.displayName = "HeartIcon";

export const PlayIcon = createIcon("PlayIcon", <path d="M7 4.5v15L19.5 12 7 4.5z" />, { fill: true });

export const PauseIcon = createIcon(
  "PauseIcon",
  <>
    <rect x="6" y="4.5" width="4.5" height="15" />
    <rect x="13.5" y="4.5" width="4.5" height="15" />
  </>,
  { fill: true }
);

export const SkipBackIcon = createIcon(
  "SkipBackIcon",
  <>
    <rect x="4.5" y="5" width="2.5" height="14" />
    <path d="M19.5 5v14L9 12l10.5-7z" />
  </>,
  { fill: true }
);

export const SkipForwardIcon = createIcon(
  "SkipForwardIcon",
  <>
    <path d="M4.5 5v14L15 12 4.5 5z" />
    <rect x="17" y="5" width="2.5" height="14" />
  </>,
  { fill: true }
);

const SPEAKER_PATH = "M4 9.5h3.5L13 5.5v13l-5.5-4H4v-5z";

export const VolumeIcon = createIcon(
  "VolumeIcon",
  <>
    <path d={SPEAKER_PATH} />
    <path d="M16.5 9a4.2 4.2 0 0 1 0 6" />
    <path d="M19 6.5a7.5 7.5 0 0 1 0 11" />
  </>
);

export const VolumeMutedIcon = createIcon(
  "VolumeMutedIcon",
  <>
    <path d={SPEAKER_PATH} />
    <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
  </>
);

export const UsersIcon = createIcon(
  "UsersIcon",
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20v-1.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5V20" />
    <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" />
    <path d="M18 14.3a4.5 4.5 0 0 1 3.5 4.2V20" />
  </>
);

export const RemakeIcon = createIcon(
  "RemakeIcon",
  <>
    <path d="M20 12a8 8 0 0 1-14 5.3" />
    <path d="M4 12a8 8 0 0 1 14-5.3" />
    <path d="M18 3v3.7h-3.7" />
    <path d="M6 21v-3.7h3.7" />
  </>
);

export const TracksIcon = createIcon(
  "TracksIcon",
  <>
    <path d="M10 17.5V5.5l9-2v12" />
    <circle cx="7" cy="17.5" r="3" />
    <circle cx="16" cy="15.5" r="3" />
  </>
);

export const BellIcon = createIcon(
  "BellIcon",
  <>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </>
);

export const MoreHorizontalIcon = createIcon(
  "MoreHorizontalIcon",
  <>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </>,
  { fill: true }
);

export const SearchIcon = createIcon(
  "SearchIcon",
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </>
);

export const ChevronRightIcon = createIcon("ChevronRightIcon", <path d="m9 5 7 7-7 7" />);

export const AddIcon = createIcon("AddIcon", <path d="M12 5v14M5 12h14" />);

export const DownloadIcon = createIcon(
  "DownloadIcon",
  <>
    <path d="M12 4v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </>
);

export const CopyIcon = createIcon(
  "CopyIcon",
  <>
    <rect x="9" y="9" width="11" height="11" />
    <path d="M15 9V4H4v11h5" />
  </>
);
