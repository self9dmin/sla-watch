import React from "react";
import { COMMUNITY_PROFILE, isCommunityLive } from "../data/externalLinks";

export const CommunityLink = ({
  className,
  label = COMMUNITY_PROFILE.label,
  onClick,
}: {
  className?: string;
  label?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) => {
  if (isCommunityLive()) {
    return (
      <a className={className} href={COMMUNITY_PROFILE.url} target="_blank" rel="noreferrer" onClick={onClick}>
        {label}
      </a>
    );
  }

  return (
    <span
      className={`${className ?? ""} community-destination-disabled`.trim()}
      aria-disabled="true"
      aria-label={`${COMMUNITY_PROFILE.label}, coming soon`}
      title="Available after public launch"
    >
      <span>{label}</span>
      <span className="community-coming-soon">Coming soon</span>
    </span>
  );
};
